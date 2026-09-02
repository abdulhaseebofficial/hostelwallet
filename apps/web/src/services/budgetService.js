import api from './api';

const budgetService = {
  async list(month, year) {
    const { data } = await api.get('/budget', { params: { month, year } });
    return data.data; // { month, year, items, totals }
  },

  async set(payload) {
    const { data } = await api.post('/budget', payload);
    return data.data.budget;
  },

  /** Saves a whole plan at once - used by "apply the AI budget". */
  async bulkSet(items, month, year) {
    const { data } = await api.post('/budget/bulk', { items, month, year });
    return data.data;
  },

  async update(id, limit) {
    const { data } = await api.put(`/budget/${id}`, { limit });
    return data.data.budget;
  },

  async remove(id) {
    const { data } = await api.delete(`/budget/${id}`);
    return data.data.id;
  },
};

export default budgetService;
