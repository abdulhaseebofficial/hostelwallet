import api from '../../../shared/api/client';

const feedbackService = {
  async submit(payload) {
    const { data } = await api.post('/feedback', payload);
    return data.data.feedback;
  },

  async mine() {
    const { data } = await api.get('/feedback/mine');
    return data.data.items;
  },
};

export default feedbackService;
