import { defineStore } from "pinia";
import {
  listConversations,
  listMessages,
  sendMessage,
  openSocket,
} from "../services/chatService";
import { useAuthStore } from "./auth";

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    messages: {}, // convId -> [{...}]
    hasMore: {}, // convId -> boolean
    activeId: null,
    socket: null,
    socketReady: false,
    typing: {}, // convId -> boolean
    unreadTotal: 0,
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
      this.conversations = await listConversations();
      this.unreadTotal = this.conversations.reduce(
        (a, c) => a + (c.unread || 0),
        0
      );
      // pick active if none
      if (!this.activeId && this.conversations[0])
        this.activeId = this.conversations[0].id;
    },
    async open(convId) {
      this.activeId = convId;
      if (!this.messages[convId]) {
        const { items, has_more } = await listMessages(convId);
        this.messages[convId] = items;
        this.hasMore[convId] = !!has_more;
      }
    },
    async loadMore(convId) {
      // example of pagination via "before"
      const oldest = this.messages[convId]?.[0];
      const before = oldest?.created_at;
      const { items, has_more } = await listMessages(convId, { before });
      this.messages[convId] = [...items, ...(this.messages[convId] || [])];
      this.hasMore[convId] = !!has_more;
    },
    async send(text) {
      const id = this.activeId;
      if (!id || !text?.trim()) return;
      // optimistic
      const temp = {
        id: `tmp_${Date.now()}`,
        text,
        from_self: true,
        created_at: new Date().toISOString(),
        _optimistic: true,
      };
      this.messages[id] = [...(this.messages[id] || []), temp];
      try {
        const real = await sendMessage(id, { text });
        this.messages[id] = this.messages[id].map((m) =>
          m.id === temp.id ? real : m
        );
        const c = this.conversations.find((c) => c.id === id);
        if (c) {
          c.last_text = real.text;
          c.last_at = real.created_at;
        }
      } catch (e) {
        // revert optimistic on error
        this.messages[id] = this.messages[id].filter((m) => m.id !== temp.id);
        throw e;
      }
    },
    connectSocket() {
      const auth = useAuthStore();
      try {
        this.socket = openSocket(auth.token);
      } catch {
        this.socket = null;
      }
      if (!this.socket) return;
      this.socket.addEventListener("open", () => {
        this.socketReady = true;
      });
      this.socket.addEventListener("close", () => {
        this.socketReady = false;
      });
      this.socket.addEventListener("message", (ev) => {
        // Expected server payload examples:
        // { type:'message', conversation_id, message:{ id,text,from_self:false,created_at } }
        // { type:'typing', conversation_id, value:true|false }
        // { type:'unread', total }
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "message") {
            const cid = msg.conversation_id;
            if (!this.messages[cid]) this.messages[cid] = [];
            this.messages[cid] = [...this.messages[cid], msg.message];
            const c = this.conversations.find((c) => c.id === cid);
            if (c) {
              c.last_text = msg.message.text;
              c.last_at = msg.message.created_at;
              if (cid !== this.activeId) c.unread = (c.unread || 0) + 1;
            }
            this.unreadTotal = this.conversations.reduce(
              (a, c) => a + (c.unread || 0),
              0
            );
          }
          if (msg.type === "typing") {
            this.typing[msg.conversation_id] = !!msg.value;
          }
          if (msg.type === "unread") {
            this.unreadTotal = Number(msg.total) || 0;
          }
        } catch {}
      });
    },
    markRead(convId) {
      const c = this.conversations.find((c) => c.id === convId);
      if (c && c.unread) {
        this.unreadTotal -= c.unread;
        c.unread = 0;
      }
      // You may also POST to backend to acknowledge read
    },
  },
});
