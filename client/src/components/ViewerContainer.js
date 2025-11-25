// client/src/components/ViewerContainer.js
import React, { useState, useCallback } from 'react';
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
  onTabReorder,
  viewerStates,          // DOCNO -> {zoom, pan, camera, ...}
  setViewerStates,       // 상태 업데이트 콜백
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionStates, setSelectionStates] = useState({}); // DOCNO -> { handles: [], count: 0 }

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
              title={`+${hiddenFiles.length}개 더보기`}
            >
              + {hiddenFiles.length}
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
    <div className="canvas-viewer-container">
      {isSearchMode ? (
        <SearchResultPanel results={searchResults} onSelect={onSearchResultClick} />
      ) : (
        renderViewer()
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
