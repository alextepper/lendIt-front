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
  const { data } = await http.patch("/users/me", payload);
  return data;
}

export async function uploadAvatar(file) {
  if (USE_MOCK) return mockUploadAvatar(file);
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await http.post("/users/me/profile-picture", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000, // 30 seconds timeout for file uploads
  });
  // Backend returns { profilePicture: "/uploads/users/..." }
  // Return in format expected by frontend
  return { 
    avatar: data.profilePicture || data.avatar,
    profilePicture: data.profilePicture || data.avatar
  };
}

/**
 * Get user profile by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile data
 */
export async function getUserById(userId) {
  try {
    const { data } = await http.get(`/users/${userId}/profile`);
    return data;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    throw error;
  }
}

/**
 * Get user reviews
 * @param {string} userId - User ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} User reviews
 */
export async function getUserReviews(userId, params = {}) {
  try {
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      type: params.type, // 'renter' or 'owner'
      ...params,
    };

    const { data } = await http.get(`/users/${userId}/reviews`, {
      params: queryParams,
    });
    return data.reviews || data;
  } catch (error) {
    console.error("Failed to fetch user reviews:", error);
    throw error;
  }
}
