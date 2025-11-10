// client/src/components/common/TreeControls.js
import React, { useCallback, useRef } from 'react';
import './TreeControls.css';

/**
 * 공통 트리 컨트롤: 접기 / 맨위로
 * - 재사용 가능: 아무 스크롤 컨테이너에서도 동작
 * - 기본 대상은 현재 컨트롤이 포함된 패널의 `.panel.bottom`
 */
const TreeControls = ({ onCollapseAll, onScrollTop, targetSelector = '.panel.bottom', visible = true }) => {
  const rootRef = useRef(null);

  const scrollToTop = useCallback(() => {
    if (typeof onScrollTop === 'function') {
      onScrollTop();
      return;
    }
    const root = rootRef.current;
    if (!root) return;

    // 현재 컨트롤이 포함된 리사이즈 패널 범위 내에서만 스크롤 대상 탐색
    const panelContainer = root.closest('.resizable-panel-container') || document;
    const container = panelContainer.querySelector(targetSelector);
    if (container) {
      if (container.scrollTo) container.scrollTo({ top: 0, behavior: 'smooth' });
      else container.scrollTop = 0;
    }
  }, [onScrollTop, targetSelector]);

  if (!visible) return null;

  return (
    <div ref={rootRef} className="tree-controls">
      <button
        type="button"
        className="ctrl-btn"
        onClick={() => typeof onCollapseAll === 'function' && onCollapseAll()}
        title="트리 모두 접기"
      >
        <span className="label">접기</span>
      </button>
      <button
        type="button"
        className="ctrl-btn"
        onClick={scrollToTop}
        title="맨 위로 이동"
      >
        <span className="label">맨위</span>
      </button>
    </div>
  );
};

export default TreeControls;
