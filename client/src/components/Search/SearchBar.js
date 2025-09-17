// src/components/Search/SearchBar.js
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import SearchInput from './SearchInput';
import SearchChips from './SearchChips';
import SearchPreview from './SearchPreview';
import { FileText, HardDrive } from 'lucide-react';
import './Search.css';

function SearchBar() {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [activeChip, setActiveChip] = useState('도면');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewResults, setPreviewResults] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // 🔹 chip 옵션 배열 정의
  const chipOptions = [
    { id: '도면', icon: <FileText size={14} />, label: '도면명/도면번호', placeholder: '도면명 혹은 도면번호 입력' },
    { id: '설비번호', icon: <HardDrive size={14} />, label: '태그명/설비번호', placeholder: '태그명 또는 설비번호 입력' },
    { id: '통지오더', icon: <HardDrive size={14} />, label: '통지/오더', placeholder: '통지번호 또는 오더번호 입력' },
  ];

  // 🔹 정규식 escape 함수
  const escapeRegExp = (string) =>
    string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 🔹 highlightText 함수
  const highlightText = useMemo(
    () => (text, highlight) => {
      if (!highlight || !text) return text;
      const highlights = highlight.split(/\s+/).filter(Boolean);

      let processedText = [text];

      highlights.forEach((h, hIdx) => {
        const safeH = escapeRegExp(h);
        const regex = new RegExp(`(${safeH})`, 'gi');

        processedText = processedText.flatMap((chunk, idx) => {
          if (typeof chunk !== 'string') return chunk;
          return chunk.split(regex).map((part, i) =>
            part.toLowerCase() === h.toLowerCase() ? (
              <mark key={`${hIdx}-${idx}-${i}`}>{part}</mark>
            ) : (
              part
            )
          );
        });
      });

      return processedText;
    },
    []
  );

  useEffect(() => {
    if (!searchTerm.trim()) {
      setShowPreview(false);
      setPreviewResults([]);
      setLoading(false);
      return;
    }

    setShowPreview(true);
    setLoading(true);

    const delayDebounceFn = setTimeout(() => {
      handleSearchPreview();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeChip]);

  const handleChipClick = (chipName, event) => {
    event.preventDefault();
    setActiveChip(chipName);
    setSearchTerm('');
    setPreviewResults([]);
    setShowPreview(false);
    setLoading(false);

    setSearchExpanded(true);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearchContainerFocus = () => setSearchExpanded(true);
  const handleSearchContainerBlur = (e) => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.relatedTarget)) {
      setSearchExpanded(false);
    }
  };
  const handleSearchContainerMouseEnter = () => setSearchExpanded(true);
  const handleSearchContainerMouseLeave = () => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(document.activeElement)) {
      setSearchExpanded(false);
    }
  };

  const handleSearchPreview = async () => {
    try {
      const response = await axios.post('/api/search', {
        searchType: activeChip,
        searchTerm: searchTerm,
      });
      setPreviewResults(response.data);
    } catch (err) {
      console.error('미리보기 검색 실패:', err);
      setPreviewResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 현재 chip의 placeholder 찾기
  const activeChipOption = chipOptions.find((chip) => chip.id === activeChip);
  const placeholderText = activeChipOption?.placeholder || '검색어를 입력하세요';

  return (
    <div
      ref={searchContainerRef}
      className={`search-container ${searchExpanded ? 'expanded' : ''}`}
      onFocus={handleSearchContainerFocus}
      onBlur={handleSearchContainerBlur}
      onMouseEnter={handleSearchContainerMouseEnter}
      onMouseLeave={handleSearchContainerMouseLeave}
    >
      <SearchInput
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholderText}
        isLoading={loading}
        inputRef={searchInputRef}
      />
      <div className={`search-dropdown ${showPreview ? 'with-preview' : ''}`}>
        <SearchChips
          activeChip={activeChip}
          onChipClick={handleChipClick}
          chipOptions={chipOptions} // 🔹 props로 전달
        />
        <SearchPreview
          results={previewResults}
          searchTerm={searchTerm}
          isLoading={loading}
          activeChip={activeChip}
          highlightText={highlightText}
          showPreview={showPreview}
        />
      </div>
    </div>
  );
}

export default SearchBar;
