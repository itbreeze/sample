// client/src/components/ViewerContainer.js
import React, { useState, useCallback } from 'react';
import { X as CloseIcon, MoreHorizontal, FileText } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import DwgDisplay from './viewer/DwgDisplay';

const MAX_VISIBLE_TABS = 5;

const ViewerContainer = ({
  openFiles = [],
  activeFileId,
  onTabClick,
  onTabClose,
  onTabReorder,
  searchResults = [],
  isSearchMode = false,
  onSearchResultClick
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 🔹 drag&drop 핸들러
  const handleOnDragEnd = useCallback((result) => {    
    if (!result.destination || result.destination.index === result.source.index) return;
    const newFiles = Array.from(openFiles);
    const [reorderedItem] = newFiles.splice(result.source.index, 1);
    newFiles.splice(result.destination.index, 0, reorderedItem);
    // 🔹 순서 변경 콜백
    onTabReorder(newFiles, reorderedItem.DOCNO);
    // ⚠️ activeFileId 재설정은 부모에서 처리 필요
  }, [openFiles, onTabReorder]);

  

  // 검색 결과 클릭
  const handleSearchResultClick = useCallback((result) => {
    if (onSearchResultClick) onSearchResultClick(result);
  }, [onSearchResultClick]);

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
                {visibleFiles.map((file, index) => (
                  <Draggable key={file.DOCNO} draggableId={file.DOCNO.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                        onClick={() => onTabClick(file.DOCNO)}
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

        <div className="viewer-content-area">
          {openFiles.length > 0 ? (
            <>
              {openFiles.map((file) => (
                <div
                  key={`${file.DOCNO}-${file.tmpFile}`}
                  className="viewer-wrapper"
                  style={{ display: file.DOCNO === activeFileId ? 'flex' : 'none' }}
                >
                  <div className="viewer-header">
                    <h2 className="viewer-title">
                      {`${file.PLANTNM} / ${file.UNIT}호기 / [${file.DOCNUMBER}] ${file.DOCNM}`}
                    </h2>
                  </div>
                  <DwgDisplay
                    filePath={file.tmpFile}
                    isActive={file.DOCNO === activeFileId}
                    key={`${file.DOCNO}-${file.tmpFile}`} // React가 drag&drop 후 새로 mount하도록 key 지정
                  />
                </div>
              ))}
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
