import api from './api';

export const searchPreview = async (searchType, searchTerm) => {
  const response = await api.post('/api/search', { searchType, searchTerm });
  return response.data;
};

export const selectDocument = async (docId, docVr) => {
  const response = await api.post('/folders/selectDocument', { docId, docVr });
  return response.data;
};