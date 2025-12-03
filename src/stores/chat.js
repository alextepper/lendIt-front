import { defineStore } from "pinia";
import {
  fetchThreads,
  fetchThread,
  sendMessage as sendMessageAPI,
  markThreadAsRead,
  createOrGetThread,
  archiveThread,
} from "../services/messageService";
import { useAuthStore } from "./auth";
import websocketService from "../services/websocketService";

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    archivedConversations: [],
    threads: [], // Raw thread data from API
    messages: {}, // threadId -> [{...}]
    activeId: null,
    unreadTotal: 0,
    loading: false,
    loadingArchived: false,
    error: null,
    wsConnected: false,
  }),
  getters: {
    activeMessages(s) {
      return s.messages[s.activeId] || [];
    },
    activeConv(s) {
      return s.conversations.find((c) => c.id === s.activeId) || null;
    },
  },
  actions: {
    async loadConversations() {
      this.loading = true;
      this.error = null;
      try {
        const response = await fetchThreads({ page: 1, pageSize: 50 });
        this.threads = response.data || [];

        console.log("📋 Threads from API:", this.threads);
        console.log("📋 First thread:", this.threads[0]);
        console.log("📋 First thread userA:", this.threads[0]?.userA);
        console.log("📋 First thread userB:", this.threads[0]?.userB);

        // Transform threads to conversations format for compatibility
        const auth = useAuthStore();
        const currentUserId = auth.user?.id;

        this.conversations = this.threads.map((thread) => {
          // Determine which user is the "other" user (not the current user)
          const otherUser =
            thread.userAId === currentUserId ? thread.userB : thread.userA;

          console.log(
            "🔄 Processing thread:",
            thread.id,
            "currentUserId:",
            currentUserId,
            "otherUser:",
            otherUser
          );

          // Get last message from either lastMessage field or messages array
          let lastMsg = thread.lastMessage;

          // If no lastMessage but messages array exists, get the most recent one
          if (!lastMsg && thread.messages && thread.messages.length > 0) {
            // Sort by createdAt descending and take first
            lastMsg = thread.messages
              .slice() // avoid mutating original
              .sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
              )[0];
            console.log("🔍 Found last message from messages array:", lastMsg);
          }

          // Compute unread count from messages:
          // "if the last message is not from the user and readAt is null then you can use it as a counter"
          // Generalized to: count all messages from others with readAt === null.
          let unread = 0;
          if (currentUserId && Array.isArray(thread.messages)) {
            unread = thread.messages.filter(
              (m) =>
                m.senderId !== currentUserId &&
                (m.readAt === null || m.readAt === undefined)
            ).length;
          }

          // Fallback to backend-provided unreadCount if messages array is missing
          if (!unread && (thread.unreadCount || thread.unreadCount === 0)) {
            unread = thread.unreadCount || 0;
          }

          return {
            id: thread.id,
            name: otherUser?.username || "Unknown",
            avatar: otherUser?.avatar || null,
            last_text: lastMsg?.text || null,
            last_at: lastMsg?.createdAt || thread.createdAt,
            unread,
            item: thread.item,
            otherUser: otherUser,
          };
        });

        this.unreadTotal = this.conversations.reduce(
          (a, c) => a + (c.unread || 0),
          0
        );

        // Pick active if none
        if (!this.activeId && this.conversations[0]) {
          this.activeId = this.conversations[0].id;
        }
      } catch (e) {
        this.error = e.message || "Failed to load conversations";
        console.error("Failed to load conversations:", e);
      } finally {
        this.loading = false;
      }
    },

    async open(threadId) {
      this.activeId = threadId;

      if (!this.messages[threadId]) {
        try {
          const thread = await fetchThread(threadId);

          // Transform messages to expected format and sort by created_at (oldest first)
          const auth = useAuthStore();
          this.messages[threadId] = (thread.messages || [])
            .map((msg) => ({
              id: msg.id,
              text: msg.text,
              type: msg.type,
              imageUrl: msg.imageUrl,
              from_self: msg.senderId === auth.user?.id,
              sender: msg.sender,
              created_at: msg.createdAt,
              read_at: msg.readAt,
            }))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          // Mark as read
          await markThreadAsRead(threadId);

          // Update unread count
          const conv = this.conversations.find((c) => c.id === threadId);
          if (conv && conv.unread) {
            this.unreadTotal -= conv.unread;
            conv.unread = 0;
          }
        } catch (e) {
          console.error("Failed to load thread:", e);
        }
      }
    },

    async send(text) {
      const id = this.activeId;
      if (!id || !text?.trim()) return;

      const auth = useAuthStore();

      // Optimistic update
      const temp = {
        id: `tmp_${Date.now()}`,
        text,
        type: "TEXT",
        from_self: true,
        sender: auth.user,
        created_at: new Date().toISOString(),
        _optimistic: true,
      };

      this.messages[id] = [...(this.messages[id] || []), temp];

      // Optimistically update conversation last message immediately
      const conv = this.conversations.find((c) => c.id === id);
      const originalLastText = conv?.last_text;
      const originalLastAt = conv?.last_at;

      if (conv) {
        conv.last_text = text;
        conv.last_at = temp.created_at;
      }

      try {
        const real = await sendMessageAPI(id, { type: "TEXT", text });

        // Replace temp message with real one
        this.messages[id] = this.messages[id].map((m) =>
          m.id === temp.id
            ? {
                id: real.id,
                text: real.text,
                type: real.type,
                imageUrl: real.imageUrl,
                from_self: true,
                sender: real.sender,
                created_at: real.createdAt,
                read_at: real.readAt,
              }
            : m
        );

        // Update conversation last message with real data
        if (conv) {
          conv.last_text = real.text;
          conv.last_at = real.createdAt;
        }
      } catch (e) {
        // Revert optimistic updates on error
        this.messages[id] = this.messages[id].filter((m) => m.id !== temp.id);
        if (conv) {
          conv.last_text = originalLastText;
          conv.last_at = originalLastAt;
        }
        throw e;
      }
    },

    async createThread(peerUserId, itemId = null, orderId = null) {
      try {
        const thread = await createOrGetThread({ peerUserId, itemId, orderId });

        // Add to conversations if not already there
        if (!this.conversations.find((c) => c.id === thread.id)) {
          await this.loadConversations();
        }

        return thread;
      } catch (e) {
        console.error("Failed to create thread:", e);
        throw e;
      }
    },

    async markRead(threadId) {
      try {
        await markThreadAsRead(threadId);

        const c = this.conversations.find((c) => c.id === threadId);
        if (c && c.unread) {
          this.unreadTotal -= c.unread;
          c.unread = 0;
        }
      } catch (e) {
        console.error("Failed to mark thread as read:", e);
      }
    },

    connectWebSocket() {
      const auth = useAuthStore();
      if (!auth.isAuthed) {
        console.log("User not authenticated, skipping WebSocket connection");
        return;
      }

      console.log("Initializing WebSocket connection...");
      // Note: Token is sent via httpOnly cookies automatically
      // We pass null/empty since withCredentials: true will handle authentication
      websocketService.connect(null);

      // Handle connection status
      websocketService.on("connected", () => {
        this.wsConnected = true;
      });

      websocketService.on("disconnected", () => {
        this.wsConnected = false;
      });

      // Handle new messages
      websocketService.on("new_message", (data) => {
        console.log("New message received via WebSocket:", data);
        this.handleNewMessage(data);
      });

      // Handle message status updates
      websocketService.on("message_read", (data) => {
        console.log("Message read update:", data);
        this.handleMessageRead(data);
      });

      // Handle thread updates
      websocketService.on("thread_update", (data) => {
        console.log("Thread update:", data);
        this.handleThreadUpdate(data);
      });
    },

    disconnectWebSocket() {
      console.log("Disconnecting WebSocket...");
      websocketService.disconnect();
      this.wsConnected = false;
    },

    handleNewMessage(data) {
      const { threadId, message } = data;

      const auth = useAuthStore();
      const transformedMessage = {
        id: message.id,
        text: message.text,
        type: message.type,
        imageUrl: message.imageUrl,
        from_self: message.senderId === auth.user?.id,
        sender: message.sender,
        created_at: message.createdAt,
        read_at: message.readAt,
      };

      // Add message to the thread if it's loaded
      if (this.messages[threadId]) {
        // If this is our own message, try to reconcile with optimistic one instead of duplicating
        if (transformedMessage.from_self) {
          const idx = this.messages[threadId].findIndex(
            (m) => m._optimistic && m.text === transformedMessage.text
          );

          if (idx !== -1) {
            // Replace optimistic message with the real one from WebSocket
            this.messages[threadId].splice(idx, 1, transformedMessage);
          } else {
            // Fallback – only add if not already present by id
            const existsById = this.messages[threadId].some(
              (m) => m.id === transformedMessage.id
            );
            if (!existsById) {
              this.messages[threadId] = [
                ...this.messages[threadId],
                transformedMessage,
              ];
            }
          }
        } else {
          // For messages from others, just avoid duplicates by id
          const exists = this.messages[threadId].some(
            (m) => m.id === transformedMessage.id
          );
          if (!exists) {
            this.messages[threadId] = [
              ...this.messages[threadId],
              transformedMessage,
            ];
          }
        }
      }

      // Check if thread is in archived list and move to active (auto-unarchive)
      const archivedConv = this.archivedConversations.find(
        (c) => c.id === threadId
      );
      if (archivedConv) {
        // Remove from archived and add to active conversations
        this.archivedConversations = this.archivedConversations.filter(
          (c) => c.id !== threadId
        );
        archivedConv.archived = false;
        archivedConv.last_text = message.text;
        archivedConv.last_at = message.createdAt;
        if (threadId !== this.activeId && !transformedMessage.from_self) {
          archivedConv.unread = (archivedConv.unread || 0) + 1;
          this.unreadTotal++;
        }
        this.conversations.push(archivedConv);
        // Re-sort conversations by last message time
        this.conversations.sort((a, b) =>
          (b.last_at || "").localeCompare(a.last_at || "")
        );
        return;
      }

      // Update conversation list
      const conv = this.conversations.find((c) => c.id === threadId);
      if (conv) {
        conv.last_text = message.text;
        conv.last_at = message.createdAt;

        // Increment unread count if not the active thread and not from self
        if (threadId !== this.activeId && !transformedMessage.from_self) {
          conv.unread = (conv.unread || 0) + 1;
          this.unreadTotal++;
        }
      } else {
        // Thread not in list, reload conversations
        this.loadConversations();
      }
    },

    handleMessageRead(data) {
      const { threadId, messageIds } = data;

      // Update read status for messages
      if (this.messages[threadId]) {
        this.messages[threadId] = this.messages[threadId].map((m) => {
          if (messageIds.includes(m.id)) {
            return { ...m, read_at: new Date().toISOString() };
          }
          return m;
        });
      }
    },

    handleThreadUpdate(data) {
      const { threadId, unreadCount } = data;

      const conv = this.conversations.find((c) => c.id === threadId);
      if (conv) {
        const oldUnread = conv.unread || 0;
        conv.unread = unreadCount || 0;

        // Update total unread count
        this.unreadTotal = this.unreadTotal - oldUnread + (unreadCount || 0);
      }
    },

    async loadArchivedConversations() {
      this.loadingArchived = true;
      this.error = null;
      try {
        const response = await fetchThreads({
          page: 1,
          pageSize: 50,
          archived: true,
        });
        const archivedThreads = response.data || [];

        console.log("📦 Archived threads from API:", archivedThreads);

        // Transform archived threads to conversations format
        const auth = useAuthStore();
        const currentUserId = auth.user?.id;

        this.archivedConversations = archivedThreads.map((thread) => {
          // Determine which user is the "other" user (not the current user)
          const otherUser =
            thread.userAId === currentUserId ? thread.userB : thread.userA;

          // Get last message from either lastMessage field or messages array
          let lastMsg = thread.lastMessage;

          if (!lastMsg && thread.messages && thread.messages.length > 0) {
            lastMsg = thread.messages.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            )[0];
          }

          return {
            id: thread.id,
            name: otherUser?.username || "Unknown",
            avatar: otherUser?.avatar || null,
            last_text: lastMsg?.text || null,
            last_at: lastMsg?.createdAt || thread.createdAt,
            unread: thread.unreadCount || 0,
            item: thread.item,
            otherUser: otherUser,
            archived: true,
          };
        });
      } catch (e) {
        this.error = e.message || "Failed to load archived conversations";
        console.error("Failed to load archived conversations:", e);
      } finally {
        this.loadingArchived = false;
      }
    },

    async toggleArchive(threadId, archived) {
      try {
        await archiveThread(threadId, archived);

        if (archived) {
          // Move from active to archived
          const conv = this.conversations.find((c) => c.id === threadId);
          if (conv) {
            this.conversations = this.conversations.filter(
              (c) => c.id !== threadId
            );
            this.archivedConversations.push({ ...conv, archived: true });
          }
        } else {
          // Move from archived to active
          const conv = this.archivedConversations.find(
            (c) => c.id === threadId
          );
          if (conv) {
            this.archivedConversations = this.archivedConversations.filter(
              (c) => c.id !== threadId
            );
            this.conversations.push({ ...conv, archived: false });
            // Re-sort conversations by last message time
            this.conversations.sort((a, b) =>
              (b.last_at || "").localeCompare(a.last_at || "")
            );
          }
        }
      } catch (e) {
        this.error = e.message || "Failed to archive thread";
        console.error("Failed to archive thread:", e);
        throw e;
      }
    },
  },
});
