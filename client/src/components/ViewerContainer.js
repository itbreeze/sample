// src/components/ViewerContainer.js

import React, { useRef, useState, useEffect } from 'react';
import { X as CloseIcon, MoreHorizontal } from 'lucide-react';
import './ViewerContainer.css';
import TabListModal from './TabListModal';
import DwgDisplay from './viewer/DwgDisplay';

const MAX_VISIBLE_TABS = 5;

const ViewerContainer = ({ openFiles = [], activeFileId, onTabClick, onTabClose, onTabReorder, viewStates, onViewStateChange }) => {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const contentAreaRef = useRef(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setViewerSize(prevSize => {
        if (prevSize.width !== width || prevSize.height !== height) {
          return { width, height };
        }
        return prevSize;
      });
    });

    if (contentAreaRef.current) {
      resizeObserver.observe(contentAreaRef.current);
    }

    return () => {
      if (contentAreaRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        resizeObserver.unobserve(contentAreaRef.current);
      }
    };
  }, []);

  const handleDragStart = (e, file) => {
    dragItem.current = file;
    setDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e, targetFile) => {
    dragOverItem.current = targetFile;
  };
  
  const handleDrop = (e) => {
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
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };

  const handleSelectFromModal = (docno) => {
    const newFiles = [...openFiles];
    const selectedFileIndex = newFiles.findIndex(f => f.DOCNO === docno);
    if (selectedFileIndex > -1) {
      const [selectedFile] = newFiles.splice(selectedFileIndex, 1);
      newFiles.unshift(selectedFile);
      onTabReorder(newFiles, docno);
    }
    setIsModalOpen(false);
  };

  const activeFile = openFiles.find(file => file.DOCNO === activeFileId);

  const visibleFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(0, MAX_VISIBLE_TABS) : openFiles;
  const hiddenFiles = openFiles.length > MAX_VISIBLE_TABS ? openFiles.slice(MAX_VISIBLE_TABS) : [];

  return (
    <div className="canvas-viewer-container">
      <div className="view-tabs-container">
        {visibleFiles.map(file => (
          <div
            key={file.DOCNO}
            className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''} ${dragging && dragItem.current?.DOCNO === file.DOCNO ? 'dragging' : ''}`}
            onClick={() => onTabClick(file.DOCNO)}
            title={file.DOCNM || file.DOCNUMBER}
            draggable
            onDragStart={(e) => handleDragStart(e, file)}
            onDragEnter={(e) => handleDragEnter(e, file)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <span className="tab-title">{file.DOCNM || file.DOCNUMBER}</span>
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
          <div className="view-tab more-tabs-btn" onClick={() => setIsModalOpen(true)} title="더 보기">
            <MoreHorizontal size={16} />
          </div>
        )}
      </div>
      
      <TabListModal
        isOpen={isModalOpen}
        files={hiddenFiles}
        onClose={() => setIsModalOpen(false)}
        onSelectTab={handleSelectFromModal}
        onCloseTab={onTabClose}
      />

      <div ref={contentAreaRef} className="viewer-content-area">
        {activeFile ? (
          <DwgDisplay
            key={activeFile.DOCNO}
            filePath={activeFile.tmpFile}
            initialViewState={viewStates[activeFile.DOCNO]}
            onViewStateChange={(viewState) => onViewStateChange(activeFile.DOCNO, viewState)}
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

export default ViewerContainer;