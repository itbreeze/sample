// src/components/Search/SearchPreview.js
import React from 'react';
import { FileText, HardDrive, Loader2, List } from 'lucide-react';
import './Search.css';

function SearchPreview({
  results,
  searchTerm,
  isLoading,
  activeChip,
  highlightText,
  showPreview,
  onItemClick,
  onViewAll,
  resultCount,
}) {
  if (!showPreview) return null;

  const handleItemClick = (e, result) => {
    e.preventDefault();
    e.stopPropagation();
    if (onItemClick) onItemClick(result);
  };

  const handleViewAllClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onViewAll) onViewAll();
  };

  // 🔹 건수 표시 텍스트 생성
  const getCountText = () => {
    if (resultCount === 0) return '';
    if (resultCount >= 100) return '(100건 이상)';
    return `(${resultCount}건)`;
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
          {/* 🔹 상세내역보기 버튼 */}
          <div className="preview-view-all">
            <button 
              className="view-all-button"
              onClick={handleViewAllClick}
              title="도면상세검색 탭에서 전체 결과 보기"
            >
              <List size={16} />
              <span>상세내역보기 {getCountText()}</span>
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