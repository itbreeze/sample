// src/components/Search/SearchBar.js
import React, { useState, useRef, useEffect } from 'react';
import SearchInput from './SearchInput';
import SearchChips from './SearchChips';
import SearchPreview from './SearchPreview';
import { searchPreview } from '../../services/search';
import { FileText, HardDrive } from 'lucide-react';
import { highlightText } from './highlightText';
import './Search.css';

function SearchBar({ onFileSelect, onViewAll, previewResultCount, onPreviewCountChange }) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [activeChip, setActiveChip] = useState('도면');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewResults, setPreviewResults] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const chipOptions = [
    {
      id: '도면',
      icon: <FileText size={14} />,
      label: '도면명/도면번호',
      placeholder: '도면명 혹은 도면번호 입력',
    },
    // {
    //   id: '설비번호',
    //   icon: <HardDrive size={14} />,
    //   label: '태그명/설비번호',
    //   placeholder: '태그명 또는 설비번호 입력',
    // },
    // {
    //   id: '통지오더',
    //   icon: <HardDrive size={14} />,
    //   label: '통지/오더',
    //   placeholder: '통지번호 또는 오더번호 입력',
    // },
  ];

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
    if (
      searchContainerRef.current &&
      !searchContainerRef.current.contains(e.relatedTarget)
    ) {
      setSearchExpanded(false);
    }
  };
  const handleSearchContainerMouseEnter = () => setSearchExpanded(true);
  const handleSearchContainerMouseLeave = () => {
    if (
      searchContainerRef.current &&
      !searchContainerRef.current.contains(document.activeElement)
    ) {
      setSearchExpanded(false);
    }
  };

  const handleSearchPreview = async () => {
    try {
      const data = await searchPreview(activeChip, searchTerm);
      setPreviewResults(data);
      // 🔹 미리보기 결과 건수를 상위로 전달
      if (onPreviewCountChange) {
        onPreviewCountChange(data.length);
      }
    } catch (err) {
      console.error('미리보기 검색 실패:', err);
      setPreviewResults([]);
      if (onPreviewCountChange) {
        onPreviewCountChange(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔹 미리보기 아이템 클릭 핸들러
  const handlePreviewItemClick = async (result) => {    
    try {
      if (onFileSelect) {
        await onFileSelect(result);
      }
      // 검색창 닫기
      setSearchExpanded(false);
      setSearchTerm('');
      setPreviewResults([]);
      setShowPreview(false);
    } catch (error) {
      console.error('문서 선택 실패:', error);
    }
  };

  // 🔹 "상세내역보기" 클릭 핸들러
  const handleViewAll = () => {
    if (onViewAll && searchTerm.trim()) {
      onViewAll(searchTerm);
      // 검색창 닫기
      setSearchExpanded(false);
      setSearchTerm('');
      setPreviewResults([]);
      setShowPreview(false);
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
        onClear={() => {
          setSearchTerm('');
          setPreviewResults([]);
          setShowPreview(false);
          setLoading(false);
        }}
      />
      <div className={`search-dropdown ${showPreview ? 'with-preview' : ''}`}>
        <div className="search-actions">
          <SearchChips
            activeChip={activeChip}
            onChipClick={handleChipClick}
            chipOptions={chipOptions}
          />
        </div>
        <SearchPreview
          results={previewResults}
          searchTerm={searchTerm}
          isLoading={loading}
          activeChip={activeChip}
          highlightText={highlightText}
          showPreview={showPreview}
          onItemClick={handlePreviewItemClick}
          onViewAll={handleViewAll}
          resultCount={previewResultCount}
        />
      </div>
    </div>
  );
}

export default SearchBar;