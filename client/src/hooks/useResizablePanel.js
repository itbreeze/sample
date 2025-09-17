import { useState, useEffect, useCallback } from 'react';

/**
 * 패널의 너비를 드래그 및 더블클릭으로 조절하는 커스텀 훅
 * @returns {{width: number, resizerProps: object}}
 */
const useResizablePanel = ({
  initialWidth = 300,
  minWidth = 250,
  maxWidth = 600,
  panelRef,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // --- ▼ 더블클릭 핸들러 추가 ▼ ---
  const handleDoubleClick = useCallback(() => {
    setWidth(currentWidth =>
      // 너비가 최대치에 가까우면 최소 너비로, 그렇지 않으면 최대 너비로 변경
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

  // --- ▼ 핸들러를 props 객체로 묶어서 반환 ▼ ---
  const resizerProps = {
    onMouseDown: handleMouseDown,
    onDoubleClick: handleDoubleClick,
  };

  return { width, resizerProps };
};

export default useResizablePanel;