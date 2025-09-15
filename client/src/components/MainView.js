import React, { useRef } from 'react';
import { X as CloseIcon } from 'lucide-react';
import './MainView.css';

function MainView({ currentTab, openFiles, activeFileId, onTabClick, onTabClose, onTabReorder }) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // 드래그 시작
  const handleDragStart = (e, file) => {
    dragItem.current = file;
    // 드래그 중인 요소에 투명도 효과를 주기 위해 timeout 사용
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  // 드래그 중 다른 요소 위로 이동
  const handleDragEnter = (e, targetFile) => {
    dragOverItem.current = targetFile;
  };

  // 드래그 종료 (드롭 발생)
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    if (dragItem.current && dragOverItem.current && dragItem.current.DOCNO !== dragOverItem.current.DOCNO) {
      const newFiles = [...openFiles];
      const draggedItemContent = newFiles.find(f => f.DOCNO === dragItem.current.DOCNO);
      const dragItemIndex = newFiles.findIndex(f => f.DOCNO === dragItem.current.DOCNO);
      const dragOverItemIndex = newFiles.findIndex(f => f.DOCNO === dragOverItem.current.DOCNO);

      // 드래그된 아이템을 제거하고 새로운 위치에 삽입
      newFiles.splice(dragItemIndex, 1);
      newFiles.splice(dragOverItemIndex, 0, draggedItemContent);
      
      // 변경된 순서와 드래그한 파일의 ID를 부모 컴포넌트로 전달
      onTabReorder(newFiles, dragItem.current.DOCNO);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // 열린 파일이 없으면 초기 안내 메시지 표시
  if (!openFiles || openFiles.length === 0) {
    return (
      <main className="app-main-view">
        <div className="initial-view-content">
          <h2>'{currentTab.label}' 작업을 시작하려면,</h2>
          <p>왼쪽 패널에서 상세검색 &gt; 도면목록을 선택하여<br />원하는 도면을 열어주세요.</p>
        </div>
      </main>
    );
  }

  const activeFile = openFiles.find(file => file.DOCNO === activeFileId);

  return (
    <main className="app-main-view">
      <div className="main-view-content viewer-mode">
        <div className="view-tabs-container">
          {openFiles.map(file => (
            <div
              key={file.DOCNO}
              className={`view-tab ${file.DOCNO === activeFileId ? 'active' : ''}`}
              onClick={() => onTabClick(file.DOCNO)}
              title={file.DOCNM || file.DOCNUMBER}
              draggable
              onDragStart={(e) => handleDragStart(e, file)}
              onDragEnter={(e) => handleDragEnter(e, file)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <span className="tab-title">{file.DOCNM || file.DOCNUMBER}</span>
              <button
                className="close-tab-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(file.DOCNO);
                }}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
        </div>
        
        {activeFile ? (
          <div className="viewer-content-area">
            <div className="viewer-header">
              <h3>[{activeFile.DOCNUMBER}] {activeFile.DOCNM}</h3>
            </div>
            <pre className="server-response-view">
              {JSON.stringify(activeFile, null, 2)}
            </pre>
          </div>
        ) : (
           <div className="initial-view-content">
             <p>표시할 도면을 선택해주세요.</p>
           </div>
        )}
      </div>
    </main>
  );
}

export default MainView;