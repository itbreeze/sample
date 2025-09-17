// src/components/Search/SearchChips.js
import React from 'react';
import { FileText, HardDrive } from 'lucide-react';
import './Search.css';

// chip 데이터 배열 정의
const chipOptions = [
  { id: '도면', icon: <FileText size={14} />, label: '도면명/도면번호' },
  { id: '설비번호', icon: <HardDrive size={14} />, label: '태그명/설비번호' },
  { id: '통지오더', icon: <HardDrive size={14} />, label: '통지/오더' },
];

function SearchChips({ activeChip, onChipClick, chipOptions }) {
  return (
    <div className="search-actions">
      <div className="chip-buttons">
        {chipOptions.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`chip ${activeChip === id ? 'active' : ''}`}
            onClick={(e) => onChipClick(id, e)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


export default SearchChips;
