// src/components/Header.js
import React from 'react';
import './Header.css';
import logo from '../assets/images/logo.png';
import { HeaderTabs } from './common/HeaderTabs';
import SearchBar from './Search/SearchBar';

function Header({ tabItems, activeTab, setActiveTab, onLogoClick, onFileSelect, onViewAllSearch, previewResultCount, onPreviewCountChange }) {
  return (
    <header className="app-header">
      {/* 1. 로고 영역 - 클릭 이벤트를 추가하고 커서 스타일을 변경 */}
      <div className="header-left" onClick={onLogoClick} style={{ cursor: 'pointer' }} title="전체화면" role="button" aria-label="전체화면">
        <img src={logo} className="header-logo" alt="logo" />
      </div>

      {/* 2. 탭 영역 Wrapper */}
      <div className="header-tabs-wrapper">
        <HeaderTabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* 3. 검색바 영역 Wrapper */}
      <div className="header-search-wrapper">
        <SearchBar
          onFileSelect={onFileSelect}
          onViewAll={onViewAllSearch}
          previewResultCount={previewResultCount}
          onPreviewCountChange={onPreviewCountChange}
        />
      </div>
    </header>
  );
}

export default Header;
