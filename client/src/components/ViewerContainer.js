// src/components/ViewerContainer.js

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X as CloseIcon, MoreHorizontal } from 'lucide-react';
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
  onViewStateChange
}) => {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const contentAreaRef = useRef(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  
  // 🔹 뷰어 인스턴스 추적
  const viewerInstanceRef = useRef(null);

  // 🔹 탭 클릭 - 뷰 상태 즉시 저장
  const handleTabClick = useCallback((docno) => {
    if (docno === activeFileId) return;

    // 현재 활성 뷰어의 상태를 즉시 저장
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

  // 🔹 뷰어 준비 완료
  const handleViewerReady = useCallback((viewerInstance) => {
    viewerInstanceRef.current = viewerInstance;
    window.currentViewerInstance = viewerInstance; // 전역 참조
  }, []);

  // 🔹 ResizeObserver
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

  // 🔹 드래그 앤 드롭
  const handleDragStart = useCallback((e, file) => {
    dragItem.current = file;
    setDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, targetFile) => {
    dragOverItem.current = targetFile;
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (dragItem.current && dragOverItem.current && dragItem.current.DOCNO !== dragOverItem.current.DOCNO) {
      const newFiles = [...openFiles];
      const draggedItemContent = newFiles.find(f => f.DOCNO === dragItem.current.DOCNO);
      const dragItemIndex = newFiles.findIndex(f => f.DOCNO === dragItem.current.DOCNO);
      const dragOverItemIndex = newFiles.findIndex(f => f.DOCNO === dragOverItem.current.DOCNO);

      newFiles.splice(dragItemIndex, 1);
      newFiles.splice(dragOverItemIndex, 0, draggedItemContent);
      
      onTabReorder(newFiles, dragItem.current.DOCNO);
    }
    handleDragEnd();
  }, [openFiles, onTabReorder]);

  const handleDragEnd = useCallback(() => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  }, []);

  // 🔹 모달에서 탭 선택
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

  const activeFile = openFiles.find(file => file.DOCNO === activeFileId);
  const visibleFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(0, MAX_VISIBLE_TABS) : openFiles;
  const hiddenFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(MAX_VISIBLE_TABS) : [];

  return (
    <div className="canvas-viewer-container">
      {/* 🔹 탭 헤더 */}
      <div className="view-tabs-container">
        {visibleFiles.map(file => (
          <div
            key={file.DOCNO}
            className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''} ${dragging && dragItem.current?.DOCNO === file.DOCNO ? 'dragging' : ''}`}
            onClick={() => handleTabClick(file.DOCNO)}
            title={file.DOCNM || file.DOCNUMBER}
            draggable
            onDragStart={(e) => handleDragStart(e, file)}
            onDragEnter={(e) => handleDragEnter(e, file)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <span className="tab-title">
              {file.DOCNM || file.DOCNUMBER}
            </span>
            <button
              className="close-tab-btn"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.DOCNO);
              }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
        {hiddenFiles.length > 0 && (
          <div className="view-tab more-tabs-btn" onClick={() => setIsModalOpen(true)} title={`+${hiddenFiles.length}개 더보기`}>
            <MoreHorizontal size={16} />
          </div>
        )}
      </div>
      
      {/* 🔹 모달 */}
      <TabListModal
        isOpen={isModalOpen}
        files={hiddenFiles}
        onClose={() => setIsModalOpen(false)}
        onSelectTab={handleSelectFromModal}
        onCloseTab={onTabClose}
      />

      {/* 🔹 뷰어 영역 */}
      <div ref={contentAreaRef} className="viewer-content-area">
        {activeFile ? (
          <DwgDisplay
            key={activeFile.DOCNO}
            filePath={activeFile.tmpFile}
            initialViewState={viewStates[activeFile.DOCNO]} // 메모리에서만 복원
            onViewStateChange={(viewState) => onViewStateChange(activeFile.DOCNO, viewState)}
            onViewerReady={handleViewerReady}
            viewerSize={viewerSize}
          />
        ) : (
          <div className="initial-view-content">
            <p>표시할 도면을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ViewerContainer);