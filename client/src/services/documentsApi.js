import api from './api';

export const getDocumentList = async () => {
  const response = await api.get('/api/documents');
  return response.data;
};

export const selectDocument = async (docId, docVr) => {
  const response = await api.post('/api/documents/selectDocument', { docId, docVr });
  return response.data;
};

export const getDocumentTags = async ({ docId, docVr }) => {
  if (!docId) {
    throw new Error('docId is required to fetch document tags');
  }

  const params = new URLSearchParams();
  params.append('docId', docId);
  if (docVr) {
    params.append('docVr', docVr);
  }

  const response = await api.get(`/api/documents/tags?${params.toString()}`);
  return response.data;
};

export const getDocumentMetadata = async ({ docId, docVr }) => {
  if (!docId) throw new Error('docId is required for metadata lookup');

  const params = new URLSearchParams();
  params.append('docId', docId);
  if (docVr) params.append('docVr', docVr);

  const response = await api.get(`/api/documents/info?${params.toString()}`);
  return response.data;
};

export const getDocumentEquipment = async ({ docId, docVr, plantCode }) => {
  if (!docId) throw new Error('docId is required for equipment lookup');
  if (!plantCode) throw new Error('plantCode is required for equipment lookup');

  const params = new URLSearchParams();
  params.append('docId', docId);
  if (docVr) params.append('docVr', docVr);
  params.append('plantCode', plantCode);

  const response = await api.get(`/api/documents/equipment?${params.toString()}`);
  return response.data;
};
