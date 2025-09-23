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
  onViewAllResults
}) {
  if (!showPreview) return null;

  // 🔹 클릭 핸들러 개선
  const handleItemClick = (e, result) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🖱️ 미리보기 아이템 클릭됨:', result);
    console.log('🔗 onItemClick 함수 존재 여부:', typeof onItemClick);
    
    if (onItemClick) {
      onItemClick(result);
    } else {
      console.error('❌ onItemClick 함수가 전달되지 않았습니다');
    }
  };

  const handleViewAllClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔍 전체 목록 보기 클릭됨');
    if (onViewAllResults) {
      onViewAllResults();
    }
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
          {/* 🔹 전체 목록 보기 버튼 */}
          <div className="preview-view-all">
            <button 
              className="view-all-button"
              onClick={handleViewAllClick}
              type="button"
            >
              <List size={16} />
              <span>전체 목록 보기 ({results.length}개 이상)</span>
            </button>
          </div>
          {results.map((result) => (
            <div
              key={`${result.KEY}-${result.DOCNO || result.EQUIPMENT}`}
              className="preview-item"
              onClick={(e) => handleItemClick(e, result)}
              onMouseDown={(e) => e.preventDefault()} // 🔹 마우스 다운 이벤트 처리
              role="button" // 🔹 접근성 개선
              tabIndex={0} // 🔹 키보드 접근성
            >
              <div className="preview-main-info">
                <span className="preview-icon">
                  {activeChip === '도면' ? <FileText size={16} /> : <HardDrive size={16} />}
                </span>
                <span className="preview-title">
                  [{highlightText(result.DOCNUMBER, searchTerm)}]{" "}
                  {highlightText(result.DOCNM, searchTerm)}
                </span>
              </div>
              <div className="preview-sub-info">
                <span>
                  {highlightText(result.PLANTNM, searchTerm)}/
                  {highlightText(result.PARENTNM, searchTerm)}/
                  {highlightText(`${result.HOGI_GUBUN}호기`, searchTerm)}
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