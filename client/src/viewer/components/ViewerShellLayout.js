import React from 'react';
import ViewerWorkspace from './ViewerWorkspace';
import './ViewerShellLayout.css';
import { useViewer } from '../context/ViewerContext';
import background from '../../assets/images/intro-logo.png';
import intrologo from '../../assets/images/bg.webp';

const ViewerShell = ({
  onMainViewClick = () => {},
  allowEntityPanel = true,
  allowEquipmentInfoPanel = true,
  viewerMode = 'ViewerMode',
  onCloseAllTabsMenu = () => {},
}) => {
  const {
    openFiles,
    activeFileId,
    handleTabClick,
    handleTabClose,
    handleCloseAllTabs,
    handleTabReorder,
    handleDocumentReady,
    handleViewStateChange,
    isActiveDocFavorite,
    handleToggleFavorite,
    docHighlights,
    tabOrder,
  } = useViewer();

  const handleAuxClick = (event) => {
    if (event.button === 1) {
      onMainViewClick(event);
    }
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    onMainViewClick(event);
  };

  if (!openFiles || openFiles.length === 0) {
    return (
      <main
        className="app-main-view"
        onClick={onMainViewClick}
        onAuxClick={handleAuxClick}
        onContextMenu={handleContextMenu}
      >
        <div className="initial-view-content image-combined">
          <img src={intrologo} alt="background" className="background-image" />
          <img src={background} alt="logo" className="intro-logo" />
        </div>
      </main>
    );
  }

  return (
    <main
      className="app-main-view"
      onClick={onMainViewClick}
      onAuxClick={handleAuxClick}
      onContextMenu={handleContextMenu}
    >
      <ViewerWorkspace
        openFiles={openFiles}
        activeFileId={activeFileId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabReorder={handleTabReorder}
        onCloseAllTabs={handleCloseAllTabs}
        onCloseAllTabsMenu={onCloseAllTabsMenu}
        onDocumentReady={handleDocumentReady}
        onViewStateChange={handleViewStateChange}
        isFavorite={isActiveDocFavorite}
        onToggleFavorite={handleToggleFavorite}
        highlightMap={docHighlights}
        tabOrder={tabOrder}
        viewerMode={viewerMode}
        allowEntityPanel={allowEntityPanel}
        allowEquipmentInfoPanel={allowEquipmentInfoPanel}
      />
    </main>
  );
};

export default ViewerShell;
