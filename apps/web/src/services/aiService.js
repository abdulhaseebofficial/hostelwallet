import api from './api';

const aiService = {
  async status() {
    const { data } = await api.get('/ai/status');
    return data.data; // { configured, model, fallback }
  },

  /** Structured advice: { headline, tips[], warning, encouragement, aiPowered } */
  async advice({ tipCount = 4, month, year } = {}) {
    const { data } = await api.post('/ai/advice', { tipCount, month, year });
    return data.data;
  },

  async chat(message) {
    const { data } = await api.post('/ai/chat', { message });
    return data.data; // { reply, aiPowered }
  },

  async history() {
    const { data } = await api.get('/ai/chat/history');
    return data.data.messages;
  },

  async clearChat() {
    await api.delete('/ai/chat');
  },

  async tip(refresh = false) {
    const { data } = await api.get('/ai/tip', { params: refresh ? { refresh: 1 } : {} });
    return data.data; // { tip, aiPowered, cached }
  },

  async suggestBudget(month, year) {
    const { data } = await api.post('/ai/suggest-budget', { month, year });
    return data.data; // { summary, savingsTarget, categories[], income, allocated }
  },

  async weeklySummary() {
    const { data } = await api.get('/ai/weekly-summary');
    return data.data; // { summary, totalSpent, breakdown }
  },
};

export default aiService;
