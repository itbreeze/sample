// client/src/components/ViewerCanvasPanel.js
import React from 'react';
import ViewerCanvas from '../canvas/ViewerCanvas';

const ViewerCanvasPanel = ({
  file,
  selectionInfo,
  isActive,
  onReadyChange,
  highlightHandles = [],
}) => {
  if (!file) return null;

  return (
    <div
      className="viewer-wrapper"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      <div className="viewer-header">
        <h2 className="viewer-title">
          {`${file.PLANTNM} / ${file.SYSTEMNM} / ${file.UNIT} / [${file.DOCNUMBER}] ${file.DOCNM}`}
        </h2>
        {selectionInfo && selectionInfo.count > 0 && (
          <div className="selection-info">
            선택: {selectionInfo.count}
            {selectionInfo.mode && ` (${selectionInfo.mode === 'window' ? 'Window' : 'Crossing'})`}
          </div>
        )}
      </div>
      <ViewerCanvas
        filePath={file.tmpFile}
        docno={file.DOCNO}
        isActive={isActive}
        onReadyChange={onReadyChange}
        canvasId={`canvas-${file.DOCNO}`}
        highlightHandles={highlightHandles}
      />
    </div>
  );
};

export default ViewerCanvasPanel;
