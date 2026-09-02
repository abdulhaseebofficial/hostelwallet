import api from '../../../shared/api/client';

const notificationService = {
  async list(params = {}) {
    const { data } = await api.get('/notifications', { params });
    return data.data; // { items, unreadCount }
  },

  async check() {
    const { data } = await api.post('/notifications/check');
    return data.data;
  },

  async markRead(id) {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data.data.notification;
  },

  async markAllRead() {
    await api.patch('/notifications/read-all');
  },

  async remove(id) {
    await api.delete(`/notifications/${id}`);
  },

  async clearAll() {
    await api.delete('/notifications');
  },
};

export default notificationService;
