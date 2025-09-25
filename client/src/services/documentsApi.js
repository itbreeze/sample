import api from './api';


export const getDocumentList = async () => {
  const response = await api.get('/api/documents'); 
  return response.data;
};


export const selectDocument = async (docId, docVr) => {
  const response = await api.post('/api/documents/selectDocument', { docId, docVr });
  return response.data;
};