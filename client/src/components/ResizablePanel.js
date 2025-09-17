import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import './ResizablePanel.css'; // 통합된 CSS 파일을 import

/**
 * 리사이즈 핸들 UI를 담당하는 내부 컴포넌트
 * (title 속성은 커스텀 툴팁으로 대체되므로 제거합니다)
 */
const ResizeHandle = ({ resizerProps }) => {
  return (
    <div
      className="panel-resizer-handle"
      {...resizerProps}
    >
      <GripVertical size={16} />
    </div>
  );
};

/**
 * 드래그 및 더블클릭으로 크기 조절이 가능한 패널 컴포넌트
 */
const ResizablePanel = ({
  children,
  initialWidth = 300,
  minWidth = 250,
  maxWidth = 600,
}) => {
  const panelRef = useRef(null);
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  
  // --- ▼ 커스텀 툴팁 상태 및 핸들러 ▼ ---
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const showTooltip = () => setIsTooltipVisible(true);
  const hideTooltip = () => setIsTooltipVisible(false);

  const handleDoubleClick = useCallback(() => {
    setWidth(currentWidth =>
      currentWidth < maxWidth - 10 ? maxWidth : minWidth
    );
  }, [minWidth, maxWidth]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'auto';
    document.body.style.userSelect = 'auto';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isResizing && panelRef.current) {
      const panelLeft = panelRef.current.getBoundingClientRect().left;
      let newWidth = e.clientX - panelLeft;

      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      
      setWidth(newWidth);
    }
  }, [isResizing, minWidth, maxWidth, panelRef]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const resizerProps = {
    onMouseDown: handleMouseDown,
    onDoubleClick: handleDoubleClick,
    onMouseEnter: showTooltip, // ◀ 마우스 오버 이벤트 연결
    onMouseLeave: hideTooltip, // ◀ 마우스 아웃 이벤트 연결
  };

  return (
    <div
      ref={panelRef}
      className="resizable-panel-container"
      style={{ width }}
    >
      <div className="resizable-panel-content">
        {children}
      </div>
      <ResizeHandle resizerProps={resizerProps} />

      {/* --- ▼ 툴팁 UI를 렌더링하는 부분 ▼ --- */}
      {isTooltipVisible && (
        <div className="panel-resizer-tooltip">
          <strong>❓ 도움말</strong>
          <hr />
          드래그: 크기 조절<br />
          더블클릭: 최대/최소화
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;