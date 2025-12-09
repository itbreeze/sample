import React, { useCallback, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useViewer } from '../viewer/context/ViewerContext';
import { getDocumentKeyFromFile } from '../viewer/utils/documentKey';
import './LayerMenu.css';

const DEFAULT_LAYER_FILTER = () => true;

const LayerMenu = ({
  filterLayer = DEFAULT_LAYER_FILTER,
  stripLayerKeywords = [],
  colorizeLayer = false,
  renderLayerActions = null,
  emptyMessage = '레이어 정보를 찾을 수 없습니다.',
  toolbar = null,
}) => {
  const {
    openFiles,
    activeFileId,
    layerListsByDoc,
    isFileLoaded,
    hiddenLayersByDoc,
    toggleLayerVisibility,
  } = useViewer();
  const activeFile = openFiles.find((file) => file.DOCNO === activeFileId);
  const docKey = getDocumentKeyFromFile(activeFile);
  const layers = docKey ? layerListsByDoc?.[docKey] : undefined;
  const filteredLayers = useMemo(() => {
    if (!Array.isArray(layers)) return [];
    return layers.filter(filterLayer);
  }, [layers, filterLayer]);
  const hasLayers = filteredLayers.length > 0;
  const isLoading = Boolean(activeFile && docKey && layers === undefined && isFileLoaded);

  const hiddenLayerSet = useMemo(() => {
    if (!docKey) return new Set();
    const list = hiddenLayersByDoc?.[docKey];
    return new Set(Array.isArray(list) ? list : []);
  }, [docKey, hiddenLayersByDoc]);

  const computeDisplayName = (name) => {
    if (typeof name !== 'string') return name;
    const cleaned = stripLayerKeywords
      .reduce(
        (current, keyword) =>
          keyword ? current.split(keyword).join('') : current,
        name
      )
      .trim();
    if (cleaned === '0') return '기본 레이어';
    return cleaned || name;
  };

  const renderLayer = (layer) => {
    const isHidden = hiddenLayerSet.has(layer.id);
    const isVisible = !isHidden;
    const handleToggle = () => {
      if (!docKey) return;
      toggleLayerVisibility(docKey, layer.id);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    };

    return (
      <div className="layer-tree-node" key={layer.id}>
          <div
            className="layer-tree-node__header layer-tree-node__header--align"
            role="button"
            tabIndex={0}
            aria-pressed={isHidden}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
          >
            <div className="layer-tree-node__label">
              <strong
                className="tree-typography tree-typography--leaf"
                style={
                  colorizeLayer && layer.color ? { color: layer.color } : undefined
                }
              >
                {computeDisplayName(layer.name)}
              </strong>
            </div>
            <div className="layer-tree-node__actions layer-tree-node__actions--right">
              {renderLayerActions?.(layer, { isHidden, isVisible })}
              <span
                className={[
                  'equipment-card__chip',
                  'layer-tree-node__chip',
                  isVisible ? 'layer-tree-node__chip--visible' : 'layer-tree-node__chip--hidden',
                  isVisible ? 'active' : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </span>
            </div>
          </div>
        </div>
    );
  };

  return (
    <div className="layer-panel">
      {toolbar && <header className="layer-panel__header">{toolbar}</header>}
      <div className="layer-panel__body">
        {!isLoading && !activeFile && (
          <div className="layer-panel__message">도면을 선택해 주세요.</div>
        )}
        {!isLoading && activeFile && !hasLayers && (
          <div className="layer-panel__message">{emptyMessage}</div>
        )}
        {!isLoading && hasLayers && (
          <div className="layer-tree">
            {filteredLayers.map(renderLayer)}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerMenu;
