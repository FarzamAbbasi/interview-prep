import axios from 'axios';

/**
 * One axios instance for the whole app.
 *   import api from '../api/axios';
 *   const { data } = await api.get('/auth/me');   // data = { success, message?, data }
 *
 * - Adds "Authorization: Bearer <token>" to every request when logged in
 * - If the server says 401 (token expired / invalid), the user is logged out
 */
export const TOKEN_KEY = 'ipp_token';

// localStorage can throw (private mode, blocked storage), so always use these helpers
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // ignore: the user stays logged in until the page is closed
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

// The free Render server sleeps after 15 idle minutes and takes up to ~1 minute
// to wake up, so the first request may be slow: allow 60 seconds (IPP-1201)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// AuthContext registers what to do when a logged-in request gets 401
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    const status = error.response?.status;
    // 401 = login expired/invalid; 403 ACCOUNT_BLOCKED = admin blocked this account while logged in
    const blocked = status === 403 && error.response?.data?.code === 'ACCOUNT_BLOCKED';
    if ((status === 401 || blocked) && sentToken && onUnauthorized) {
      onUnauthorized(error.response.data?.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Turn any API error into a message to show the user.
 *   catch (err) { toast.error(getErrorMessage(err)); }
 */
export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ECONNABORTED') return 'The server is waking up. Please try again in a moment';
  if (!error.response) return 'Cannot reach the server. Check your internet connection';
  return 'Something went wrong. Please try again';
}

export default api;
