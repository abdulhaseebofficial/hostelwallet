import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'hw-access-token';

/* --------------------------- token storage -------------------------- */

// Kept in memory for speed and mirrored to localStorage so a refresh of the
// page does not log the student out. The long-lived refresh token lives in an
// httpOnly cookie that JavaScript deliberately cannot read.
let accessToken = localStorage.getItem(TOKEN_KEY) || null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

/* ------------------------------- client ----------------------------- */

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send the refresh cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000, // AI calls can legitimately take a while
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/* --------------------- silent refresh on a 401 ---------------------- */

let refreshing = null;          // in-flight refresh promise
let onSessionExpired = () => {}; // set by AuthContext

export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const refreshSession = async () => {
  // One refresh at a time: parallel 401s all wait on the same promise.
  if (!refreshing) {
    refreshing = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const token = res.data.data.accessToken;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response ? error.response.status : null;

    // Never try to refresh the calls that mint a session themselves, and only
    // retry once. `/auth/me` is deliberately absent from this list: an expired
    // access token with a live refresh cookie is exactly the case the silent
    // refresh exists for, and matching it here logged the student out on boot
    // 15 minutes after login despite a 30-day cookie.
    const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'];
    const isAuthRoute = original && original.url && NO_REFRESH.some((path) => original.url.startsWith(path));

    if (status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      try {
        const token = await refreshSession();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

/* --------------------------- error helper --------------------------- */

/**
 * Turns any axios failure into a plain message the UI can show.
 * Field-level validation errors are attached as `.fields`.
 */
export const getErrorMessage = (error) => {
  if (error.response && error.response.data) {
    const { message, errors } = error.response.data;
    if (Array.isArray(errors) && errors.length) {
      const err = new Error(message || errors[0].message);
      err.fields = errors;
      return err.message;
    }
    return message || 'Something went wrong';
  }
  if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return error.message || 'Something went wrong';
};

/** Field-level errors, ready to feed into react-hook-form setError. */
export const getFieldErrors = (error) => {
  const errors = error.response && error.response.data && error.response.data.errors;
  return Array.isArray(errors) ? errors : [];
};

export default api;
