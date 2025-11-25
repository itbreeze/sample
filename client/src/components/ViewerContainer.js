// client/src/components/ViewerContainer.js
import React, { useState, useCallback, useEffect } from 'react';
import { X as CloseIcon, MoreHorizontal } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import Canvas from './viewer/Canvas';
import SearchResultPanel from './Search/SearchResultPanel';

const MAX_VISIBLE_TABS = 5;

const ViewerContainer = ({
  openFiles = [],
  activeFileId,
  onTabClick,
  onTabClose,
  onCloseAllTabs,
  onTabReorder,
  viewerStates,          // DOCNO -> {zoom, pan, camera, ...}
  setViewerStates,       // 상태 업데이트 콜백
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionStates, setSelectionStates] = useState({}); // DOCNO -> { handles: [], count: 0 }
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, docno: null, target: null });

  // drag&drop 탭 재정렬
  const handleOnDragEnd = useCallback((result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const newFiles = Array.from(openFiles);
    const [reorderedItem] = newFiles.splice(result.source.index, 1);
    newFiles.splice(result.destination.index, 0, reorderedItem);
    onTabReorder(newFiles, reorderedItem.DOCNO);
  }, [openFiles, onTabReorder]);

  // 선택 상태 업데이트 (Docno 기준)
  const handleSelectionChange = useCallback((docno, handles, screenBox, additive, mode) => {
    setSelectionStates(prev => ({
      ...prev,
      [docno]: {
        handles,
        count: handles.length,
        screenBox,
        additive,
        mode
      }
    }));
  }, []);

  // 모달에서 탭 선택
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

  const handleMoreContextMenu = (event) => {
    event.preventDefault();
    const { x, y } = clampMenuPosition(event.clientX, event.clientY);
    setContextMenu({
      visible: true,
      x,
      y,
      docno: null,
      target: 'more',
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

  const handleCloseHiddenTabs = () => {
    const hiddenFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(MAX_VISIBLE_TABS) : [];
    hiddenFiles.forEach((f) => onTabClose(f.DOCNO));
    closeContextMenu();
  };

  // 뷰어 렌더링
  const renderViewer = () => {
    const visibleFiles = openFiles.length > MAX_VISIBLE_TABS
      ? openFiles.slice(0, MAX_VISIBLE_TABS)
      : openFiles;
    const hiddenFiles = openFiles.length > MAX_VISIBLE_TABS
      ? openFiles.slice(MAX_VISIBLE_TABS)
      : [];

    return (
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <div className="view-tabs-container">
          <Droppable droppableId="tabs" direction="horizontal">
            {(provided) => (
              <div
                className="visible-tabs-wrapper"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {visibleFiles.map((file, index) => {
                  const selectionInfo = selectionStates[file.DOCNO];
                  const selectionCount = selectionInfo?.count || 0;

                  return (
                    <Draggable key={file.DOCNO} draggableId={file.DOCNO.toString()} index={index}>
                      {(providedDrag, snapshot) => (
                        <div
                          ref={providedDrag.innerRef}
                          {...providedDrag.draggableProps}
                          {...providedDrag.dragHandleProps}
                          className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                          onClick={() => onTabClick(file.DOCNO)}
                          onContextMenu={(e) => handleTabContextMenu(e, file.DOCNO)}
                          title={`${file.DOCNM || file.DOCNUMBER}${selectionCount > 0 ? ` (선택: ${selectionCount})` : ''}`}
                        >
                          <span className="tab-title">
                            {file.DOCNM || file.DOCNUMBER}
                            {selectionCount > 0 && <span className="selection-badge">{selectionCount}</span>}
                          </span>
                          <button
                            className="close-tab-btn"
                            onClick={(e) => { e.stopPropagation(); onTabClose(file.DOCNO); }}
                          >
                            <CloseIcon size={14} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {hiddenFiles.length > 0 && (
            <div
              className="view-tab more-tabs-btn"
              onClick={() => setIsModalOpen(true)}
              onContextMenu={handleMoreContextMenu}
              title={`더보기 (${hiddenFiles.length})`}
            >
              더보기 + {hiddenFiles.length}
            </div>
          )}
        </div>

        <div className="viewer-content-area">
          {openFiles.length > 0 ? (
            <>
              {openFiles.map((file) => {
                if (!file) return null;
                const selectionInfo = selectionStates[file.DOCNO];

                return (
                  <div
                    key={`${file.DOCNO}-${file.tmpFile}`}
                    className="viewer-wrapper"
                    style={{ display: file.DOCNO === activeFileId ? 'flex' : 'none' }}
                  >
                    <div className="viewer-header">
                      <h2 className="viewer-title">
                        {`${file.PLANTNM} / ${file.UNIT}호기 / [${file.DOCNUMBER}] ${file.DOCNM}`}
                      </h2>
                      {selectionInfo && selectionInfo.count > 0 && (
                        <div className="selection-info">
                          선택: {selectionInfo.count}
                          {selectionInfo.mode && ` (${selectionInfo.mode === 'window' ? 'Window' : 'Crossing'})`}
                        </div>
                      )}
                    </div>
                    <Canvas
                      filePath={file.tmpFile}
                      isActive={file.DOCNO === activeFileId}
                      key={`${file.DOCNO}-${file.tmpFile}`}
                    />
                  </div>
                );
              })}
            </>
          ) : (
            <div className="initial-view-content">
              <p>좌측/검색에서 도면을 선택해주세요.</p>
            </div>
          )}
        </div>
      </DragDropContext>
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
          <button type="button" onClick={handleCloseCurrent}>현재 도면 닫기</button>
          <button type="button" onClick={handleCloseAll}>모든 도면 닫기</button>
        </div>
      )}
      {contextMenu.visible && contextMenu.target === 'more' && (
        <div
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={handleCloseHiddenTabs}>더보기 도면 모두 닫기</button>
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
