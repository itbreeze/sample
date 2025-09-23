import React, { useRef, useState } from 'react';
import { X as CloseIcon, MoreHorizontal } from 'lucide-react'; // MoreHorizontal 아이콘 추가
import './CanvasViewer.css';
import TabListModal from './TabListModal'; // 모달 컴포넌트 import
import ViewerCanvas from './viewer/ViewerCanvas'; // 👈 1. 새로 만든 뷰어 컴포넌트 import

const MAX_VISIBLE_TABS = 5; // 화면에 보여질 최대 탭 수

const CanvasViewer = ({ openFiles = [], activeFileId, onTabClick, onTabClose, onTabReorder }) => {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 상태 추가

  // 드래그 시작
  const handleDragStart = (e, file) => {
    dragItem.current = file;
    setDragging(true);
  };

  // 드래그 중 다른 요소 위로 이동
  const handleDragOver = (e) => {
    e.preventDefault(); // 필수: 드롭을 허용하기 위함
  };

  // 드래그 중인 요소가 다른 요소 위로 들어갔을 때
  const handleDragEnter = (e, targetFile) => {
    dragOverItem.current = targetFile;
  };
  
  // 드롭 발생
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

  // 드래그 종료 (스타일 정리)
  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };

  // 모달에서 탭 선택 시 처리
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

  // 화면에 표시될 탭과 숨겨질 탭을 계산합니다.
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
        files={hiddenFiles} // 숨겨진 파일 목록만 모달에 전달합니다.
        onClose={() => setIsModalOpen(false)}
        onSelectTab={handleSelectFromModal}
        onCloseTab={onTabClose}
      />

      <div className="viewer-content-area">
        {activeFile ? (
          <ViewerCanvas key={activeFile.DOCNO} filePath={activeFile.tmpFile} />
        ) : (
          <div className="initial-view-content">
            <p>표시할 도면을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasViewer;