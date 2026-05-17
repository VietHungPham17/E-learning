/**
 * apiClient.js — Axios instance with automatic access-token refresh.
 *
 * When any request returns 401:
 *   1. Queues all concurrent 401s so only ONE refresh call is made
 *   2. Calls POST /auth/refresh (httpOnly cookie is sent automatically)
 *   3. Saves the new accessToken to the cookie
 *   4. Retries all queued requests with the new token
 *
 * If the refresh fails, clears the session cookies and reloads ONCE
 * (no loop because cookies are cleared → Auth screen is shown on reload).
 */

import axios from "axios";
import Cookies from "universal-cookie";

const cookies = new Cookies();
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

const apiClient = axios.create({ baseURL: API_URL });

// Queue requests that arrived while a refresh is already in flight
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  failedQueue = [];
};

const SESSION_KEYS = [
  "token", "accessToken", "userId", "username",
  "fullName", "avatarURL", "phoneNumber", "role", "2faEnabled",
];

const clearSessionAndReload = () => {
  SESSION_KEYS.forEach((k) => cookies.remove(k, { path: "/" }));
  window.location.reload();
};

// Attach the current access token to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = cookies.get("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }

    // Another refresh is already in flight — queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retried = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken = data.accessToken;
      cookies.set("accessToken", newToken, {
        path:     "/",
        sameSite: "strict",
        secure:   window.location.protocol === "https:",
      });

      original.headers.Authorization = `Bearer ${newToken}`;
      processQueue(null, newToken);
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError);
      // Cookies cleared before reload → after reload authToken is gone → Auth screen shown
      clearSessionAndReload();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
