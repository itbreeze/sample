import { useCallback, useRef, useState } from 'react';
import { fetchRecentDocs, logDocumentOpen as logDocOpen } from '../services/recentDocs';

export const useRecentDocs = () => {
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastRequestId = useRef(0);

  const refreshRecentDocs = useCallback(
    async (options = {}) => {
      const requestId = ++lastRequestId.current;
      setLoading(true);
      setError(null);
      try {
        const { recentDocs, rawSample } = await fetchRecentDocs(options);
        if (requestId !== lastRequestId.current) {
          return [];
        }
        setRecentDocs(recentDocs);
        return recentDocs;
      } catch (err) {
        if (requestId === lastRequestId.current) {
          setError(err);
        }
        console.error('[useRecentDocs] fetch failed', err);
        return [];
      } finally {
        if (requestId === lastRequestId.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const logDocumentOpen = useCallback(
    async (payload) => {
      try {
        await logDocOpen(payload);
        await refreshRecentDocs({ limit: 50 });
      } catch (err) {
        console.error('[useRecentDocs] logDocumentOpen failed', err);
      }
    },
    [refreshRecentDocs]
  );

  return {
    recentDocs,
    loading,
    error,
    refreshRecentDocs,
    logDocumentOpen,
  };
};
