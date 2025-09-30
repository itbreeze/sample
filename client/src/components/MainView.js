// client/src/components/MainView.js
import React from 'react';
import ViewerContainer from './ViewerContainer';
import './MainView.css';

import background from '../assets/images/intro-logo.png';
import intrologo from '../assets/images/bg.webp';

const MainView = ({ 
  onMainViewClick, 
  openFiles,
  activeFileId,
  onTabClick,
  onTabClose,
  onTabReorder
}) => {
  
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

  return (
    <main className="app-main-view" onClick={onMainViewClick}>
      <ViewerContainer 
        openFiles={openFiles}
        activeFileId={activeFileId}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onTabReorder={onTabReorder}
      />
    </main>
  );
};

export default MainView;