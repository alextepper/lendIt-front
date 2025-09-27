import http from "../lib/http";
import {
  mockListConversations,
  mockListMessages,
  mockSendMessage,
} from "./mock/chat.mock";

const USE_MOCK = true; // set true to use mock

export function openSocket(token) {
  // ws://host/ws?token=...
  const url = new URL(import.meta.env.VITE_WS_URL || "", window.location.href);
  if (token) {
    if (url.search) url.search += `&token=${token}`;
    else url.search = `?token=${token}`;
  }
  return new WebSocket(url.toString());
}

export async function listConversations(params = {}) {
  if (USE_MOCK) return mockListConversations(params);
  const { data } = await http.get("/messages/conversations", { params });
  // [{ id, title, last_text, last_at, unread, peer:{id,name,avatar} }]
  return data;
}

export async function listMessages(conversationId, params = {}) {
  if (USE_MOCK) return mockListMessages(conversationId, params);
  const { data } = await http.get(`/messages/conversations/${conversationId}`, {
    params,
  });
  // { items:[{ id, text, from_self, created_at }], has_more:boolean }
  return data;
}

export async function sendMessage(conversationId, payload) {
  if (USE_MOCK) return mockSendMessage(conversationId, payload);
  const { data } = await http.post(
    `/messages/conversations/${conversationId}`,
    payload
  );
  return data;
}
