import React from 'react';
import ViewerContainer from './ViewerContainer';
import './MainView.css';

import background from '../assets/images/intro-logo.png';
import intrologo from '../assets/images/bg.webp';

const MainView = ({ 
  onMainViewClick, 
  searchResults, 
  isSearchMode, 
  onSearchResultClick,
  openFiles,
  activeFileId,
  ...props 
}) => {
  // 검색 모드이고 검색 결과가 있는 경우
  if (isSearchMode && searchResults && searchResults.length > 0) {
    return (
      <main className="app-main-view" onClick={onMainViewClick}>
        <ViewerContainer 
          {...props}
          openFiles={openFiles}
          activeFileId={activeFileId}
          searchResults={searchResults}
          isSearchMode={true}
          onSearchResultClick={onSearchResultClick}
        />
      </main>
    );
  }

  // 열린 파일이 없는 경우 초기 화면
  if (!openFiles || openFiles.length === 0) {
    return (
      <main className="app-main-view" onClick={onMainViewClick}>
        <div className="initial-view-content image-combined">
          <img src={intrologo} alt="background" className="background-image" />
          <img src={background} alt="logo" className="intro-logo" />
        </div>
      </main>
    );
  }

  // 일반 뷰어 모드
  return (
    <main className="app-main-view" onClick={onMainViewClick}>
      <ViewerContainer 
        {...props} 
        openFiles={openFiles}
        activeFileId={activeFileId}
        isSearchMode={false}
      />
    </main>
  );
};

export default MainView;
