import React from 'react';
import ViewerWorkspace from './ViewerWorkspace';
import './ViewerShellLayout.css';
import { useViewer } from '../context/ViewerContext';
import background from '../../assets/images/intro-logo.png';
import intrologo from '../../assets/images/bg.webp';

const ViewerShell = ({ onMainViewClick = () => {} }) => {
  const {
    openFiles,
    activeFileId,
    handleTabClick,
    handleTabClose,
    handleCloseAllTabs,
    handleTabReorder,
    handleViewerReady,
    handleViewStateChange,
    isActiveDocFavorite,
    handleToggleFavorite,
  } = useViewer();

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
      <ViewerWorkspace
        openFiles={openFiles}
        activeFileId={activeFileId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabReorder={handleTabReorder}
        onCloseAllTabs={handleCloseAllTabs}
        onViewerReady={handleViewerReady}
        onViewStateChange={handleViewStateChange}
        isFavorite={isActiveDocFavorite}
        onToggleFavorite={handleToggleFavorite}
      />
    </main>
  );
};

export default ViewerShell;
