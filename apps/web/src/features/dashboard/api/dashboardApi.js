import api from '../../../shared/api/client';

const dashboardService = {
  async summary(month, year) {
    const { data } = await api.get('/dashboard/summary', { params: { month, year } });
    return data.data;
  },
};

export default dashboardService;
