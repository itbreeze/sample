// client/src/components/common/TreeControls.js
import React, { useCallback, useRef } from 'react';
import { ListMinus, ArrowUpToLine } from 'lucide-react';
import './TreeControls.css';

// Standalone collapse control
export const CollapseControl = ({
  onCollapseAll,
  visible = true,
  label = '목록최소화',
  title = '목록 모두 최소화',
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
      <ListMinus size={16} />
      <span className="label">{label}</span>
    </button>
  );
  return wrapper ? <div className={wrapperClassName}>{Button}</div> : Button;
};

// Standalone scroll-to-top control
export const ScrollTopControl = ({
  onScrollTop,
  targetSelector = '.panel.bottom',
  visible = true,
  label = '맨위로이동',
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
      <ArrowUpToLine size={16} />
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
 * Combined controls: collapse + scroll-to-top
 */
const TreeControls = ({
  onCollapseAll,
  onScrollTop,
  targetSelector = '.panel.bottom',
  visible = true,
  showCollapse = true,
  showTop = true,
  collapseLabel = '목록최소화',
  collapseTitle = '목록 모두 최소화',
  topLabel = '맨위로이동',
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
          <ListMinus size={16} />
          <span className="label">{collapseLabel}</span>
        </button>
      )}
      {showTop && (
        <button type="button" className="ctrl-btn" onClick={scrollToTop} title={topTitle}>
          <ArrowUpToLine size={16} />
          <span className="label">{topLabel}</span>
        </button>
      )}
    </div>
  );
};

export default TreeControls;

