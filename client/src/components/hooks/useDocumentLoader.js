import { useState, useCallback } from 'react';
import { selectDocument } from '../../services/documentsApi';

/**
 * 도면 파일 로딩을 전담하는 커스텀 훅
 * @returns {{isLoading: boolean, error: Error|null, loadDocument: Function}}
 */
export const useDocumentLoader = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // 이 함수를 호출하면 서버에 문서 정보를 요청하고 VSF 경로 등을 받아옵니다.
    const loadDocument = useCallback(async ({ docId, docVr }) => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. API 서비스 호출
            const documentData = await selectDocument(docId, docVr);
            
            // 2. 로딩 상태 변경 및 성공 데이터 반환
            setIsLoading(false);
            return documentData; 
        } catch (err) {
            // 3. 에러 상태 변경 및 실패 결과 반환
            setError(err);
            setIsLoading(false);
            console.error("문서 로딩 실패 (useDocumentLoader):", err);
            return null;
        }
    }, []);

    // 이 훅은 외부에서 사용할 상태와 함수를 반환합니다.
    return { isLoading, error, loadDocument };
};