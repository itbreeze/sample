import React from 'react';
import { FileText } from 'lucide-react';
import { highlightText } from './highlightText';

const truncateDocNumber = (value, limit = 10) => {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
};

const SearchResultPanel = ({ results = [], onSelect, highlightTerm = '' }) => (
  <div className="search-results-container">
    <div className="search-results-header">
      <h3>검색 결과 ({results.length}개)</h3>
    </div>
    <div className="search-results-list">
      {results.map((result, index) => (
        <div
          key={`${result.KEY}-${result.DOCNO || result.EQUIPMENT}-${index}`}
          className="search-result-item"
          onClick={() => onSelect && onSelect(result)}
        >
          <div className="result-main-info">
            <FileText size={16} className="result-icon" />
            <span className="result-title">
              [<span title={result.DOCNUMBER || ''}>{highlightText(truncateDocNumber(result.DOCNUMBER), highlightTerm)}</span>]{' '}
              {highlightText(result.DOCNM, highlightTerm)}
            </span>
          </div>
          <div className="result-sub-info">
            <span>  
              {highlightText(result.PLANTNM, highlightTerm)}/
              {highlightText(result.PARENTNM, highlightTerm)}/
              {highlightText(result.HOGI_GUBUN, highlightTerm)}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SearchResultPanel;
