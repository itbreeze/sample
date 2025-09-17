import api from './api';

export const getDocumentList = async () => {
  const response = await api.get('/folders');
  return response.data;
};

export const selectDocument = async (docId, docVr) => {
  const response = await api.post('/folders/selectDocument', { docId, docVr });
  return response.data;
};