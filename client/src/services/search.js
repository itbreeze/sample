import api from './api';

export const searchPreview = async (searchType, searchTerm) => {
  const response = await api.post('/api/search', { searchType, searchTerm });
  return response.data;
};