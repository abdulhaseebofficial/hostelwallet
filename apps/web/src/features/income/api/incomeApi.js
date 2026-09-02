import api from '../../../shared/api/client';

const incomeService = {
  async list(params = {}) {
    const { data } = await api.get('/income', { params });
    return data.data; // { items, total }
  },

  async summary() {
    const { data } = await api.get('/income/summary');
    return data.data;
  },

  async create(payload) {
    const { data } = await api.post('/income', payload);
    return data.data.income;
  },

  async update(id, payload) {
    const { data } = await api.put(`/income/${id}`, payload);
    return data.data.income;
  },

  async remove(id) {
    const { data } = await api.delete(`/income/${id}`);
    return data.data.id;
  },
};

export default incomeService;
