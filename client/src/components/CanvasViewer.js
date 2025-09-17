import React from 'react';
import './CanvasViewer.css';

const CanvasViewer = ({ openFiles = [], activeTab, onTabClick, onTabClose }) => {
  const activeFile = openFiles.find(file => file.id === activeTab);

  return (
    <div className="canvas-viewer-container">
      <div className="view-tabs-container">
        {openFiles.map(file => (
          // ▼▼▼ 여기에 key={file.id}를 추가하여 오류를 해결합니다. ▼▼▼
          <div
            key={file.id}
            className={`view-tab ${file.id === activeTab ? 'active' : ''}`}
            onClick={() => onTabClick(file.id)}
          >
            <span className="tab-title" title={file.name}>{file.name}</span>
            <button
              className="close-tab-btn"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.id);
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      
      <div className="viewer-content-area">
        {activeFile ? (
          <>
            <div className="viewer-header">
              <h3>{activeFile.name}</h3>
            </div>
            <pre className="server-response-view">
              {JSON.stringify(activeFile.data, null, 2)}
            </pre>
          </>
        ) : (
          <div>파일을 찾을 수 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default CanvasViewer;