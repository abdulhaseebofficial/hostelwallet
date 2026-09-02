import api, { setAccessToken } from '../../../shared/api/client';

/** Every call returns the payload the caller actually needs, not the envelope. */
const authService = {
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  },

  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear locally even if the network call failed.
      setAccessToken(null);
    }
  },

  /** Used on app boot to restore the session from the refresh cookie. */
  async refresh() {
    const { data } = await api.post('/auth/refresh');
    setAccessToken(data.data.accessToken);
    return data.data.user;
  },

  async me() {
    const { data } = await api.get('/auth/me');
    return data.data.user;
  },

  async forgotPassword(email) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(token, password) {
    const { data } = await api.post(`/auth/reset-password/${token}`, { password });
    setAccessToken(data.data.accessToken);
    return data.data.user;
  },

  async changePassword(currentPassword, newPassword) {
    const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
    setAccessToken(data.data.accessToken);
    return data;
  },
};

export default authService;
