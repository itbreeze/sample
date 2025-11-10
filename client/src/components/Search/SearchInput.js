// src/components/Search/SearchInput.js

import React from 'react';
import { Search, Loader2, X } from 'lucide-react';
import './Search.css'; 

function SearchInput({ value, onChange, placeholder, isLoading, inputRef, onFocus, onBlur, onClear }) {
  return (
    <div className="search-input-wrapper">
      <Search className="search-icon" size={20} />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        spellCheck={false}
        onChange={onChange}
        onFocus={onFocus} 
        onBlur={onBlur}   
      />
      {value && value.length > 0 && !isLoading && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={() => {
            if (onClear) onClear();
            if (inputRef?.current) inputRef.current.focus();
          }}
          title="검색어 지우기"
        >
          <X size={24} />
        </button>
      )}
      {isLoading && <Loader2 className="loading-spinner" size={20} />}
    </div>
  );
}

export default SearchInput;
