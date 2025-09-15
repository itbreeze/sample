// src/components/Search/SearchChips.js
import React from 'react';
import { FileText, HardDrive } from 'lucide-react';
import './Search.css'; // SearchBar와 공유할 CSS 파일

function SearchChips({ activeChip, onChipClick }) {
  return (
    <div className="search-actions">
      <div className="chip-buttons">
        <button
          className={`chip ${activeChip === '도면' ? 'active' : ''}`}
          onClick={(e) => onChipClick('도면', e)}
        >
          <FileText size={14} />
          <span>도면명/도면번호</span>
        </button>
        <button
          className={`chip ${activeChip === '설비번호' ? 'active' : ''}`}
          onClick={(e) => onChipClick('설비번호', e)}
        >
          <HardDrive size={14} />
          <span>태그명/설비번호</span>
        </button>
      </div>
    </div>
  );
}

export default SearchChips;