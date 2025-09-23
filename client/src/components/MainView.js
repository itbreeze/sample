import React from 'react';
import ViewerContainer from './ViewerContainer'; 
import './MainView.css';

const MainView = ({ onMainViewClick, ...props }) => {
  if (!props.openFiles || props.openFiles.length === 0) {
    return (
      <main className="app-main-view" onClick={onMainViewClick}>
        <div className="initial-view-content">
          <h2>Intelligent Tool</h2>
          <p>좌측 메뉴에서 도면을 선택하여 열어주세요.</p>
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