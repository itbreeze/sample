import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X as CloseIcon, MoreHorizontal, FileText } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import DwgDisplay from './viewer/DwgDisplay';

const MAX_VISIBLE_TABS = 5;

// 🔹 뷰 상태 추출 유틸리티
const getCurrentViewState = (viewer) => {
  if (!viewer) return null;
  const view = viewer.activeView;
  if (!view) return null;

  try {
    if (view.position && view.target && view.upVector) {
      const viewParams = {
        position: view.position.toArray(),
        target: view.target.toArray(),
        upVector: view.upVector.toArray(),
        fieldWidth: view.fieldWidth,
        fieldHeight: view.fieldHeight,
        projection: view.projection,
      };
      view.delete();
      return viewParams;
    }
  } catch (error) {
    console.warn('뷰 상태 추출 실패:', error);
  }

  if (view.delete) view.delete();
  return null;
};

const ViewerContainer = ({
  openFiles = [],
  activeFileId,
  onTabClick,
  onTabClose,
  onTabReorder,
  viewStates,
  onViewStateChange,
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const contentAreaRef = useRef(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const viewerInstanceRef = useRef(null);

  // dnd 라이브러리를 위한 onDragEnd 핸들러
  const handleOnDragEnd = useCallback((result) => {
    if (!result.destination || result.destination.index === result.source.index) return;

    const newFiles = Array.from(openFiles);
    const [reorderedItem] = newFiles.splice(result.source.index, 1);
    newFiles.splice(result.destination.index, 0, reorderedItem);

    onTabReorder(newFiles, reorderedItem.DOCNO);
  }, [openFiles, onTabReorder]);

  // 검색 결과 클릭 핸들러
  const handleSearchResultClick = useCallback((result) => {
    if (onSearchResultClick) {
      onSearchResultClick(result);
    }
  }, [onSearchResultClick]);

  // 탭 클릭 - 뷰 상태 즉시 저장
  const handleTabClick = useCallback((docno) => {
    if (docno === activeFileId) return;

    if (viewerInstanceRef.current && activeFileId) {
      try {
        const currentState = getCurrentViewState(viewerInstanceRef.current);
        if (currentState) {
          onViewStateChange(activeFileId, currentState);
        }
      } catch (error) {
        console.warn('탭 전환시 뷰 상태 저장 실패:', error);
      }
    }

    onTabClick(docno);
  }, [activeFileId, onViewStateChange, onTabClick]);

  // 뷰어 준비 완료
  const handleViewerReady = useCallback((viewerInstance) => {
    viewerInstanceRef.current = viewerInstance;
  }, []);

  // ResizeObserver
  useEffect(() => {
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;

      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const { width, height } = entries[0].contentRect;
        setViewerSize(prevSize => {
          if (Math.abs(prevSize.width - width) > 1 || Math.abs(prevSize.height - height) > 1) {
            return { width, height };
          }
          return prevSize;
        });
      }, 16);
    });

    if (contentAreaRef.current) {
      resizeObserver.observe(contentAreaRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      if (contentAreaRef.current) {
        resizeObserver.unobserve(contentAreaRef.current);
      }
    };
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

  // 검색 결과 렌더링
  const renderSearchResults = () => (
    <div className="search-results-container">
      <div className="search-results-header">
        <h3>검색 결과 ({searchResults.length}개)</h3>
      </div>
      <div className="search-results-list">
        {searchResults.map((result, index) => (
          <div
            key={`${result.KEY}-${result.DOCNO || result.EQUIPMENT}-${index}`}
            className="search-result-item"
            onClick={() => handleSearchResultClick(result)}
          >
            <div className="result-main-info">
              <FileText size={16} className="result-icon" />
              <span className="result-title">
                [{result.DOCNUMBER}] {result.DOCNM}
              </span>
            </div>
            <div className="result-sub-info">
              <span>
                {result.PLANTNM}/{result.PARENTNM}/{result.HOGI_GUBUN}호기
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 뷰어 렌더링
  const renderViewer = () => {
    const activeFile = openFiles.find(file => file.DOCNO === activeFileId);
    const visibleFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(0, MAX_VISIBLE_TABS) : openFiles;
    const hiddenFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(MAX_VISIBLE_TABS) : [];

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
                {visibleFiles.map((file, index) => (
                  <Draggable key={file.DOCNO} draggableId={file.DOCNO.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                        onClick={() => handleTabClick(file.DOCNO)}
                        title={file.DOCNM || file.DOCNUMBER}
                      >
                        <span className="tab-title">
                          {file.DOCNM || file.DOCNUMBER}
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
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {hiddenFiles.length > 0 && (
            <div className="view-tab more-tabs-btn" onClick={() => setIsModalOpen(true)} title={`+${hiddenFiles.length}개 더보기`}>
              <MoreHorizontal size={16} />
            </div>
          )}
        </div>

        <div ref={contentAreaRef} className="viewer-content-area">
          {activeFile ? (
            <>
              <div className="viewer-header">
                <h2 className="viewer-title">
                  {`${activeFile.PLANTNM} / ${activeFile.UNIT}호기 / [${activeFile.DOCNUMBER}] ${activeFile.DOCNM}`}
                </h2>
              </div>
              <DwgDisplay
                key={activeFile.DOCNO}
                filePath={activeFile.tmpFile}
                initialViewState={viewStates[activeFile.DOCNO]}
                onViewStateChange={(viewState) => onViewStateChange(activeFile.DOCNO, viewState)}
                onViewerReady={handleViewerReady}
                viewerSize={viewerSize}
              />
            </>
          ) : (
            <div className="initial-view-content">
              <p>표시할 도면을 선택해주세요.</p>
            </div>
          )}
        </div>
      </DragDropContext>
    );
  };

  return (
    <div className="canvas-viewer-container">
      {isSearchMode ? renderSearchResults() : renderViewer()}
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

export default React.memo(ViewerContainer);