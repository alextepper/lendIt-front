import http from "../lib/http";
import {
  mockListConversations,
  mockListMessages,
  mockSendMessage,
} from "./mock/chat.mock";

const USE_MOCK = false; // set true to use mock

export function openSocket() {
  // ws://host/ws - cookies will be sent automatically
  const url = new URL(import.meta.env.VITE_WS_URL, window.location.href);
  return new WebSocket(url.toString());
}

export async function listConversations(params = {}) {
  if (USE_MOCK) return mockListConversations(params);
  const { data } = await http.get("/threads", { params });
  // [{ id, title, last_text, last_at, unread, peer:{id,name,avatar} }]
  return data;
}

export async function listMessages(conversationId, params = {}) {
  if (USE_MOCK) return mockListMessages(conversationId, params);
  const { data } = await http.get(`/threads/${conversationId}`, {
    params,
  });
  // { items:[{ id, text, from_self, created_at }], has_more:boolean }
  return data;
}

export async function sendMessage(conversationId, payload) {
  if (USE_MOCK) return mockSendMessage(conversationId, payload);
  const { data } = await http.post(
    `/threads/${conversationId}/messages`,
    payload
  );
  return data;
}
