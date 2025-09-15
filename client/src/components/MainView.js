import React from 'react';
import './MainView.css';

function MainView({ currentTab }) {
  if (!currentTab) {
    return (
      <main className="app-main-view">
        <div className="main-view-content">
          <h2>환영합니다!</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main-view">
      <div className="main-view-content">
        <h2>{currentTab.label} 뷰</h2>
      </div>
    </main>
  );
}

export default MainView;