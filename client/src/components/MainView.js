import React from 'react';
import ViewerContainer from './ViewerContainer';
import './MainView.css';

import background from '../assets/images/intro-logo.png';
import intrologo from '../assets/images/bg.webp';

const MainView = ({ onMainViewClick, ...props }) => {
  if (!props.openFiles || props.openFiles.length === 0) {
    return (
      <main className="app-main-view" onClick={onMainViewClick}>
        <div className="initial-view-content image-combined">
          <img src={intrologo} alt="background" className="background-image" /> {/* 배경 */}
          <img src={background} alt="logo" className="intro-logo" />             {/* 중앙 로고 */}
        </div>


      </main>
    );
  }

  return (
    <main className="app-main-view" onClick={onMainViewClick}>
      <ViewerContainer {...props} />
    </main>
  );
};

export default MainView;
