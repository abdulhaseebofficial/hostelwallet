import api from './api';

const goalService = {
  async list(status = 'all') {
    const { data } = await api.get('/goals', { params: { status } });
    return data.data; // { items, summary }
  },

  async create(payload) {
    const { data } = await api.post('/goals', payload);
    return data.data.goal;
  },

  async update(id, payload) {
    const { data } = await api.put(`/goals/${id}`, payload);
    return data.data.goal;
  },

  /** Positive amount adds money, negative withdraws it. */
  async contribute(id, amount, note = '') {
    const { data } = await api.patch(`/goals/${id}/add`, { amount, note });
    return data.data; // { goal, justCompleted }
  },

  async remove(id) {
    const { data } = await api.delete(`/goals/${id}`);
    return data.data.id;
  },
};

export default goalService;
