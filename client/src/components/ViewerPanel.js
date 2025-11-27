import React from 'react';
import Canvas from './viewer/Canvas';

const ViewerPanel = ({
  file,
  selectionInfo,
  isActive,
  onReadyChange,
  showSplitMenu,
  isSplitActive,
  onToggleSplit,
  viewerCount = 1,
  visible = true,
  slot = 'single',
  canvasId,
}) => {
  if (!file) return null;
  return (
    <div
      className="viewer-wrapper"
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <div className="viewer-header">
        <h2 className="viewer-title">
          {`${file.PLANTNM} / ${file.UNIT}호기 / [${file.DOCNUMBER}] ${file.DOCNM}`}
        </h2>
        {selectionInfo && selectionInfo.count > 0 && (
          <div className="selection-info">
            선택: {selectionInfo.count}
            {selectionInfo.mode && ` (${selectionInfo.mode === 'window' ? 'Window' : 'Crossing'})`}
          </div>
        )}
      </div>
      <Canvas
        filePath={file.tmpFile}
        docno={file.DOCNO}
        isActive={isActive}
        key={file.DOCNO}
        onReadyChange={onReadyChange}
        showSplitMenu={showSplitMenu}
        isSplitActive={isSplitActive}
        onToggleSplit={onToggleSplit}
        viewerCount={viewerCount}
        slot={slot}
        canvasId={canvasId}
      />
    </div>
  );
};

export default ViewerPanel;
