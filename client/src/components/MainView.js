import React from 'react';
import ViewerContainer from './ViewerContainer';
import './MainView.css';

import background from '../assets/images/intro-logo.png';
import intrologo from '../assets/images/bg.webp';

const MainView = ({ 
  onMainViewClick, 
  openFiles,
  activeFileId,
  ...props 
}) => {
  
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
      />
    </main>
  );
};

export default MainView;