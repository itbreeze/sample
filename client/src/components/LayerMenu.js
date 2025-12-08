import React, { useCallback, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useViewer } from '../viewer/context/ViewerContext';
import { getDocumentKeyFromFile } from '../viewer/utils/documentKey';
import './EquipmentMenu.css';

const LayerMenu = () => {
  const {
    openFiles,
    activeFileId,
    layerListsByDoc,
    isFileLoaded,
  } = useViewer();
  const activeFile = openFiles.find((file) => file.DOCNO === activeFileId);
  const docKey = getDocumentKeyFromFile(activeFile);
  const layers = docKey ? layerListsByDoc?.[docKey] : undefined;
  const hasLayers = Array.isArray(layers) && layers.length > 0;
  const isLoading = Boolean(activeFile && docKey && layers === undefined && isFileLoaded);

  const [hiddenLayerIds, setHiddenLayerIds] = useState(() => new Set());

  const toggleLayerVisibility = useCallback((layerId) => {
    setHiddenLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const renderLayer = (layer) => {
    const isHidden = hiddenLayerIds.has(layer.id);
    const isVisible = !isHidden;
    const handleToggle = () => toggleLayerVisibility(layer.id);
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    };

    return (
      <div className="equipment-tree-node" key={layer.id}>
        <div className="equipment-tree-node__header layer-tree-node__header">
          <div
            className="equipment-tree-node__label layer-tree-node__label"
            role="button"
            tabIndex={0}
            aria-pressed={isHidden}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
          >
            <strong>{layer.name}</strong>
          </div>
          <div className="equipment-tree-node__actions">
            <button
              type="button"
              className={[
                'equipment-card__chip',
                'layer-tree-node__chip',
                isVisible ? 'layer-tree-node__chip--visible' : 'layer-tree-node__chip--hidden',
                isVisible ? 'active' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isHidden}
              aria-label={`${layer.name} 레이어 ${isHidden ? '보이기' : '숨기기'}`}
              onClick={(event) => {
                event.stopPropagation();
                handleToggle();
              }}
            >
              {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="equipment-panel">
      <div className="equipment-panel__body">
        {!isLoading && !activeFile && (
          <div className="equipment-panel__message">도면을 선택해 주세요.</div>
        )}
        {!isLoading && activeFile && !hasLayers && (
          <div className="equipment-panel__message">레이어 정보를 찾을 수 없습니다.</div>
        )}
        {!isLoading && hasLayers && (
          <div className="equipment-tree">
            {layers.map(renderLayer)}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerMenu;
