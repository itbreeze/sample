import api from './api';

const buildQueryParams = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const fetchRecentDocs = async ({ limit = 30 } = {}) => {
  const query = buildQueryParams({ limit });
  const response = await api.get(`/api/documents/recent${query}`);
  return {
    recentDocs: response.data?.recentDocs || [],
    rawSample: response.data?.rawSample || null,
  };
};

export const logDocumentOpen = async ({ docId, docVr, docNumber }) => {
  if (!docId) throw new Error('docId is required for recent doc log');
  return api.post('/api/documents/recent', {
    docId,
    docVr,
    docNumber,
  });
};
