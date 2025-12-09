import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import './ResizablePanel.css';
import Tooltip from './common/Tooltip';

// 1. isResizable prop 추가 (기본값 true)
const ResizablePanel = ({
  children,
  initialWidth = 300,
  minWidth = 250,
  maxWidth = 600,
  isResizable = true,
}) => {
  const panelRef = useRef(null);
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // initialWidth prop이 변경될 때 내부 상태도 반영
  useEffect(() => {
    setWidth(initialWidth);
  }, [initialWidth]);

  // 클릭: 최소 <-> 최대 너비 토글
  const handleClickToggle = useCallback(() => {
    setWidth(currentWidth =>
      currentWidth < maxWidth - 10 ? maxWidth : minWidth
    );
  }, [minWidth, maxWidth]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isResizing]);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !panelRef.current) return;

    const panelLeft = panelRef.current.getBoundingClientRect().left;
    let newWidth = e.clientX - panelLeft;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    setWidth(newWidth);
  }, [isResizing, minWidth, maxWidth]);

  // 마우스 이벤트 전역 리스너 등록 및 커서 스타일 변경
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

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const resizeHelp = (
    <div>
      <strong>❓ 도움말</strong>
      <hr />
      드래그: 크기 조절<br />
      한번클릭: 최대/최소화
    </div>
  );

  const isCompact = width <= 360;

  return (
    <div
      ref={panelRef}
      className={`resizable-panel-container ${isCompact ? 'compact' : ''}`}
      style={{ width }}
    >
      <div className="resizable-panel-content">
        {children}
      </div>
      
      {/* 2. isResizable 값에 따라 크기 조절 UI 전체를 조건부 렌더링 */}
      {isResizable && (
        <div className="panel-resizer-wrapper">
          <div
            className="panel-resizer-handle"
            onMouseDown={handleMouseDown}
            onClick={handleClickToggle}
            onMouseEnter={() => setIsTooltipVisible(true)}
            onMouseLeave={() => setIsTooltipVisible(false)}
          >
            <GripVertical size={16} />
          </div>
          <Tooltip position="right" show={isTooltipVisible}>
            {resizeHelp}
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;
