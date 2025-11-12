// src/components/Search/SearchPreview.js
import React from 'react';
import { FileText, HardDrive, Loader2, Search } from 'lucide-react';
import './Search.css';

function SearchPreview({
  results,
  searchTerm,
  isLoading,
  activeChip,
  highlightText,
  showPreview,
  onItemClick,
  onViewDetailSearch,
}) {
  if (!showPreview) return null;

  const handleViewDetailSearch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onViewDetailSearch && searchTerm.trim()) {
      onViewDetailSearch(activeChip, searchTerm); // 검색타입, 검색어 전달
    }
  };

  const handleItemClick = (e, result) => {
    e.preventDefault();
    e.stopPropagation();
    if (onItemClick) onItemClick(result);
  };

  return (
    <div className="search-preview">
      {isLoading ? (
        <div className="preview-loading">
          <Loader2 className="loading-spinner large" />
          <span>검색 중...</span>
        </div>
      ) : results.length > 0 ? (
        <div className="preview-items-wrapper">
          {/* 전체 목록 보기 버튼 */}
          <div className="preview-view-all">
            <button
              className="view-all-button"
              onClick={handleViewDetailSearch}
              type="button"
            >
              <Search size={16} />
              <span>
                상세 검색 보기 ({results.length}
                {results.length >= 100 ? '개 이상' : '개'})
              </span>
            </button>
          </div>

          {/* 검색 결과 목록 */}
          {results.map((result) => (
            <div
              key={`${result.KEY}-${result.DOCNO || result.EQUIPMENT}`}
              className="preview-item"
              onClick={(e) => handleItemClick(e, result)}
              onMouseDown={(e) => e.preventDefault()}
              role="button"
              tabIndex={0}
            >
              <div className="preview-main-info">
                <span className="preview-icon">
                  {activeChip === '도면' ? (
                    <FileText size={16} />
                  ) : (
                    <HardDrive size={16} />
                  )}
                </span>
                <span className="preview-title">
                  [{highlightText(result.DOCNUMBER, searchTerm)}]
                  {highlightText(result.DOCNM, searchTerm)}
                </span>
              </div>
              <div className="preview-sub-info">
                <span>
                  {highlightText(result.PLANTNM, searchTerm)}/
                  {highlightText(result.PARENTNM, searchTerm)}/
                  {highlightText(result.HOGI_LABEL || result.HOGI_GUBUN, searchTerm)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        searchTerm && (
          <div className="preview-no-results-message">❌ 검색 결과 없음</div>
        )
      )}
    </div>
  );
}

export default SearchPreview;
