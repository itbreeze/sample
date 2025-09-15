// src/components/Search/SearchPreview.js
import React from 'react';
import { FileText, HardDrive, Loader2 } from 'lucide-react';
import './Search.css';

function SearchPreview({ results, searchTerm, isLoading, activeChip, highlightText, showPreview }) {
  if (!showPreview) return null;

  return (
    <div className="search-preview">
      {isLoading ? (
        <div className="preview-loading">
          <Loader2 className="loading-spinner large" />
          <span>검색 중...</span>
        </div>
      ) : results.length > 0 ? (
        <div className="preview-items-wrapper">
          {results.map((result) => (
            <div
              key={`${result.KEY}-${result.DOCNO || result.EQUIPMENT}`}
              className="preview-item"
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
