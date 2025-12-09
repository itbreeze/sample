import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Palette, Eye, EyeOff } from 'lucide-react';
import LayerMenu from './LayerMenu';
import { useViewer } from '../viewer/context/ViewerContext';
import { getDocumentKeyFromFile } from '../viewer/utils/documentKey';
import { formatLayerName } from '../viewer/utils/layerName';
import './PipeLayerMenu.css';

const PipeLayerPanel = ({
  filterLayer,
  stripLayerKeywords,
  pipeLayerMatcher,
  highlightActions,
}) => {
  const [disabledLayerIds, setDisabledLayerIds] = useState(() => new Set());
  const disabledLayerIdsRef = useRef(disabledLayerIds);
  const disabledColor = useMemo(() => ({ r: 0, g: 0, b: 0 }), []);
  const colorToggle = highlightActions?.colorOnOff;

  const {
    openFiles,
    activeFileId,
    layerListsByDoc,
    hiddenLayersByDoc,
    toggleLayerVisibility,
    clearHiddenLayersForDoc,
  } = useViewer();
  const activeFile = openFiles.find((file) => file.DOCNO === activeFileId);
  const docKey = getDocumentKeyFromFile(activeFile);
  const layers = docKey ? layerListsByDoc?.[docKey] : undefined;
  const filteredLayers = useMemo(() => {
    if (!Array.isArray(layers)) return [];
    return layers.filter(filterLayer);
  }, [layers, filterLayer]);
  const layerCount = filteredLayers.length;
  const hiddenLayerSet = useMemo(() => {
    if (!docKey) return new Set();
    const list = hiddenLayersByDoc?.[docKey];
    return new Set(Array.isArray(list) ? list : []);
  }, [docKey, hiddenLayersByDoc]);
  const filteredLayerIds = useMemo(
    () =>
      filteredLayers
        .map((layer) => formatLayerName(layer.id))
        .filter(Boolean),
    [filteredLayers]
  );
  const allFilteredLayersHidden =
    filteredLayerIds.length > 0 &&
    filteredLayerIds.every((id) => hiddenLayerSet.has(id));

  const [pipeColorEnabled, setPipeColorEnabled] = useState(true);
  const toggleColor = useCallback(() => {
    setPipeColorEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    disabledLayerIdsRef.current = disabledLayerIds;
  }, [disabledLayerIds]);

  useEffect(() => {
    if (!colorToggle) return;
    colorToggle({
      layerMatcher: pipeLayerMatcher,
      enabled: pipeColorEnabled,
      disabledColor,
    });
    if (pipeColorEnabled && disabledLayerIdsRef.current.size) {
      disabledLayerIdsRef.current.forEach((layerId) => {
        colorToggle({
          layerMatcher: layerId,
          enabled: false,
          disabledColor,
        });
      });
    }
  }, [pipeColorEnabled, disabledColor, colorToggle, pipeLayerMatcher]);

  const handleLayerColorToggle = useCallback(
    (layer) => {
      if (!colorToggle || !pipeColorEnabled) return;
      const normalized = layer.id;
      const shouldEnable = disabledLayerIds.has(normalized);
      const applied = colorToggle({
        layerMatcher: normalized,
        enabled: shouldEnable,
        disabledColor,
      });
      if (!applied) return;
      setDisabledLayerIds((prev) => {
        const next = new Set(prev);
        if (shouldEnable) next.delete(normalized);
        else next.add(normalized);
        return next;
      });
    },
    [pipeColorEnabled, colorToggle, disabledColor, disabledLayerIds]
  );

  const handleToggleAllLayerVisibility = useCallback(() => {
    if (!docKey || !filteredLayers.length) return;
    if (allFilteredLayersHidden) {
      clearHiddenLayersForDoc(docKey);
      return;
    }
    filteredLayers.forEach((layer) => {
      const normalized = formatLayerName(layer.id);
      if (!normalized || hiddenLayerSet.has(normalized)) return;
      toggleLayerVisibility(docKey, layer.id);
    });
  }, [
    allFilteredLayersHidden,
    clearHiddenLayersForDoc,
    docKey,
    filteredLayers,
    hiddenLayerSet,
    toggleLayerVisibility,
  ]);

  return (
    <div className="pipe-layer-panel">
      <LayerMenu
        filterLayer={filterLayer}
        stripLayerKeywords={stripLayerKeywords}
        colorizeLayer={pipeColorEnabled}
        emptyMessage="배관 정보를 찾을 수 없습니다."
        toolbar={
          <>
            <div className="equipment-panel__header-title">
              <span>전체</span>
              <span className="equipment-panel__global-toggle-count">({layerCount})</span>
            </div>
            <div className="equipment-panel__header-actions">
              <button
                type="button"
                className="equipment-panel__global-toggle equipment-panel__global-toggle--wide"
                onClick={toggleColor}
                disabled={!layerCount}
              >
                <span className="equipment-panel__global-toggle-icon">
                  <Palette
                    size={20}
                    color={pipeColorEnabled ? '#facc15' : '#9ca3af'}
                  />
                </span>
              </button>
              <button
                type="button"
                className={`pipe-layer-toolbar__visibility ${
                  !allFilteredLayersHidden ? 'active' : ''
                }`}
                onClick={handleToggleAllLayerVisibility}
                disabled={!layerCount}
                aria-pressed={allFilteredLayersHidden}
                aria-label={
                  allFilteredLayersHidden ? '전체 보이기' : '전체 보기 끄기'
                }
              >
                {allFilteredLayersHidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </>
        }
        renderLayerActions={(layer) => {
          const isDisabled = disabledLayerIds.has(layer.id);
          const iconColor = !pipeColorEnabled
            ? '#9ca3af'
            : isDisabled
              ? '#9ca3af'
              : '#facc15';
          return (
            <button
              type="button"
              className="layer-tree-node__color-toggle"
              aria-pressed={!isDisabled}
              aria-label="색상 토글"
              title={
                !pipeColorEnabled
                  ? '전체 색상 끔'
                  : isDisabled
                    ? '색상 켜기'
                    : '색상 끄기'
              }
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                handleLayerColorToggle(layer);
              }}
              disabled={!pipeColorEnabled}
            >
              <Palette size={16} color={iconColor} />
            </button>
          );
        }}
      />
    </div>
  );
};

export default PipeLayerPanel;
