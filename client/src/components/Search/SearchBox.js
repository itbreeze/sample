import React, { useState } from 'react';
import { Search } from 'lucide-react';

const SearchBox = ({ onSearch, placeholder = "검색..." }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  };

  return (
    <div className="search-box">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="search-input"
          />
          <button type="submit" className="search-button">
            검색
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchBox;