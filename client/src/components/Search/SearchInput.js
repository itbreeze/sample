// src/components/Search/SearchInput.js
import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import './Search.css'; // SearchBar와 공유할 CSS 파일 (나중에 생성)

function SearchInput({ value, onChange, placeholder, isLoading, inputRef, onFocus, onBlur }) {
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
      {isLoading && <Loader2 className="loading-spinner" size={20} />}
    </div>
  );
}

export default SearchInput;