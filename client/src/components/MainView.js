import React, { useEffect } from 'react';
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
  
  // 🔹 디버깅 로그 추가
  useEffect(() => {
    console.log('🖥️ MainView 렌더링:', {
      isSearchMode,
      searchResultsCount: searchResults?.length || 0,
      openFilesCount: openFiles?.length || 0,
      activeFileId,
      hasOpenFiles: !!(openFiles && openFiles.length > 0)
    });
  }, [isSearchMode, searchResults, openFiles, activeFileId]);

  // 검색 모드이고 검색 결과가 있는 경우
  if (isSearchMode && searchResults && searchResults.length > 0) {
    console.log('🖥️ 검색 모드 렌더링');
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

  // 기존 로직: 열린 파일이 없는 경우 초기 화면
  if (!openFiles || openFiles.length === 0) {
    console.log('🖥️ 초기 화면 렌더링');
    return (
      <main className="app-main-view" onClick={onMainViewClick}>
        <div className="initial-view-content image-combined">
          <img src={intrologo} alt="background" className="background-image" />
          <img src={background} alt="logo" className="intro-logo" />
        </div>
      </main>
    );
  }

  // 기존 로직: 뷰어 모드
  console.log('🖥️ 뷰어 모드 렌더링');
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