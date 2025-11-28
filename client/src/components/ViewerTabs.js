// client/src/components/ViewerTabs.js
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { X as CloseIcon } from 'lucide-react';
import './ViewerContainer.css';

const MAX_VISIBLE = 5;

const TabItem = ({ file, isActive, selectionCount = 0, onClick, onClose, onContextMenu, draggableProps }) => (
  <div
    ref={draggableProps?.innerRef}
    {...(draggableProps?.draggableProps || {})}
    {...(draggableProps?.dragHandleProps || {})}
    className={`view-tab ${isActive ? 'active' : ''} ${draggableProps?.isDragging ? 'dragging' : ''}`}
    onClick={onClick}
    onContextMenu={onContextMenu}
    title={`${file.DOCNM || file.DOCNUMBER}${selectionCount > 0 ? ` (선택: ${selectionCount})` : ''}`}
  >
    <span className="tab-title">
      {file.DOCNM || file.DOCNUMBER}
      {selectionCount > 0 && <span className="selection-badge">{selectionCount}</span>}
    </span>
    <button
      className="close-tab-btn"
      onClick={(e) => { e.stopPropagation(); onClose?.(); }}
    >
      <CloseIcon size={14} />
    </button>
  </div>
);

export const SingleTabs = ({
  files = [],
  activeId,
  onSelect,
  onClose,
  onReorder,
  onMoreClick,
  onContextMenu,
  selectionStates = {},
  maxVisible = MAX_VISIBLE,
}) => {
  const visible = files.length > maxVisible ? files.slice(0, maxVisible) : files;
  const hiddenCount = files.length > maxVisible ? files.length - maxVisible : 0;

  return (
    <DragDropContext onDragEnd={(result) => {
      if (!result.destination || result.destination.index === result.source.index) return;
      const newFiles = Array.from(visible);
      const [reordered] = newFiles.splice(result.source.index, 1);
      newFiles.splice(result.destination.index, 0, reordered);
      const reorderedDocnos = newFiles.map((f) => f.DOCNO);
      if (onReorder) onReorder(reorderedDocnos);
    }}>
      <div className="view-tabs-container">
        <Droppable droppableId="tabs" direction="horizontal">
          {(provided) => (
            <div
              className="visible-tabs-wrapper"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {visible.map((file, index) => {
                const selectionCount = selectionStates[file.DOCNO]?.count || 0;
                return (
                  <Draggable key={file.DOCNO} draggableId={file.DOCNO.toString()} index={index}>
                    {(providedDrag, snapshot) => (
                      <TabItem
                        file={file}
                        isActive={file.DOCNO === activeId}
                        selectionCount={selectionCount}
                        onClick={() => onSelect?.(file.DOCNO)}
                        onClose={() => onClose?.(file.DOCNO)}
                        onContextMenu={(e) => onContextMenu?.(e, file.DOCNO)}
                        draggableProps={{
                          innerRef: providedDrag.innerRef,
                          draggableProps: providedDrag.draggableProps,
                          dragHandleProps: providedDrag.dragHandleProps,
                          isDragging: snapshot.isDragging,
                        }}
                      />
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
        {hiddenCount > 0 && (
          <div
            className="view-tab more-tabs-btn"
            onClick={onMoreClick}
            title={`더보기 (${hiddenCount})`}
          >
            더보기 + {hiddenCount}
          </div>
        )}
      </div>
    </DragDropContext>
  );
};
