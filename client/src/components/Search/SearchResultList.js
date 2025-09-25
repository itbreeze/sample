import React from 'react';
import { FileText } from 'lucide-react';
import './Search.css';

const SearchResultList = ({ 
  searchResults = [], 
  searchInfo = null, // { type, term } 정보
  onFileSelect 
}) => {

  // 검색 정보가 없는 경우 - 초기 상태
  if (!searchInfo) {
    return (
      <div className="search-result-empty">
        <FileText size={48} className="empty-icon" />
        <p>검색바에서 "상세검색에서 보기"를 클릭하면</p>
        <p>전체 검색 결과가 여기에 표시됩니다.</p>
      </div>
    );
  }

  // 검색 결과가 있는 경우
  if (searchResults.length > 0) {
    return (
      <div className="search-result-container">
        {/* 검색 정보 헤더 */}
        <div className="search-result-header">
          <div className="search-info">
            <span className="search-type-badge">{searchInfo.type}</span>
            <span className="search-term">"{searchInfo.term}"</span>
            <span className="result-count">({searchResults.length}개 결과)</span>
          </div>
        </div>

        {/* 결과 목록 */}
        <div className="search-result-list">
          {searchResults.map((result, index) => (
            <div
              key={`${result.DOCNO}-${result.DOCVR}-${index}`}
              className="search-result-item"
              onClick={() => onFileSelect({ docId: result.DOCNO, docVr: result.DOCVR })}
            >
              <div className="result-main-info">
                <FileText size={16} className="result-icon" />
                <span className="result-title">
                  [{result.DOCNUMBER}] {result.DOCNM}
                </span>
              </div>
              <div className="result-sub-info">
                {result.PLANTNM} / {result.PARENTNM} / {result.HOGI_GUBUN}호기
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 검색 결과가 없는 경우
  return (
    <div className="search-result-no-results">
      <FileText size={48} className="empty-icon" />
      <p><strong>"{searchInfo.term}"</strong>에 대한</p>
      <p><strong>{searchInfo.type}</strong> 검색 결과가 없습니다.</p>
    </div>
  );
};

export default SearchResultList;