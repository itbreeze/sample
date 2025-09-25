import { useState, useEffect, useCallback } from 'react';
import { getDocumentList } from '../../services/documentsApi'; 
import { buildTree } from '../utils/treeUtils';          

/**
 * 도면 트리 데이터를 불러오고 상태를 관리하는 커스텀 훅
 */
export const useDocumentTree = () => {
  // 1. 상태 관리: 이 훅은 도면 트리 데이터, 로딩 상태, 에러 상태를 내부에서 모두 관리합니다.
  const [documentTree, setDocumentTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. 데이터 로딩 함수: 서버에서 데이터를 가져와 트리 구조로 변환하고 상태를 업데이트합니다.
  const loadTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rawData = await getDocumentList(); // Service 함수 호출
      const treeData = buildTree(rawData);     // 유틸 함수로 데이터 가공
      setDocumentTree(treeData);
    } catch (err) {
      setError(err);
      setDocumentTree([]); // 에러 발생 시 데이터 초기화
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. 최초 실행: 컴포넌트가 처음 렌더링될 때 데이터 로딩 함수를 한 번 실행합니다.
  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // 4. 결과 반환: 컴포넌트에서 필요한 데이터와 상태, 그리고 수동으로 재로딩할 함수를 반환합니다.
  return { 
    documentTree,      // 가공된 트리 데이터
    loading,           // 로딩 상태
    error,             // 에러 객체
    reloadTree: loadTree // 필요 시 수동으로 데이터를 다시 불러올 함수
  };
};