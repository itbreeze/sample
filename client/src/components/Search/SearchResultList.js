import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Plus, X, Search } from 'lucide-react';
import './SearchResultList.css';
import TreeComboBox from '../common/TreeComboBox';
import { transformToTreeData, formatLevelDataForTree } from '../utils/dataUtils';

const collectLeafNodeIds = (node) => {
  if (!node.children || node.children.length === 0) {
    return [node.id];
  }
  
  const leafIds = [];
  for (const child of node.children) {
    leafIds.push(...collectLeafNodeIds(child));
  }
  return leafIds;
};

const getNodePath = (nodes, nodeId) => {
  const path = [];
  const findPathRecursive = (currentNodes, id) => {
    for (const node of currentNodes) {
      if (node.id === id) {
        path.unshift(node.name);
        return true;
      }
      if (node.children) {
        if (findPathRecursive(node.children, id)) {
          path.unshift(node.name);
          return true;
        }
      }
    }
    return false;
  };
  findPathRecursive(nodes, nodeId);
  return path;
};

const SearchResultList = ({ searchInfo = null, onFileSelect }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [levelTreeData, setLevelTreeData] = useState([]);
  const [currentLeafNodeIds, setCurrentLeafNodeIds] = useState('ALL');
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [infoNode, setInfoNode] = useState(null);
  const [drawingNumber, setDrawingNumber] = useState('');
  const [drawingName, setDrawingName] = useState('');
  const [additionalConditions, setAdditionalConditions] = useState([]);

  // 🔹 추가: searchInfo 처리 여부를 추적하는 ref
  const processedSearchInfoRef = useRef(null);

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  const performDetailSearch = useCallback(async (leafNodeIds, searchConditions) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      leafNodeIds: leafNodeIds,
      drawingNumber: searchConditions.drawingNumber,
      drawingName: searchConditions.drawingName,
      additionalConditions: searchConditions.additionalConditions
    };

    console.log('[CLIENT] 상세 검색 요청 페이로드:', payload);

    try {
      const response = await fetch("http://localhost:4000/api/search/advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('검색 요청에 실패했습니다.');
      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        setLevelsLoading(true);
        const response = await fetch("http://localhost:4000/api/search/levels");
        if (!response.ok) throw new Error('레벨 데이터를 불러오는데 실패했습니다.');
        const data = await response.json();

        if (data) {
          const formattedData = formatLevelDataForTree(data);
          const treeData = transformToTreeData(formattedData, null);
          setLevelTreeData(treeData);
        }
      } catch (err) {
        console.error(err);
        setLevelTreeData([]);
      } finally {
        setLevelsLoading(false);
      }
    };
    fetchLevels();
  }, []);

  /**
   * 🔹 수정: searchInfo 처리 로직 개선
   */
useEffect(() => {
  if (searchInfo && searchInfo.type === '도면' && searchInfo.term) {
    console.log('[CLIENT] 헤더 검색바에서 전달된 searchInfo 처리:', searchInfo);
    
    // 상태 초기화
    setCurrentLeafNodeIds('ALL');
    setInfoNode(null);
    setDrawingNumber('');
    setAdditionalConditions([]);
    
    // 🔹 헤더 검색어로 상태 업데이트
    setDrawingName(searchInfo.term);

    const conditions = {
      drawingNumber: '',
      drawingName: searchInfo.term,
      additionalConditions: []
    };
    
    performDetailSearch('ALL', conditions);
  }
}, [searchInfo?.timestamp, performDetailSearch]); // 🔹 timestamp를 의존성으로 사용

  const addAdditionalCondition = () => {
    const newId = (additionalConditions.length > 0 ? Math.max(...additionalConditions.map(c => c.id)) : 0) + 1;
    setAdditionalConditions(prev => [
      ...prev,
      { id: newId, type: '도면', term: '', operator: 'AND' }
    ]);
  };

  const removeAdditionalCondition = (id) => {
    setAdditionalConditions(prev => prev.filter(condition => condition.id !== id));
  };

  const updateAdditionalCondition = (id, field, value) => {
    setAdditionalConditions(prev =>
      prev.map(condition => (condition.id === id ? { ...condition, [field]: value } : condition))
    );
  };

  const performAdvancedSearch = () => {
    const currentConditions = {
      drawingNumber,
      drawingName,
      additionalConditions
    };

    if (!drawingNumber.trim() && !drawingName.trim() && additionalConditions.every(c => !c.term.trim())) {
      alert('하나 이상의 검색어를 입력해주세요.');
      return;
    }
    
    console.log('[CLIENT] 검색 실행 - 현재 leafNodeIds:', currentLeafNodeIds);
    performDetailSearch(currentLeafNodeIds, currentConditions);
  };

  const handleLevelSelect = (node) => {
    if (node && node !== 'ALL') {
      const leafIds = collectLeafNodeIds(node);
      setCurrentLeafNodeIds(leafIds);
      console.log('[CLIENT] handleLevelSelect - leafNodeIds 저장:', leafIds);
    } else {
      setCurrentLeafNodeIds('ALL');
      console.log('[CLIENT] handleLevelSelect - ALL 선택');
    }
    setInfoNode(null);
  };

  /**
   * 🔹 수정: handleTitleClick 실행 시 searchInfo 처리 완료 표시 초기화
   */
  const handleTitleClick = (node) => {
    console.log('[CLIENT-1] handleTitleClick triggered. Node:', node);
    setInfoNode(node);

    if (node) {
      const leafNodeIds = collectLeafNodeIds(node);
      console.log('[CLIENT-2] Collected Leaf Node IDs:', leafNodeIds);
      
      setCurrentLeafNodeIds(leafNodeIds);

      // 🔹 검색 조건 초기화 (헤더 검색 이력 제거)
      setDrawingNumber('');
      setDrawingName('');
      setAdditionalConditions([]);
      
      // 🔹 searchInfo 처리 플래그 초기화
      processedSearchInfoRef.current = null;

      performDetailSearch(leafNodeIds, {
        drawingNumber: '',
        drawingName: '',
        additionalConditions: []
      });
    }
  };

  const handleFileClick = async (result) => {
    if (onFileSelect) {
      await onFileSelect({ docId: result.DOCNO, docVr: result.DOCVR });
    }
  };

  const renderSearchConditions = () => {
    let conditionText = null;
    if (infoNode) {
      const path = getNodePath(levelTreeData, infoNode.id);
      conditionText = `조건: ${path.join(' / ')}`;
    }

    return (
      <div className="search-conditions">
        <div className="search-conditions-header">
          <h3></h3>
          <button className="search-execute-btn" onClick={performAdvancedSearch} disabled={isLoading} title="검색">
            <Search size={16} /> {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>사업소</label>
          </div>
          <div
            className="term-section-with-remove"
            style={{ flexGrow: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
          >
            {levelsLoading ? (
              <div className="combobox-input-loading">로딩 중...</div>
            ) : (
              <TreeComboBox
                data={levelTreeData}
                onNodeSelect={handleLevelSelect}
                onTitleClick={handleTitleClick}
                placeholder="전체"
              />
            )}
            {conditionText && <div className="condition-display">{conditionText}</div>}
          </div>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>도면번호</label>
          </div>
          <div className="term-section-with-remove">
            <input
              type="text"
              value={drawingNumber}
              onChange={(e) => setDrawingNumber(e.target.value)}
              placeholder="도면번호 입력"
              className="term-input"
            />
          </div>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>도면명</label>
          </div>
          <div className="term-section-with-remove">
            <input
              type="text"
              value={drawingName}
              onChange={(e) => setDrawingName(e.target.value)}
              placeholder="도면명 입력"
              className="term-input"
            />
          </div>
        </div>

        <div className="conditions-list">
          {additionalConditions.map((condition) => (
            <div key={condition.id} className="search-condition-row">
              <div className="operator-section">
                <select
                  value={condition.operator}
                  onChange={(e) => updateAdditionalCondition(condition.id, 'operator', e.target.value)}
                  className="operator-select"
                >
                  {operatorOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="term-section-with-remove">
                <input
                  type="text"
                  value={condition.term}
                  onChange={(e) => updateAdditionalCondition(condition.id, 'term', e.target.value)}
                  placeholder="추가 검색어 입력"
                  className="term-input"
                  onKeyPress={(e) => { if (e.key === 'Enter') performAdvancedSearch(); }}
                />
                <button
                  className="remove-condition-btn"
                  onClick={() => removeAdditionalCondition(condition.id)}
                  title="조건 삭제"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="search-actions">
          <button className="add-condition-btn" onClick={addAdditionalCondition} title="조건 추가">
            <Plus size={16} /> 검색조건추가
          </button>
        </div>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (isLoading) return <div className="search-result-loading"><Loader2 className="loading-spinner large" /> 검색 중...</div>;
    if (error) return <div className="search-result-error">검색 오류: {error}</div>;
    if (searchResults.length === 0) return <div className="search-result-no-results">검색 결과 없음</div>;

    return (
      <div className="search-result-list">
        {searchResults.map((result, idx) => (
          <div 
            key={`${result.DOCNO}-${result.DOCVR}-${idx}`} 
            className="search-result-item" 
            onClick={() => handleFileClick(result)}
          >
            <div className="result-main-info">[{result.DOCNUMBER}] {result.DOCNM}</div>
            <div className="result-sub-info">{result.PLANTNM} / {result.PARENTNM} / {result.HOGI_GUBUN}호기</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="advanced-search-container">
      <div className="search-conditions-panel">
        {renderSearchConditions()}
      </div>
      <div className="search-results-panel">
        {renderSearchResults()}
      </div>
    </div>
  );
};

export default SearchResultList;