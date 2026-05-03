/**
 * apiClient.js — Axios instance with automatic access-token refresh.
 *
 * When any request returns 401, it:
 *   1. Calls POST /auth/refresh with the stored refreshToken cookie
 *   2. Saves the new accessToken to the cookie
 *   3. Retries the original request once with the new token
 *
 * If the refresh itself fails (refresh token also expired / revoked),
 * it forces a page reload to send the user back to the login screen.
 */

import axios from "axios";
import Cookies from "universal-cookie";

const cookies = new Cookies();
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

const apiClient = axios.create({ baseURL: API_URL });

// Attach the current access token to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = cookies.get("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try one refresh then retry; on second failure reload to login
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      try {
        // refreshToken is an httpOnly cookie — browser sends it automatically
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        cookies.set("accessToken", data.accessToken, {
          sameSite: "strict",
          secure: window.location.protocol === "https:",
        });

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch {
        // Refresh token is also invalid — force re-login
        window.location.reload();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;