// client/src/components/ViewerWorkspace.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import './ViewerWorkspace.css';
import SearchResultPanel from '../../components/Search/SearchResultPanel';
import { SingleTabs } from './ViewerTabList';
import ViewerCanvasHeader from './ViewerCanvasHeader';

const MAX_VISIBLE_TABS = 5;

const ViewerWorkspace = ({
  openFiles = [],
  activeFileId,
  onTabClick,
  onTabClose,
  onCloseAllTabs,
  onCloseAllTabsMenu = () => {},
  onTabReorder,
  tabOrder = [],
  viewerStates,          // 현재는 사용 안 함
  setViewerStates,       // 현재는 사용 안 함
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick,
  highlightMap = {},
  isFavorite = false,
  onToggleFavorite,
  onDocumentReady,
  allowEntityPanel = true,
  allowEquipmentInfoPanel = true,
  viewerMode = 'ViewerMode',
}) => {
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

  const orderedFiles = useMemo(() => {
    const fileMap = new Map(openFiles.map((file) => [file.DOCNO, file]));
    const seen = new Set();
    const ordered = [];

    tabOrder.forEach((docno) => {
      const file = fileMap.get(docno);
      if (file && !seen.has(docno)) {
        seen.add(docno);
        ordered.push(file);
      }
    });

    openFiles.forEach((file) => {
      if (!seen.has(file.DOCNO)) {
        seen.add(file.DOCNO);
        ordered.push(file);
      }
    });

    return ordered;
  }, [tabOrder, openFiles]);

  const handleVisibleReorder = useCallback((reorderedDocnos = [], draggedDocId) => {
    if (!Array.isArray(reorderedDocnos) || reorderedDocnos.length === 0) return;
    const visibleDocnos = orderedFiles.slice(0, MAX_VISIBLE_TABS).map((file) => file.DOCNO);
    const visibleSet = new Set(visibleDocnos);
    const filtered = reorderedDocnos.filter((docno) => visibleSet.has(docno));
    if (filtered.length === 0) return;
    const rest = tabOrder.filter((docno) => !visibleSet.has(docno));
    const merged = [
      ...filtered,
      ...rest.filter((docno) => !filtered.includes(docno)),
    ];
    const fallback = openFiles
      .map((file) => file.DOCNO)
      .filter((docno) => !merged.includes(docno));
    const finalOrder = [...merged, ...fallback];
    onTabReorder?.(finalOrder, draggedDocId);
  }, [orderedFiles, tabOrder, openFiles, onTabReorder]);

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
    if (typeof onCloseAllTabsMenu === 'function') {
      onCloseAllTabsMenu();
    }
    closeContextMenu();
  };

  const handleTabSelect = (docno) => {
    onTabClick?.(docno);
  };

  const activeDocno = activeFileId || orderedFiles[0]?.DOCNO || null;

  const visibleTabs = orderedFiles.slice(0, MAX_VISIBLE_TABS);

  const renderViewer = () => {
    return (
      <>
        <SingleTabs
          files={visibleTabs}
          activeId={activeDocno}
          onSelect={handleTabSelect}
          onClose={onTabClose}
          onReorder={handleVisibleReorder}
          onContextMenu={(e, docno) => handleTabContextMenu(e, docno)}
          selectionStates={selectionStates}
        />

        <div className="viewer-content-area">
        {openFiles.map((file) => {
          const isActiveDoc = file.DOCNO === activeDocno;
          const docHighlight = highlightMap[file.DOCNO] || {};
          const handlesForDoc = docHighlight.handles || [];
          const highlightColorForDoc = docHighlight.highlightColor;
          const highlightHandles = isActiveDoc ? handlesForDoc : [];
          const highlightColor = isActiveDoc ? highlightColorForDoc : undefined;
          return (
            <ViewerCanvasHeader
              key={file.DOCNO}
              file={file}
              selectionInfo={selectionStates[file.DOCNO]}
              isActive={isActiveDoc}
              highlightHandles={highlightHandles}
              highlightColor={highlightColor}
              onReadyChange={onDocumentReady}
              isFavorite={isActiveDoc ? isFavorite : false}
              onToggleFavorite={isActiveDoc ? onToggleFavorite : undefined}
              allowEntityPanel={allowEntityPanel}
              allowEquipmentInfoPanel={allowEquipmentInfoPanel}
              viewerMode={viewerMode}
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

      {!isSearchMode && null}
    </div>
  );
};

export default ViewerWorkspace;
