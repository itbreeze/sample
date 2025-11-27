// client/src/components/ViewerContainer.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import SearchResultPanel from './Search/SearchResultPanel';
import { SingleTabs, PanelTabs } from './ViewerTabs';
import ViewerPanel from './ViewerPanel';
import ViewerSplitMenu from './ViewerSplitMenu';

const MAX_VISIBLE_TABS = 5;
const DEFAULT_SPLIT_RATIO = 0.5;
const MIN_SPLIT_RATIO = 0.2;
const MAX_SPLIT_RATIO = 0.85;

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
  onSearchResultClick,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionStates, setSelectionStates] = useState({}); // DOCNO -> { handles: [], count: 0 }
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, docno: null, target: null });
  const [viewerReadyMap, setViewerReadyMap] = useState({}); // DOCNO -> boolean
  const [splitStateMap, setSplitStateMap] = useState({}); // DOCNO -> { enabled: bool, ratio: number }
  const [splitActiveSlotMap, setSplitActiveSlotMap] = useState({}); // DOCNO -> 'left' | 'right'
  const splitContainerRef = useRef(null);

  useEffect(() => {
    try {
      window.viewerTabCount = openFiles.length;
    } catch (_) {}
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

  const handleViewerReadyChange = useCallback((docno, isReady) => {
    if (!docno) return;
    setViewerReadyMap((prev) => {
      const next = !!isReady;
      if (prev[docno] === next) return prev;
      return { ...prev, [docno]: next };
    });
  }, []);

  const handleToggleSplit = useCallback((docno) => {
    if (!docno || openFiles.length <= 1) return;
    setSplitStateMap((prev) => {
      const current = prev[docno] || {};
      const firstDocno = openFiles[0]?.DOCNO || docno;
      const rightDocnoCandidate = openFiles.find((f) => f.DOCNO !== firstDocno)?.DOCNO || firstDocno;
      const turningOn = !current.enabled;
      const next = {
        enabled: turningOn,
        ratio: turningOn ? DEFAULT_SPLIT_RATIO : current.ratio ?? DEFAULT_SPLIT_RATIO,
        leftDocno: current.leftDocno || firstDocno,
        rightDocno: current.rightDocno || rightDocnoCandidate,
      };
      return { ...prev, [docno]: next };
    });
    setSplitActiveSlotMap((prev) => {
      if (prev[docno]) return prev;
      return { ...prev, [docno]: 'left' };
    });
  }, [openFiles]);

  const setActiveSlot = useCallback((docno, slot) => {
    if (!docno || (slot !== 'left' && slot !== 'right')) return;
    setSplitActiveSlotMap((prev) => ({ ...prev, [docno]: slot }));
  }, []);

  const assignSlotDoc = useCallback((targetDocno, slot) => {
    const docno = activeFileId || openFiles[0]?.DOCNO;
    if (!docno || !targetDocno || (slot !== 'left' && slot !== 'right')) return;
    setSplitStateMap((prev) => {
      const current = prev[docno] || { enabled: true, ratio: DEFAULT_SPLIT_RATIO };
      const key = slot === 'left' ? 'leftDocno' : 'rightDocno';
      return {
        ...prev,
        [docno]: {
          ...current,
          enabled: true,
          [key]: targetDocno,
        },
      };
    });
    setActiveSlot(docno, slot);
  }, [activeFileId, openFiles, setActiveSlot]);

  // 열린 탭 목록이 변하면 슬롯에 배정된 탭이 닫혔을 때 교체
  useEffect(() => {
    if (openFiles.length <= 1) {
      setSplitStateMap((prev) => {
        const next = {};
        Object.entries(prev).forEach(([docno, state]) => {
          next[docno] = { ...state, enabled: false };
        });
        return next;
      });
    }

    setSplitStateMap((prev) => {
      const docnos = new Set(openFiles.map((f) => f.DOCNO));
      const fallbackLeft = openFiles[0]?.DOCNO || null;
      const next = {};
      Object.entries(prev).forEach(([docno, state]) => {
        const leftValid = state.leftDocno && docnos.has(state.leftDocno);
        const rightValid = state.rightDocno && docnos.has(state.rightDocno);
        const leftDocno = leftValid ? state.leftDocno : fallbackLeft;
        const rightDocno = rightValid
          ? state.rightDocno
          : openFiles.find((f) => f.DOCNO !== leftDocno)?.DOCNO || leftDocno || null;
        next[docno] = { ...state, leftDocno, rightDocno };
      });
      return next;
    });
  }, [openFiles]);

  const handleSplitResizeStart = useCallback((docno, event) => {
    if (!docno || !splitContainerRef.current) return;
    event.preventDefault();
    const rect = splitContainerRef.current.getBoundingClientRect();

    const startX = event.clientX;
    const startRatio = splitStateMap[docno]?.ratio ?? DEFAULT_SPLIT_RATIO;

    const handleMouseMove = (moveEvent) => {
      if (!splitContainerRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const nextRatio = startRatio + deltaX / (rect.width || 1);
      const clamped = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, nextRatio));
      setSplitStateMap((prev) => ({
        ...prev,
        [docno]: { ...(prev[docno] || {}), enabled: true, ratio: clamped },
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [splitStateMap]);

  const renderTabs = () => {
    const activeDocno = activeFileId || openFiles[0]?.DOCNO || null;
    const splitState = activeDocno ? splitStateMap[activeDocno] : null;
    const splitEnabled = !!splitState?.enabled;
    const leftRatio = splitEnabled
      ? Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, splitState?.ratio ?? DEFAULT_SPLIT_RATIO))
      : null;
    const rightRatio = splitEnabled && leftRatio !== null ? 1 - leftRatio : null;

    if (!splitEnabled) {
      return (
        <SingleTabs
          files={openFiles}
          activeId={activeFileId}
          onSelect={handleTabSelect}
          onClose={onTabClose}
          onReorder={handleVisibleReorder}
          onMoreClick={() => setIsModalOpen(true)}
          onContextMenu={(e, docno) => handleTabContextMenu(e, docno)}
          selectionStates={selectionStates}
          maxVisible={MAX_VISIBLE_TABS}
          renderControls={() => null}
        />
      );
    }

    const leftDocno = splitState.leftDocno || activeDocno;
    const rightDocno =
      splitState.rightDocno ||
      openFiles.find((f) => f.DOCNO !== leftDocno)?.DOCNO ||
      leftDocno;
    const leftTabs = openFiles.filter((f) => f.DOCNO === leftDocno);
    const rightTabs = openFiles.filter((f) => f.DOCNO !== leftDocno);

    const gridTemplateColumns =
      splitEnabled && leftRatio !== null && rightRatio !== null
        ? `calc(${(leftRatio * 100).toFixed(2)}% - 4px) 8px calc(${(rightRatio * 100).toFixed(2)}% - 4px)`
        : undefined;

    return (
      <div className="split-tab-row" style={gridTemplateColumns ? { gridTemplateColumns } : undefined}>
        <PanelTabs
          files={leftTabs}
          activeId={leftDocno}
          onSelect={(docno) => assignSlotDoc(docno, 'left')}
          onClose={onTabClose}
          onContextMenu={(e, docno) => handleTabContextMenu(e, docno)}
          selectionStates={selectionStates}
        />
        <div className="split-tabs-divider" />
        <PanelTabs
          files={rightTabs.length ? rightTabs : openFiles}
          activeId={rightDocno}
          onSelect={(docno) => assignSlotDoc(docno, 'right')}
          onClose={onTabClose}
          onContextMenu={(e, docno) => handleTabContextMenu(e, docno)}
          selectionStates={selectionStates}
        />
      </div>
    );
  };

  const renderViewer = () => {
    return (
      <>
        {renderTabs()}

        <div className="viewer-content-area">
          {openFiles.length > 0 ? (
            <div className="viewer-grid">
              {openFiles.map((file) => {
                const isActiveDoc = file.DOCNO === activeFileId || (!activeFileId && openFiles[0]?.DOCNO === file.DOCNO);
                const splitState = splitStateMap[file.DOCNO] || { enabled: false, ratio: DEFAULT_SPLIT_RATIO };
                const splitEnabled = !!splitState.enabled;
                const activeSlot = splitActiveSlotMap[file.DOCNO] || 'left';
                const leftDocno = splitState.leftDocno || openFiles[0]?.DOCNO || file.DOCNO;
                const rightDocno =
                  splitState.rightDocno ||
                  openFiles.find((f) => f.DOCNO !== leftDocno)?.DOCNO ||
                  leftDocno;
                const leftFile = openFiles.find((f) => f.DOCNO === leftDocno) || file;
                const rightFile = openFiles.find((f) => f.DOCNO === rightDocno) || leftFile;

                const leftActive = isActiveDoc && activeSlot === 'left';
                const rightActive = isActiveDoc && activeSlot === 'right';
                const ratio = splitState.ratio ?? DEFAULT_SPLIT_RATIO;
                const leftFlex = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
                const rightFlex = 1 - leftFlex;

                return (
                  <div
                    key={`viewer-${file.DOCNO}`}
                    style={{ display: isActiveDoc ? 'flex' : 'none', flex: 1, minHeight: 0 }}
                  >
                    {splitEnabled ? (
                      <div
                        className="split-view-wrapper"
                        style={{ flex: 1 }}
                        ref={isActiveDoc ? splitContainerRef : null}
                      >
                        <div
                          className={`split-panel${leftActive ? ' is-active' : ''}`}
                          style={{ flexGrow: leftFlex, flexBasis: 0, flexShrink: 0 }}
                          onClick={() => setActiveSlot(file.DOCNO, 'left')}
                        >
                          <ViewerPanel
                            key={`primary-${file.DOCNO}`}
                            file={leftFile}
                            selectionInfo={selectionStates[leftFile.DOCNO]}
                            isActive={leftActive}
                            visible
                            onReadyChange={handleViewerReadyChange}
                            showSplitMenu={!!viewerReadyMap[leftFile.DOCNO]}
                            isSplitActive={splitEnabled}
                            onToggleSplit={() => handleToggleSplit(file.DOCNO)}
                            viewerCount={Math.max(2, openFiles.length)}
                            slot="left"
                            canvasId={`canvas-${leftFile.DOCNO}-primary`}
                          />
                        </div>

                        <div
                          className="split-resizer"
                          onMouseDown={(e) => handleSplitResizeStart(file.DOCNO, e)}
                          role="separator"
                          aria-valuenow={Math.round(leftFlex * 100)}
                          aria-valuemin={MIN_SPLIT_RATIO * 100}
                          aria-valuemax={MAX_SPLIT_RATIO * 100}
                          aria-orientation="vertical"
                          tabIndex={0}
                        />

                        <div
                          className={`split-panel${rightActive ? ' is-active' : ''}`}
                          style={{ flexGrow: rightFlex, flexBasis: 0, flexShrink: 0 }}
                          onClick={() => setActiveSlot(file.DOCNO, 'right')}
                        >
                          <ViewerPanel
                            key={`secondary-${rightFile.DOCNO}`}
                            file={rightFile}
                            selectionInfo={selectionStates[rightFile.DOCNO]}
                            isActive={rightActive}
                            visible
                            onReadyChange={handleViewerReadyChange}
                            showSplitMenu={!!viewerReadyMap[rightFile.DOCNO]}
                            isSplitActive={splitEnabled}
                            onToggleSplit={() => handleToggleSplit(file.DOCNO)}
                            viewerCount={Math.max(2, openFiles.length)}
                            slot="right"
                            canvasId={`canvas-${rightFile.DOCNO}-right`}
                          />
                        </div>
                      </div>
                    ) : (
                      <ViewerPanel
                        key={`primary-${file.DOCNO}`}
                        file={file}
                        selectionInfo={selectionStates[file.DOCNO]}
                        isActive={isActiveDoc}
                        visible={isActiveDoc}
                        onReadyChange={handleViewerReadyChange}
                        showSplitMenu={!!viewerReadyMap[file.DOCNO]}
                        isSplitActive={splitEnabled}
                        onToggleSplit={() => handleToggleSplit(file.DOCNO)}
                        viewerCount={openFiles.length}
                        slot="primary"
                        canvasId={`canvas-${file.DOCNO}-primary`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="initial-view-content">
              <p>좌측/검색에서 도면을 선택해주세요.</p>
            </div>
          )}
        </div>
      </>
    );
  };

  const activeDocno = activeFileId || openFiles[0]?.DOCNO || null;
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
