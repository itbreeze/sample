// client/src/components/ViewerCanvasHeader.js
import React from 'react';
import ViewerCanvas from '../canvas/ViewerCanvas';

const ViewerCanvasHeader = ({
  file,
  selectionInfo,
  isActive,
  onReadyChange,
  highlightHandles = [],
  highlightColor,
  isFavorite = false,
  onToggleFavorite,
  allowEntityPanel = true,
  allowEquipmentInfoPanel = true,
  viewerMode = 'ViewerMode',
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
        docVr={file.DOCVR || file.docVr}
        isActive={isActive}
        onReadyChange={onReadyChange}
        canvasId={`canvas-${file.DOCNO}`}
        highlightHandles={highlightHandles}
        highlightColor={highlightColor}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        allowEntityPanel={allowEntityPanel}
        allowEquipmentInfoPanel={allowEquipmentInfoPanel}
        viewerMode={viewerMode}
      />
    </div>
  );
};

export default ViewerCanvasHeader;
