const peers = [
  { id: 7, name: "Dana", avatar: "https://i.pravatar.cc/64?img=15" },
  { id: 3, name: "Noam", avatar: "https://i.pravatar.cc/64?img=24" },
];
let convs = [
  {
    id: 101,
    title: "Dana",
    last_text: "See you!",
    last_at: "2025-09-25T13:05:00Z",
    unread: 2,
    peer: peers[0],
  },
  {
    id: 102,
    title: "Noam",
    last_text: "Thanks",
    last_at: "2025-09-24T09:12:00Z",
    unread: 0,
    peer: peers[1],
  },
];
const msgs = {
  101: [
    {
      id: 1,
      text: "Hi! Is the drill free tomorrow?",
      from_self: true,
      created_at: "2025-09-25T12:00:00Z",
    },
    {
      id: 2,
      text: "Yes, pick any time after 10.",
      from_self: false,
      created_at: "2025-09-25T12:05:00Z",
    },
    {
      id: 3,
      text: "See you!",
      from_self: true,
      created_at: "2025-09-25T13:05:00Z",
    },
  ],
  102: [
    {
      id: 1,
      text: "Payment received 👍",
      from_self: false,
      created_at: "2025-09-24T09:12:00Z",
    },
  ],
};

export async function mockListConversations() {
  await new Promise((r) => setTimeout(r, 120));
  return convs;
}

export async function mockListMessages(conversationId, { before } = {}) {
  await new Promise((r) => setTimeout(r, 100));
  const arr = msgs[conversationId] || [];
  // Simple paging stub
  return { items: arr.slice(-30), has_more: arr.length > 30 };
}

export async function mockSendMessage(conversationId, { text }) {
  await new Promise((r) => setTimeout(r, 80));
  const arr = msgs[conversationId] || (msgs[conversationId] = []);
  const m = {
    id: (arr.at(-1)?.id || 0) + 1,
    text,
    from_self: true,
    created_at: new Date().toISOString(),
  };
  arr.push(m);
  const c = convs.find((c) => c.id === conversationId);
  if (c) {
    c.last_text = text;
    c.last_at = m.created_at;
  }
  return m;
}
