import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Plus, X, Search } from 'lucide-react';
import './SearchResultList.css';
import TreeComboBox from '../common/TreeComboBox';
import { transformToTreeData, formatLevelDataForTree } from '../utils/dataUtils';

/** 🔹 리프(말단) 노드의 ID만 수집 */
const collectLeafNodeIds = (node) => {
  if (!node.children || node.children.length === 0) {
    return [node.id];
  }
  return node.children.flatMap(collectLeafNodeIds);
};

/** 🔹 노드의 전체 경로 문자열 생성 */
const getNodePath = (nodes, nodeId) => {
  const path = [];
  const findPathRecursive = (currentNodes, id) => {
    for (const node of currentNodes) {
      if (node.id === id) {
        path.unshift(node.name);
        return true;
      }
      if (node.children && findPathRecursive(node.children, id)) {
        path.unshift(node.name);
        return true;
      }
    }
    return false;
  };
  findPathRecursive(nodes, nodeId);
  return path;
};

/** 🔹 트리에서 특정 ID를 가진 노드 탐색 */
const findNodeById = (nodes, id) => {
  if (!nodes || !id) return null;
  for (const node of nodes) {
    if (node.id == id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
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
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedPath, setSelectedPath] = useState('');

  // 🔹 searchInfo 처리 여부 추적용 ref
  const processedSearchInfoRef = useRef(null);

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  /** 🔹 상세 검색 실행 */
  const performDetailSearch = useCallback(async (leafNodeIds, searchConditions) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      leafNodeIds,
      drawingNumber: searchConditions.drawingNumber,
      drawingName: searchConditions.drawingName,
      additionalConditions: searchConditions.additionalConditions,
      // Request server to remove any default limits for detailed search
      unlimited: true
    };

    try {
      const response = await fetch("http://localhost:4001/api/search/advanced", {
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

  /** 🔹 최초 렌더링 시 레벨 데이터 불러오기 */
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        setLevelsLoading(true);
        const response = await fetch("http://localhost:4001/api/search/levels");
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

  /** 🔹 헤더 검색바에서 전달된 searchInfo 처리 */
  useEffect(() => {
    if (searchInfo && searchInfo.type === '도면' && searchInfo.term) {
      setCurrentLeafNodeIds('ALL');
      setInfoNode(null);
      setDrawingNumber('');
      setAdditionalConditions([]);

      const conditions = {
        drawingNumber: '',
        drawingName: searchInfo.term,
        additionalConditions: []
      };

      performDetailSearch('ALL', conditions);
    }
  }, [searchInfo?.timestamp, performDetailSearch]);

  /** 🔹 조건 추가/삭제/수정 */
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

  /** 🔹 검색 실행 */
  const performAdvancedSearch = () => {
    const currentConditions = { drawingNumber, drawingName, additionalConditions };
    performDetailSearch(currentLeafNodeIds, currentConditions);
  };

  /** 🔹 트리에서 노드 선택 */
  const handleLevelSelect = (node) => {
    if (node && node !== 'ALL') {
      const path = getNodePath(levelTreeData, node.id);
      const pathStr = path.join('/');
      console.log('[handleLevelSelect] node:', node);
      console.log('[handleLevelSelect] path array:', path);
      console.log('[handleLevelSelect] path string:', pathStr);

      setSelectedPath(pathStr); // 상태 업데이트
    } else {
      console.log('[handleLevelSelect] ALL 선택됨');
      setSelectedPath('전체');
    }
  };



  /** 🔹 노드 제목 클릭 시 조건 초기화 후 검색 실행 */
  const handleTitleClick = (node) => {
    setInfoNode(node);
    if (node) {
      const leafNodeIds = collectLeafNodeIds(node);
      setCurrentLeafNodeIds(leafNodeIds);
      setDrawingNumber('');
      setDrawingName('');
      setAdditionalConditions([]);
      processedSearchInfoRef.current = null;
      performDetailSearch(leafNodeIds, { drawingNumber: '', drawingName: '', additionalConditions: [] });
    }
  };

  /** 🔹 파일 선택 시 상위 콜백 실행 */
  const handleFileClick = async (result) => {
    if (onFileSelect) {
      await onFileSelect({ docId: result.DOCNO, docVr: result.DOCVR });
    }
  };

  /** 🔹 검색 조건 영역 렌더링 */
  const renderSearchConditions = () => {
    let conditionText = null;
    if (infoNode) {
      const path = getNodePath(levelTreeData, infoNode.id);
      conditionText = `선택: ${path.join(' / ')}`;
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
            <label>사업소 : </label>
          </div>
          <div className="term-section-with-remove"
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
                value={selectedPath}
              />
            )}
          </div>

        </div>

        <div className="search-condition-row">
          <div className="type-section"><label>도면번호 : </label></div>
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
          <div className="type-section"><label>도면명 : </label></div>
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

        {/* 🔹 추가 조건 리스트 */}
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

  /** 🔹 검색 결과 영역 렌더링 */
  const renderSearchResults = () => {
    if (isLoading) return <div className="search-result-loading"><Loader2 className="loading-spinner large" /> 검색 중...</div>;
    if (error) return <div className="search-result-error">검색 오류: {error}</div>;
    if (searchResults.length === 0) return <div className="search-result-no-results">❌ 검색 결과 없음</div>;

    let conditionText = null;
    if (infoNode) {
      const path = getNodePath(levelTreeData, infoNode.id);
      conditionText = path.join(' / ');
    }

    return (
      <div className="search-result-list">
        <div className="search-result-title">
          <span className="search-result-condition">{conditionText ? conditionText : '전체'}</span> 검색결과 ({searchResults.length}건)
        </div>
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
      <div className="search-conditions-panel">{renderSearchConditions()}</div>
      <div className="search-results-panel">{renderSearchResults()}</div>
    </div>
  );
};

export default SearchResultList;
