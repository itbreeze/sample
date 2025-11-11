// client/src/components/common/TreeControls.js
import React, { useCallback, useRef } from 'react';
import './TreeControls.css';

// 단독 사용을 위한 CollapseControl
export const CollapseControl = ({
  onCollapseAll,
  visible = true,
  label = '접기',
  title = '트리 모두 접기',
  wrapper = true,
  wrapperClassName = 'tree-controls',
  className = 'ctrl-btn',
}) => {
  if (!visible) return null;
  const Button = (
    <button
      type="button"
      className={className}
      onClick={() => typeof onCollapseAll === 'function' && onCollapseAll()}
      title={title}
    >
      <span className="label">{label}</span>
    </button>
  );
  return wrapper ? <div className={wrapperClassName}>{Button}</div> : Button;
};

// 단독 사용을 위한 ScrollTopControl
export const ScrollTopControl = ({
  onScrollTop,
  targetSelector = '.panel.bottom',
  visible = true,
  label = '맨위',
  title = '맨 위로 이동',
  wrapper = true,
  wrapperClassName = 'tree-controls',
  className = 'ctrl-btn',
}) => {
  const rootRef = useRef(null);
  const scrollToTop = useCallback(() => {
    if (typeof onScrollTop === 'function') {
      onScrollTop();
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const panelContainer = root.closest('.resizable-panel-container') || document;
    const container = panelContainer.querySelector(targetSelector);
    if (container) {
      if (container.scrollTo) container.scrollTo({ top: 0, behavior: 'smooth' });
      else container.scrollTop = 0;
    }
  }, [onScrollTop, targetSelector]);

  if (!visible) return null;
  const Button = (
    <button type="button" className={className} onClick={scrollToTop} title={title}>
      <span className="label">{label}</span>
    </button>
  );
  return wrapper ? (
    <div ref={rootRef} className={wrapperClassName}>
      {Button}
    </div>
  ) : (
    <div ref={rootRef}>{Button}</div>
  );
};

/**
 * 공통 트리 컨트롤: 접기 / 맨위로
 * - 단독/결합 사용 모두 지원
 * - 기본 대상은 현재 컨트롤이 포함된 패널의 `.panel.bottom`
 */
const TreeControls = ({
  onCollapseAll,
  onScrollTop,
  targetSelector = '.panel.bottom',
  visible = true,
  showCollapse = true,
  showTop = true,
  collapseLabel = '접기',
  collapseTitle = '트리 모두 접기',
  topLabel = '맨위',
  topTitle = '맨 위로 이동',
}) => {
  const rootRef = useRef(null);

  const scrollToTop = useCallback(() => {
    if (typeof onScrollTop === 'function') {
      onScrollTop();
      return;
    }
    const root = rootRef.current;
    if (!root) return;
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
      {showCollapse && (
        <button
          type="button"
          className="ctrl-btn"
          onClick={() => typeof onCollapseAll === 'function' && onCollapseAll()}
          title={collapseTitle}
        >
          <span className="label">{collapseLabel}</span>
        </button>
      )}
      {showTop && (
        <button type="button" className="ctrl-btn" onClick={scrollToTop} title={topTitle}>
          <span className="label">{topLabel}</span>
        </button>
      )}
    </div>
  );
};

export default TreeControls;
