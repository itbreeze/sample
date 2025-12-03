import { useState, useCallback } from 'react';
import { selectDocument, getDocumentTags } from '../../services/documentsApi';

/**
 * 도면 파일을 비동기적으로 로드하는 커스텀 훅
 * - API 요청 상태(isLoading, error)를 함께 관리
 * - 호출 시 서버에서 도면 정보(fetch) 후 반환
 *
 * @returns {{ isLoading: boolean, error: Error|null, loadDocument: Function }}
 */
export const useDocumentLoader = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 도면 문서를 로드하는 비동기 함수
   * @param {{ docId: string, docVr: string }} params
   * @returns {Promise<object|null>} 도면 데이터 또는 null
   */
  const loadDocument = useCallback(async ({ docId, docVr }) => {
    setIsLoading(true);
    setError(null);

    try {
      const documentData = await selectDocument(docId, docVr);
      let tags = [];
      try {
        const fetchedTags = await getDocumentTags({ docId, docVr });
        if (Array.isArray(fetchedTags)) {
          tags = fetchedTags;
        }
      } catch (err) {
        console.warn('[useDocumentLoader] 태그 정보 조회 실패', err);
      }
      setIsLoading(false);
      return { ...documentData, tags };
    } catch (err) {
      setError(err);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { isLoading, error, loadDocument };
};
