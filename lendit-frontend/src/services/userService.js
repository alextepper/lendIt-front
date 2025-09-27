import http from "../lib/http";
import {
  mockGetProfile,
  mockUpdateProfile,
  mockUploadAvatar,
} from "./mock/user.mock";

const USE_MOCK = false; // set true to use mock

export async function getProfile() {
  if (USE_MOCK) return mockGetProfile();
  const { data } = await http.get("/auth/me");
  return data;
}

export async function updateProfile(payload) {
  if (USE_MOCK) return mockUpdateProfile(payload);
  const { data } = await http.patch("/auth/me", payload);
  return data;
}

export async function uploadAvatar(file) {
  if (USE_MOCK) return mockUploadAvatar(file);
  const form = new FormData();
  form.append("avatar", file);
  const { data } = await http.post("/uploads/sign", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { avatar: 'url' }
}
