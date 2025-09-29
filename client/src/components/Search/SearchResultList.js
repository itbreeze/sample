import React, { useState, useEffect } from 'react';
import { Loader2, Plus, X, Search } from 'lucide-react';
import './SearchResultList.css';

const SearchResultList = ({
  searchInfo = null,
  onFileSelect
}) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [levelOptions, setLevelOptions] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('ALL'); // 'ALL'을 기본값으로 설정
  const [levelsLoading, setLevelsLoading] = useState(true);

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
    const fetchLevels = async () => {
      try {
        setLevelsLoading(true);
        // 서버에 새로 만든 API(/api/search/levels)를 호출합니다.
        const response = await fetch("http://localhost:4000/api/search/levels");
        if (!response.ok) {
          throw new Error('레벨 데이터를 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        // 기본값 '전체' 옵션을 추가하고 상태에 저장합니다.
        setLevelOptions([{ value: 'ALL', label: '전체' }, ...data]);
      } catch (err) {
        console.error(err);
        // 에러 발생 시 기본 옵션만 설정
        setLevelOptions([{ value: 'ALL', label: '전체' }]);
      } finally {
        setLevelsLoading(false);
      }
    };

    fetchLevels();
  }, []);




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
    // 선택된 레벨 정보를 함께 전달합니다.
    performDetailSearch(validConditions, selectedLevel);
  };

const performDetailSearch = async (conditions, level) => {
  // --- ▲▲▲ 3. 검색 실행 함수 수정 ▲▲▲ ---
    setIsLoading(true);
    setError(null);
    try {
      const firstCondition = conditions[0];
      const response = await fetch("http://localhost:4000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // --- ▼▼▼ 4. API 요청 시 Body에 level 정보 추가 ▼▼▼ ---
        body: JSON.stringify({
          searchType: firstCondition.type,
          searchTerm: firstCondition.term,
          level: level, // 선택된 레벨 값을 API Body에 추가
        })
        // --- ▲▲▲ 4. API 요청 시 Body에 level 정보 추가 ▲▲▲ ---
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
      {/* ... 기존 헤더 ... */}
      <div className="search-conditions-header">
          <h3></h3>
          <button className="search-execute-btn" onClick={performAdvancedSearch} disabled={isLoading} title="검색">
              <Search size={16} /> {isLoading ? '검색 중...' : '검색'}
          </button>
      </div>

      {/* 🔹 레벨 선택 콤보박스 추가 */}
      <div className="search-condition-row">
        <div className="type-section">
          <label htmlFor="level-select" style={{ marginRight: '8px', fontWeight: 'bold' }}>사업소</label>          
        </div>
        <div className="term-section-with-remove" style={{ flexGrow: 2 }}>
          <select
            id="level-select"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            disabled={levelsLoading}
            className="type-select"
            style={{ width: '100%' }}
          >
            {levelsLoading ? (
              <option>로딩 중...</option>
            ) : (
              levelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>
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
