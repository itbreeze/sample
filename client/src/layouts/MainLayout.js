import React from 'react';
import './MainLayout.css';

function MainLayout({ children }) {
  return (
    <div className="app-shell">
      <div className="app-shell__overlay" />
      <div className="app-shell__content">{children}</div>
    </div>
  );
}

export default MainLayout;
