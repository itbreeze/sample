import React from 'react';
import { Rows2, Square } from 'lucide-react';
import './ViewerContainer.css';

const ViewerSplitMenu = ({ visible = false, active = false, onClick, viewerCount = 1 }) => {
  if (!visible || viewerCount <= 1) return null;
  const Icon = active ? Square : Rows2;
  return (
    <button
      type="button"
      className={`viewer-split-menu${active ? ' is-active' : ''}`}
      title={active ? '분할 보기 종료' : '분할 보기'}
      onClick={onClick}
    >
      <Icon className={`viewer-split-menu-icon${active ? ' is-active' : ''}`} />
    </button>
  );
};

export default ViewerSplitMenu;
