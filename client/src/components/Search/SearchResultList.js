import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X, Search } from 'lucide-react';
import './SearchResultList.css';
import TreeComboBox from '../common/TreeComboBox';
import { transformToTreeData, formatLevelDataForTree } from '../utils/dataUtils';

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
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [infoNode, setInfoNode] = useState(null);
  const [drawingNumber, setDrawingNumber] = useState('');
  const [drawingName, setDrawingName] = useState('');
  const [additionalConditions, setAdditionalConditions] = useState([]);

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  const performDetailSearch = useCallback(async (level, searchConditions) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      level: level,
      drawingNumber: searchConditions.drawingNumber,
      drawingName: searchConditions.drawingName,
      additionalConditions: searchConditions.additionalConditions
    };

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

  useEffect(() => {
    if (searchInfo && searchInfo.type === '도면' && searchInfo.term) {
      setDrawingName(searchInfo.term);

      const conditions = {
        drawingNumber: '',
        drawingName: searchInfo.term,
        additionalConditions: []
      };
      
      performDetailSearch('ALL', conditions);
    }
  }, [searchInfo, performDetailSearch]);

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
    performDetailSearch(selectedLevel, currentConditions);
  };

  const handleLevelSelect = (node) => {
    setSelectedLevel(node || 'ALL');
    setInfoNode(null);
  };

  const handleTitleClick = (node) => {
    console.log('[CLIENT-1] handleTitleClick triggered. Node:', node);
    setInfoNode(node);
    if (node && Array.isArray(node.children) && node.children.length > 0) {
      const childrenIds = node.children.map(child => child.id);
      console.log('[CLIENT-2] Extracted Children IDs:', childrenIds);
      setDrawingNumber('');
      setDrawingName('');
      setAdditionalConditions([]);

      performDetailSearch(childrenIds, {
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
          <div key={`${result.DOCNO}-${result.DOCVR}-${idx}`} className="search-result-item" onClick={() => handleFileClick(result)}>
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