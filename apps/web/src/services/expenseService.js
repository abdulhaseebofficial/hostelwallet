import api from './api';

const expenseService = {
  /** `params` maps straight onto the backend query string. */
  async list(params = {}) {
    const { data } = await api.get('/expenses', { params });
    return data.data; // { items, pagination, filteredTotal }
  },

  async get(id) {
    const { data } = await api.get(`/expenses/${id}`);
    return data.data.expense;
  },

  async create(payload) {
    const { data } = await api.post('/expenses', payload);
    return data.data.expense;
  },

  async update(id, payload) {
    const { data } = await api.put(`/expenses/${id}`, payload);
    return data.data.expense;
  },

  async remove(id) {
    const { data } = await api.delete(`/expenses/${id}`);
    return data.data.id;
  },
};

export default expenseService;
