import React, { useRef, useEffect } from 'react';
import './ViewerContainer.css';

const SplitViewLayout = ({ left, right, ratio = 0.5, onRatioChange, min = 0.2, max = 0.8 }) => {
  const containerRef = useRef(null);
  const stateRef = useRef({ rectLeft: 0, rectWidth: 1 });

  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect?.();
    if (rect) {
      stateRef.current = { rectLeft: rect.left, rectWidth: rect.width || 1 };
    }
  }, [ratio]);

  const handleMouseMove = (e) => {
    const { rectLeft, rectWidth } = stateRef.current;
    const relative = (e.clientX - rectLeft) / rectWidth;
    const clamped = Math.min(max, Math.max(min, relative));
    onRatioChange?.(clamped);
  };

  const handleMouseUp = () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = () => {
    const rect = containerRef.current?.getBoundingClientRect?.();
    if (rect) stateRef.current = { rectLeft: rect.left, rectWidth: rect.width || 1 };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="split-container" ref={containerRef}>
      <div className="split-panel-body" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        className="split-resizer"
        onMouseDown={handleMouseDown}
        title="드래그하여 폭 조절"
      />
      <div className="split-panel-body" style={{ flexBasis: `${(1 - ratio) * 100}%` }}>
        {right}
      </div>
    </div>
  );
};

export default SplitViewLayout;
