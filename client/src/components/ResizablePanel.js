import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import './ResizablePanel.css';
import Tooltip from './common/Tooltip'; 

const ResizablePanel = ({
  children,
  initialWidth = 300,
  minWidth = 250,
  maxWidth = 600,
}) => {
  const panelRef = useRef(null);
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // 더블클릭 핸들러
  const handleDoubleClick = useCallback(() => {
    setWidth(currentWidth =>
      currentWidth < maxWidth - 10 ? maxWidth : minWidth
    );
  }, [minWidth, maxWidth]);

  // 마우스 다운 핸들러
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // 마우스 업 핸들러 (전역)
  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isResizing]);

  // 마우스 이동 핸들러 (전역)
  const handleMouseMove = useCallback((e) => {
    // isResizing 상태가 아닐 때는 함수를 즉시 종료
    if (!isResizing || !panelRef.current) return;
    
    const panelLeft = panelRef.current.getBoundingClientRect().left;
    let newWidth = e.clientX - panelLeft;

    // 최소/최대 너비 제한
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    
    setWidth(newWidth);
  }, [isResizing, minWidth, maxWidth]);

  // isResizing 상태에 따라 전역 이벤트 리스너를 추가/제거하고 마우스 커서 스타일을 변경
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = 'auto';
      document.body.style.userSelect = 'auto';
    }
    
    // 컴포넌트가 언마운트될 때 이벤트 리스너를 정리
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 툴팁에 표시될 내용
  const resizeHelp = (
    <div>
      <strong>❓ 도움말</strong>
      <hr />
      드래그: 크기 조절<br />
      더블클릭: 최대/최소화
    </div>
  );
  
  return (
    <div
      ref={panelRef}
      className="resizable-panel-container"
      style={{ width }}
    >
      <div className="resizable-panel-content">
        {children}
      </div>

      <div className="panel-resizer-wrapper">
        <div
          className="panel-resizer-handle"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => setIsTooltipVisible(true)}
          onMouseLeave={() => setIsTooltipVisible(false)}
        >
          <GripVertical size={16} />
        </div>        
        <Tooltip position="right" show={isTooltipVisible}>
          {resizeHelp}
        </Tooltip>
      </div>
    </div>
  );
};

export default ResizablePanel;