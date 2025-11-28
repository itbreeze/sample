// client/src/components/ViewerContainer.js
import React, { useState, useCallback, useEffect } from 'react';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import SearchResultPanel from './Search/SearchResultPanel';
import { SingleTabs } from './ViewerTabs';
import ViewerPanel from './ViewerPanel';

const MAX_VISIBLE_TABS = 5;

const ViewerContainer = ({
  openFiles = [],
  activeFileId,
  onTabClick,
  onTabClose,
  onCloseAllTabs,
  onTabReorder,
  viewerStates,          // 현재는 사용 안 함
  setViewerStates,       // 현재는 사용 안 함
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionStates, setSelectionStates] = useState({}); // 추후 선택정보 연동용
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    docno: null,
    target: null,
  });

  const handleOpenInNewWindow = () => {
    if (!contextMenu.docno) return;

    const file = openFiles.find(f => f.DOCNO === contextMenu.docno);
    if (!file) return;

    const url = `${window.location.origin}/ePnidSystem/?docno=${file.DOCNO}&docvr=${file.DOCVR}`;

    const width = 1600;
    const height = 900;
    const left = window.screenX + 40;
    const top = window.screenY + 40;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'noopener',
      'noreferrer'
    ].join(',');

    window.open(url, '_blank', features);

    closeContextMenu();
  };


  useEffect(() => {
    try {
      window.viewerTabCount = openFiles.length;
    } catch (_) { }
  }, [openFiles.length]);

  const handleVisibleReorder = useCallback((reorderedDocnos = []) => {
    if (!Array.isArray(reorderedDocnos) || reorderedDocnos.length === 0) return;
    const reorderedFiles = reorderedDocnos
      .map((id) => openFiles.find((f) => f.DOCNO === id))
      .filter(Boolean);
    const rest = openFiles.filter((f) => !reorderedDocnos.includes(f.DOCNO));
    const merged = [...reorderedFiles, ...rest];
    onTabReorder?.(merged, reorderedDocnos[0]);
  }, [openFiles, onTabReorder]);

  const clampMenuPosition = (x, y, menuWidth = 180, menuHeight = 90, margin = 8) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    return {
      x: Math.max(margin, Math.min(x, vw - menuWidth - margin)),
      y: Math.max(margin, Math.min(y, vh - menuHeight - margin)),
    };
  };

  const handleTabContextMenu = (event, docno) => {
    event.preventDefault();
    const { x, y } = clampMenuPosition(event.clientX, event.clientY);
    setContextMenu({
      visible: true,
      x,
      y,
      docno,
      target: 'tab',
    });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  useEffect(() => {
    const hideMenu = () => closeContextMenu();
    window.addEventListener('click', hideMenu);
    window.addEventListener('scroll', hideMenu, true);
    return () => {
      window.removeEventListener('click', hideMenu);
      window.removeEventListener('scroll', hideMenu, true);
    };
  }, [closeContextMenu]);

  const handleCloseCurrent = () => {
    if (contextMenu.docno) {
      onTabClose(contextMenu.docno);
    }
    closeContextMenu();
  };

  const handleCloseAll = () => {
    if (typeof onCloseAllTabs === 'function') {
      onCloseAllTabs();
    } else if (openFiles && openFiles.length) {
      const docnos = openFiles.map((f) => f.DOCNO);
      docnos.forEach((id) => onTabClose(id));
    }
    closeContextMenu();
  };

  const handleSelectFromModal = useCallback((docno) => {
    const newFiles = [...openFiles];
    const selectedFileIndex = newFiles.findIndex(f => f.DOCNO === docno);
    if (selectedFileIndex > -1) {
      const [selectedFile] = newFiles.splice(selectedFileIndex, 1);
      newFiles.unshift(selectedFile);
      onTabReorder(newFiles, docno);
    }
    setIsModalOpen(false);
  }, [openFiles, onTabReorder]);

  const handleTabSelect = (docno) => {
    onTabClick?.(docno);
  };

  const activeDocno = activeFileId || openFiles[0]?.DOCNO || null;

  const renderViewer = () => {
    return (
      <>
        <SingleTabs
          files={openFiles}
          activeId={activeDocno}
          onSelect={handleTabSelect}
          onClose={onTabClose}
          onReorder={handleVisibleReorder}
          onMoreClick={() => setIsModalOpen(true)}
          onContextMenu={(e, docno) => handleTabContextMenu(e, docno)}
          selectionStates={selectionStates}
          maxVisible={MAX_VISIBLE_TABS}
        />

        <div className="viewer-content-area">
          {openFiles.map((file) => {
            const isActiveDoc = file.DOCNO === activeDocno;
            return (
              <ViewerPanel
                key={file.DOCNO}
                file={file}
                selectionInfo={selectionStates[file.DOCNO]}
                isActive={isActiveDoc}
                onReadyChange={undefined}
              />
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="canvas-viewer-container" id="viewer-container">
      {isSearchMode ? (
        <SearchResultPanel results={searchResults} onSelect={onSearchResultClick} />
      ) : (
        renderViewer()
      )}

      {contextMenu.visible && contextMenu.target === 'tab' && (
        <div
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={handleOpenInNewWindow}>새 창에서 열기</button>
          <button type="button" onClick={handleCloseCurrent}>현재 도면 닫기</button>
          <button type="button" onClick={handleCloseAll}>모든 도면 닫기</button>
        </div>
      )}

      {!isSearchMode && (
        <TabListModal
          isOpen={isModalOpen}
          files={openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(MAX_VISIBLE_TABS) : []}
          onClose={() => setIsModalOpen(false)}
          onSelectTab={handleSelectFromModal}
          onCloseTab={onTabClose}
        />
      )}
    </div>
  );
};

export default ViewerContainer;
