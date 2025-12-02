import React, { useState, useEffect, useCallback, memo } from 'react';
import { Loader2, Plus, X, Search, RotateCcw } from 'lucide-react';
import './SearchResultList.css';
import TreeComboBox from '../common/TreeComboBox';
import { transformToTreeData, formatLevelDataForTree } from '../utils/dataUtils';
import { highlightText } from './highlightText';
import { fetchSearchLevels, advancedSearch } from '../../services/search';

// leaf 노드들의 ID만 수집
const collectLeafNodeIds = (node) => {
  if (!node.children || node.children.length === 0) {
    return [node.id];
  }
  return node.children.flatMap(collectLeafNodeIds);
};

// 노드의 전체 경로를 문자열 배열로 반환
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

const buildHighlightSource = ({ drawingNumber, drawingName, additionalConditions = [] }) => {
  const pieces = [];
  if (drawingNumber) pieces.push(drawingNumber);
  if (drawingName) pieces.push(drawingName);
  additionalConditions
    .filter((cond) => typeof cond.term === 'string' && cond.term.trim() !== '')
    .forEach((cond) => pieces.push(cond.term));
  return pieces.join(' ');
};

const AdditionalConditionRow = memo(
  ({ condition, operatorOptions, onOperatorChange, onTermChange, onRemove }) => (
    <div key={condition.id} className="search-condition-row">
      <div className="operator-section">
        <select
          value={condition.operator}
          onChange={(e) => onOperatorChange(condition.id, e.target.value)}
          className="operator-select"
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="term-section-with-remove">
        <input
          type="text"
          value={condition.term}
          onChange={(e) => onTermChange(condition.id, e.target.value)}
          placeholder="추가 검색어 입력"
          className="term-input"
          onKeyPress={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
        {condition.term && (
          <button
            type="button"
            className="field-clear-btn field-clear-btn-inline"
            onClick={() => onTermChange(condition.id, '')}
            title="키워드 지우기"
          >
            <X size={14} />
          </button>
        )}
        <button
          className="remove-condition-btn"
          onClick={() => onRemove(condition.id)}
          title="조건 삭제"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
);

const SearchResultItem = memo(
  ({ result, onSelect, docNumberHighlight, docNameHighlight, subHighlight }) => (
    <div className="search-result-item" onClick={() => onSelect(result)}>
      <div className="result-main-info">
        <span className="result-doc-number" title={result.DOCNUMBER || ''}>
          [{highlightText(result.DOCNUMBER, docNumberHighlight)}]
        </span>
        <span className="result-doc-title">
          {highlightText(result.DOCNM, docNameHighlight)}
        </span>
      </div>
      <div className="result-sub-info">
        {highlightText(result.PLANTNM, subHighlight)} /{' '}
        {highlightText(result.PARENTNM, subHighlight)} /{' '}
        {highlightText(result.HOGI_LABEL || result.HOGI_GUBUN, subHighlight)}
      </div>
    </div>
  )
);

const SearchResultList = ({
  conditions,
  results,
  highlightTerm,
  onConditionsChange,
  onResultsChange,
  onHighlightChange,
  onFileSelect,
  searchTrigger = 0,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [levelTreeData, setLevelTreeData] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [draftConditions, setDraftConditions] = useState(conditions);
  const [appliedConditionText, setAppliedConditionText] = useState('전체');

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'EXCLUDE', label: '제외' },
  ];

  // 상세 검색 실행 (버튼 클릭/외부 트리거 공통)
  const performDetailSearch = useCallback(
    async (searchConditions) => {
      setAppliedConditionText(searchConditions.selectedPath || '전체');
      const highlightSource = buildHighlightSource(searchConditions);
      if (onHighlightChange) {
        onHighlightChange(highlightSource.trim());
      }

      setIsLoading(true);
      setError(null);

      const payload = {
        leafNodeIds: searchConditions.leafNodeIds,
        drawingNumber: searchConditions.drawingNumber,
        drawingName: searchConditions.drawingName,
        additionalConditions: searchConditions.additionalConditions,
        unlimited: true,
      };

      console.log('[SearchResultList] Running detail search:', payload);

      try {
        const resultsData = await advancedSearch(payload);
        if (onResultsChange) onResultsChange(resultsData);
        console.log('[SearchResultList] Search results:', resultsData.length, 'items');
      } catch (err) {
        setError(err.message || '상세 검색에 실패했습니다.');
        if (onResultsChange) onResultsChange([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onResultsChange, onHighlightChange]
  );

  // 검색 레벨(콤보박스) 초기 데이터 로딩
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        setLevelsLoading(true);
        const data = await fetchSearchLevels();
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
    setDraftConditions(conditions);
  }, [conditions]);

  // 추가 검색조건 행 추가
  const addAdditionalCondition = () => {
    const newId =
      (draftConditions.additionalConditions.length > 0
        ? Math.max(...draftConditions.additionalConditions.map((c) => c.id))
        : 0) + 1;

    setDraftConditions((prev) => ({
      ...prev,
      additionalConditions: [
        ...prev.additionalConditions,
        { id: newId, type: 'ADDITIONAL', term: '', operator: 'AND' },
      ],
    }));
  };

  // 추가 검색조건 삭제
  const removeAdditionalCondition = useCallback(
    (id) => {
      setDraftConditions((prev) => ({
        ...prev,
        additionalConditions: prev.additionalConditions.filter((c) => c.id !== id),
      }));
    },
    []
  );

  // 추가 검색조건 수정
  const updateAdditionalCondition = useCallback((id, field, value) => {
    setDraftConditions((prev) => ({
      ...prev,
      additionalConditions: prev.additionalConditions.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
  }, []);

  const handleOperatorChange = useCallback(
    (id, value) => {
      updateAdditionalCondition(id, 'operator', value);
    },
    [updateAdditionalCondition]
  );

  const handleTermChange = useCallback(
    (id, value) => {
      updateAdditionalCondition(id, 'term', value);
    },
    [updateAdditionalCondition]
  );

  // 검색조건 전체 초기화
  const handleResetAll = () => {
    console.log('[SearchResultList] Resetting all conditions');
    const resetState = {
      leafNodeIds: 'ALL',
      drawingNumber: '',
      drawingName: '',
      additionalConditions: [],
      selectedPath: '전체',
      infoNode: null,
    };

    setDraftConditions(resetState);
    if (onConditionsChange) onConditionsChange(resetState);
    if (onResultsChange) onResultsChange([]);
    if (onHighlightChange) onHighlightChange('');
    setError(null);
  };

  // 검색 실행 (버튼 클릭)
  const performAdvancedSearch = () => {
    const nextConditions = { ...draftConditions };
    if (onConditionsChange) onConditionsChange(nextConditions);
    performDetailSearch(nextConditions);
  };

  // 외부에서 전달된 searchTrigger로 검색 실행 (메인 검색영역과 연동)
  useEffect(() => {
    if (searchTrigger > 0) {
      console.log('[SearchResultList] searchTrigger changed:', searchTrigger);
      console.log(
        '[SearchResultList] firing performDetailSearch with conditions:',
        conditions
      );
      performDetailSearch(conditions);
    }
  }, [searchTrigger, performDetailSearch, conditions]);

  // 트리에서 노드 선택
  const handleLevelSelect = (node) => {
    if (node && node !== 'ALL') {
      const pathArr = getNodePath(levelTreeData, node.id);
      const pathStr = pathArr.join('/');
      const leafNodeIds = collectLeafNodeIds(node);
      setDraftConditions((prev) => ({
        ...prev,
        selectedPath: pathStr,
        infoNode: node,
        leafNodeIds,
        drawingNumber: '',
        drawingName: '',
        additionalConditions: [],
      }));
    } else {
      setDraftConditions((prev) => ({
        ...prev,
        selectedPath: '전체',
        infoNode: null,
        leafNodeIds: 'ALL',
        drawingNumber: '',
        drawingName: '',
        additionalConditions: [],
      }));
    }
  };

  const clearLevelSelection = () => {
    setDraftConditions((prev) => ({
      ...prev,
      selectedPath: '전체',
      infoNode: null,
      leafNodeIds: 'ALL',
      drawingNumber: '',
      drawingName: '',
      additionalConditions: [],
    }));
  };

  const handleDrawingNumberChange = (value) => {
    setDraftConditions((prev) => ({
      ...prev,
      drawingNumber: value,
    }));
  };

  const handleDrawingNameChange = (value) => {
    setDraftConditions((prev) => ({
      ...prev,
      drawingName: value,
    }));
  };

  // 도면 파일 선택
  const handleFileClick = useCallback(
    async (result) => {
      if (onFileSelect) {
        await onFileSelect({ docId: result.DOCNO, docVr: result.DOCVR });
      }
    },
    [onFileSelect]
  );

  const renderSearchConditions = () => {
    let conditionText = null;
    if (conditions.infoNode) {
      const path = getNodePath(levelTreeData, conditions.infoNode.id);
      conditionText = `선택: ${path.join(' / ')}`;
    }

    return (
      <div className="search-conditions">
        <div className="search-conditions-header">
          <h3></h3>
          <button
            className="search-execute-btn"
            onClick={performAdvancedSearch}
            disabled={isLoading}
            title="검색 실행"
          >
            <Search size={16} /> {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>검색 범위 : </label>
          </div>
          <div
            className="term-section-with-remove"
            style={{
              flexGrow: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            {levelsLoading ? (
              <div className="combobox-input-loading">로딩 중...</div>
            ) : (
              <TreeComboBox
                data={levelTreeData}
                onNodeSelect={handleLevelSelect}
                placeholder="전체"
                value={draftConditions.selectedPath}
              />
            )}
            {draftConditions.selectedPath && draftConditions.selectedPath !== '전체' && (
              <button
                type="button"
                className="field-clear-btn"
                onClick={clearLevelSelection}
                title="검색범위 초기화"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>도면번호 : </label>
          </div>
          <div className="term-section-with-remove">
            <input
              type="text"
              value={draftConditions.drawingNumber}
              onChange={(e) => handleDrawingNumberChange(e.target.value)}
              placeholder="도면번호 입력"
              className="term-input"
            />
            {draftConditions.drawingNumber && (
              <button
                type="button"
                className="field-clear-btn"
                onClick={() => handleDrawingNumberChange('')}
                title="도면번호 초기화"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="search-condition-row">
          <div className="type-section">
            <label>도면명 : </label>
          </div>
          <div className="term-section-with-remove">
            <input
              type="text"
              value={draftConditions.drawingName}
              onChange={(e) => handleDrawingNameChange(e.target.value)}
              placeholder="도면명 입력"
              className="term-input"
            />
            {draftConditions.drawingName && (
              <button
                type="button"
                className="field-clear-btn"
                onClick={() => handleDrawingNameChange('')}
                title="도면명 초기화"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 추가 검색조건 리스트 */}
        <div className="conditions-list">
          {draftConditions.additionalConditions.map((condition) => (
            <AdditionalConditionRow
              key={condition.id}
              condition={condition}
              operatorOptions={operatorOptions}
              onOperatorChange={handleOperatorChange}
              onTermChange={handleTermChange}
              onRemove={removeAdditionalCondition}
            />
          ))}
        </div>

        {/* 조건추가 + 전체초기화 버튼 */}
        <div className="search-actions">
          <button
            className="add-condition-btn"
            onClick={addAdditionalCondition}
            title="조건 추가"
          >
            <Plus size={16} />
            <span className="label-full">검색키워드 추가</span>
            <span className="label-compact">키워드추가</span>
          </button>
          <button
            className="reset-all-btn"
            onClick={handleResetAll}
            title="전체 초기화"
          >
            <RotateCcw size={16} />
            <span className="label-full">검색조건 초기화</span>
            <span className="label-compact">초기화</span>
          </button>
        </div>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (isLoading)
      return (
        <div className="search-result-loading">
          <Loader2 className="loading-spinner large" /> 검색 중...
        </div>
      );
    if (error) return <div className="search-result-error">검색 오류: {error}</div>;
    if (!results || results.length === 0)
      return <div className="search-result-no-results">검색 결과가 없습니다.</div>;

    const conditionText = appliedConditionText || '전체';

    return (
      <div className="search-result-list">
        <div className="search-result-title">
          <span className="search-result-condition">
            {conditionText}
          </span>
          <span className="search-result-count">
            검색 결과 ({results.length}건)
          </span>
        </div>
        {results.map((result, idx) => {
          const additionalHighlight = (conditions.additionalConditions || [])
            .map((c) => c.term)
            .filter(Boolean)
            .join(' ');
          const docNumberHighlight = [conditions.drawingNumber, additionalHighlight]
            .filter(Boolean)
            .join(' ');
          const docNameHighlight = [conditions.drawingName, additionalHighlight]
            .filter(Boolean)
            .join(' ');

          return (
            <SearchResultItem
              key={`${result.DOCNO}-${result.DOCVR}-${idx}`}
              result={result}
              docNumberHighlight={docNumberHighlight}
              docNameHighlight={docNameHighlight}
              subHighlight={additionalHighlight}
              onSelect={handleFileClick}
            />
          );
        })}
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

