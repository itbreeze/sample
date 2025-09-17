// src/components/Search/SearchChips.js
import React from 'react';
import './Search.css';

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