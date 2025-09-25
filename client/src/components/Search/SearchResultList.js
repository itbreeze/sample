import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Plus, X, Search } from 'lucide-react';
import './SearchResultList.css';

const SearchResultList = ({
  searchInfo = null,
  onFileSelect
}) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchConditions, setSearchConditions] = useState([
    { id: 1, type: '도면', term: '', operator: 'AND' }
  ]);

  const searchTypeOptions = [
    { value: '도면', label: '도면명/번호' },
    { value: '설비번호', label: '태그명/설비번호' },
    { value: '통지오더', label: '통지/오더' }
  ];

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  useEffect(() => {
    if (searchInfo && searchInfo.type && searchInfo.term) {
      setSearchConditions([
        { id: 1, type: searchInfo.type, term: searchInfo.term, operator: 'AND' }
      ]);
      performDetailSearch([
        { type: searchInfo.type, term: searchInfo.term, operator: 'AND' }
      ]);
    }
  }, [searchInfo]);

  const addSearchCondition = () => {
    const newId = Math.max(...searchConditions.map(c => c.id), 0) + 1;
    setSearchConditions(prev => [
      ...prev,
      { id: newId, type: '도면', term: '', operator: 'AND' }
    ]);
  };

  const removeSearchCondition = (id) => {
    if (searchConditions.length > 1) {
      setSearchConditions(prev => prev.filter(condition => condition.id !== id));
    }
  };

  const updateSearchCondition = (id, field, value) => {
    setSearchConditions(prev =>
      prev.map(condition => {
        if (condition.id === id) {
          if (field === 'type') {
            return { ...condition, type: value, term: '' };
          }
          return { ...condition, [field]: value };
        }
        return condition;
      })
    );
  };

  const performAdvancedSearch = () => {
    const validConditions = searchConditions.filter(c => c.term.trim());
    if (validConditions.length === 0) {
      alert('검색어를 입력해주세요.');
      return;
    }
    performDetailSearch(validConditions);
  };

  const performDetailSearch = async (conditions) => {
    setIsLoading(true);
    setError(null);
    try {
      const firstCondition = conditions[0];
      const response = await fetch("http://localhost:4000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchType: firstCondition.type,
          searchTerm: firstCondition.term
        })
      });
      if (!response.ok) throw new Error('검색 요청 실패');
      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = async (result) => {
    if (onFileSelect) {
      await onFileSelect({ docId: result.DOCNO, docVr: result.DOCVR });
    }
  };

  const renderSearchConditions = () => (
    <div className="search-conditions">
      <div className="search-conditions-header">
        <h3></h3>
        {/* 검색 버튼 먼저 */}
        <button className="search-execute-btn" onClick={performAdvancedSearch} disabled={isLoading} title="검색">
          <Search size={16} /> {isLoading ? '검색 중...' : '검색'}
        </button>
      </div>
      <div className="conditions-list">
        {searchConditions.map((condition, index) => (
          <div key={condition.id} className="search-condition-row">
            {index > 0 && (
              <div className="operator-section">
                <select
                  value={condition.operator}
                  onChange={(e) => updateSearchCondition(condition.id, 'operator', e.target.value)}
                  className="operator-select"
                >
                  {operatorOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {index === 0 && (
              <div className="type-section">
                <select
                  value={condition.type}
                  onChange={(e) => updateSearchCondition(condition.id, 'type', e.target.value)}
                  className="type-select"
                >
                  {searchTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="term-section-with-remove">
              <input
                type="text"
                value={condition.term}
                onChange={(e) => updateSearchCondition(condition.id, 'term', e.target.value)}
                placeholder="검색어 입력"
                className="term-input"
                onKeyPress={(e) => { if (e.key === 'Enter') performAdvancedSearch(); }}
              />
              {index > 0 && (
                <button
                  className="remove-condition-btn"
                  onClick={() => removeSearchCondition(condition.id)}
                  title="조건 삭제"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* 조건 추가 버튼을 마지막에 */}
      <div className="search-actions">
        <button className="add-condition-btn" onClick={addSearchCondition} title="조건 추가">
          <Plus size={16} /> 검색조건추가
        </button>
      </div>
    </div>
  );

  const renderSearchResults = () => {
    if (isLoading) return <div className="search-result-loading"><Loader2 className="loading-spinner large" /> 검색 중...</div>;
    if (error) return <div className="search-result-error"> 검색 오류: {error}</div>;
    if (searchResults.length === 0) return <div className="search-result-no-results"> 검색 결과 없음</div>;
    return (
      <div className="search-result-list">
        {searchResults.map((result, idx) => (
          <div key={`${result.DOCNO}-${result.DOCVR}-${idx}`} className="search-result-item" onClick={() => handleFileClick(result)}>
            <div className="result-main-info"> [{result.DOCNUMBER}] {result.DOCNM}</div>
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
