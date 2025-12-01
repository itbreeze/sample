// client/src/components/viewer/Canvas.js
/* eslint-env browser */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  fileCache,
  fetchArrayBufferWithProgress,
  initializeVisualizeJS,
  createViewer,
  fixFonts,
  loadFonts,
  collectSelectedEntities,
  updateRedSelection,
  applyTempColorOverride,
} from './CanvasUtils';
import FloatingToolbar from './FloatingToolbar';
import { attachCanvasInteractions } from './CanvasController';
import EntityPanel, { MIN_WIDTH as PANEL_MIN_WIDTH, MIN_HEIGHT as PANEL_MIN_HEIGHT } from './EntityPanel';
import GlobalLoadingOverlay from '../common/GlobalLoadingOverlay';

const Canvas = ({
  filePath,
  docno,
  isActive,
  visible,          // 그대로 두고 싶으면 유지 (없애도 무관)
  onReadyChange,
  canvasId,
  isFavorite,
  onToggleFavorite,
}) => { 

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const libRef = useRef(null);
  const isInitializedRef = useRef(false);
  const hasFitRef = useRef(false);
  const resizeObserverRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const zoomTimeoutRef = useRef(null);
  const interactionsCleanupRef = useRef(null);
  const fontNameSetRef = useRef(new Set());
  const entityDataMapRef = useRef(new Map());
  const prevRedHandlesRef = useRef(new Set());

  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadPercent, setLoadPercent] = useState(0);

  const [selectedHandles, setSelectedHandles] = useState([]);
  const [entities, setEntities] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const PANEL_DEFAULT = { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT };


  const computePanelPosition = (width, height) => {
    const vw = window?.innerWidth || 1200;
    const vh = window?.innerHeight || 800;
    return {
      x: Math.max(8, vw - width - 24),
      y: Math.max(8, vh - height - 40),
    };
  };

  const clampPanelPosition = (position, size) => {
    const vw = window?.innerWidth || 1200;
    const vh = window?.innerHeight || 800;
    const maxX = Math.max(8, vw - size.width - 24);
    const maxY = Math.max(8, vh - size.height - 40);
    return {
      x: Math.min(Math.max(8, position.x), maxX),
      y: Math.min(Math.max(8, position.y), maxY),
    };
  };

  const [panelPosition, setPanelPosition] = useState(() => {
    const initial = computePanelPosition(PANEL_DEFAULT.width, PANEL_DEFAULT.height);
    return clampPanelPosition(initial, PANEL_DEFAULT);
  });
  const [panelSize, setPanelSize] = useState(PANEL_DEFAULT);

  const clearSelection = useCallback(() => {
    if (prevRedHandlesRef.current.size > 0) {
      updateRedSelection(
        viewerRef.current,
        libRef.current,
        entityDataMapRef.current,
        prevRedHandlesRef,
        []
      );
    }
    viewerRef.current?.unselect?.();
    viewerRef.current?.update?.();
    setSelectedHandles([]);
    setEntities([]);
    setShowPanel(false);
  }, []);

  // 선택 이벤트 처리
  const handleSelect = useCallback(
    (payload) => {
      const additive = !!payload?.additive;
      const viewer = viewerRef.current;
      const selectionHandles = collectSelectedEntities(
        viewer,
        libRef.current,
        entityDataMapRef,
        true
      );
      const incoming =
        payload?.handles && Array.isArray(payload.handles) && payload.handles.length
          ? payload.handles
          : selectionHandles;

      let handles = incoming;
      if (additive) {
        const current = new Set(selectedHandles || []);
        incoming.forEach((h) => {
          const key = String(h);
          if (current.has(key)) {
            current.delete(key); // 토글
          } else {
            current.add(key);
          }
        });
        handles = Array.from(current);
      }

      if (!handles || handles.length === 0) {
        clearSelection();
        return;
      }

      const applySelectionHandles = (hList) => {
        if (!viewer) return;
        try {
          viewer.unselect?.();
          if (Array.isArray(hList)) {
            hList.forEach((h) => {
              try {
                viewer.setSelectedEntity?.(h);
              } catch (_) { }
              try {
                viewer.setSelected?.(h);
              } catch (_) { }
            });
          }
          viewer.update?.();
        } catch (_) { }
      };
      applySelectionHandles(handles);

      const mappedEntities = handles.map((h) => {
        const data = entityDataMapRef.current.get(String(h)) || {};
        const displayColor = (() => {
          if (data.colorType === 'kColor' && data.trueColor) return data.trueColor;
          if (data.colorType === 'kIndexed' && Number.isFinite(data.indexColor)) return data.indexColor;
          if (data.colorType === 'kDefault' && data.trueColor) return data.trueColor;
          if (data.colorType === 'kDefault' && Number.isFinite(data.indexColor)) return data.indexColor;
          return data.objectColor ?? null;
        })();
        return {
          handle: h,
          ...data,
          objectColor: displayColor,
          layerColor: data.layerColor ?? null,
          lastColorOption: data.lastColorOption ?? null,
          initialOriginalColor: data.initialOriginalColor ?? null,
          hasColorChanged: data.hasColorChanged ?? false,
        };
      });

      updateRedSelection(
        viewerRef.current,
        libRef.current,
        entityDataMapRef.current,
        prevRedHandlesRef,
        handles
      );

      setSelectedHandles(handles);
      setEntities(mappedEntities);
      setShowPanel(true);
    },
    [selectedHandles, clearSelection]
  );

  useEffect(() => {
    if (isActive && !isLoading && viewerRef.current) {
      window.currentViewerInstance = viewerRef.current;
      window.currentViewerDocno = docno || null;
      viewerRef.current.update?.();
    }
  }, [isActive, isLoading, docno]);

  const attachInteractions = useCallback(() => {
    const cleanup = attachCanvasInteractions(
      viewerRef.current,
      canvasRef.current,
      libRef.current,
      {
        onSelect: handleSelect,
        cursorColor: isInverted ? '#ffffff' : '#000000',
      }
    );
    interactionsCleanupRef.current = cleanup;
  }, [handleSelect, isInverted]);

  const toggleInvert = useCallback(() => {
    setIsInverted((prev) => !prev);
  }, []);

  const runZoomExtents = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.zoomExtents?.();
    viewer.update?.();
  }, []);

  const scheduleZoomExtents = useCallback(
    (delay = 80) => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(runZoomExtents, delay);
    },
    [runZoomExtents]
  );

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!canvas || !viewer || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const newWidth = Math.floor(rect.width * dpr);
    const newHeight = Math.floor(rect.height * dpr);

    if (newWidth > 0 && newHeight > 0 && (canvas.width !== newWidth || canvas.height !== newHeight)) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      viewer.resize?.(0, newWidth, newHeight, 0);
      viewer.update?.();
    }
  }, []);

  /** 초기 로딩 */
  useEffect(() => {

    let isMounted = true;

    const init = async () => {
      try {
        hasFitRef.current = false;
        setIsLoading(true);
        setLoadPercent(1);

        const libInstance = await initializeVisualizeJS();
        if (!isMounted) return;
        libRef.current = libInstance;

        const viewerInstance = await createViewer(libInstance, canvasRef.current);
        if (!isMounted) {
          viewerInstance?.destroy();
          return;
        }
        viewerRef.current = viewerInstance;
        window.currentViewerInstance = viewerInstance;

        let arrayBuffer;
        if (fileCache.has(filePath)) {          
          arrayBuffer = fileCache.get(filePath);
          setLoadPercent(30);
        } else {          
          arrayBuffer = await fetchArrayBufferWithProgress(filePath, (p) => {
            if (isMounted) setLoadPercent(p);
          });
          if (!isMounted) return;
          fileCache.set(filePath, arrayBuffer);
        }

        setLoadPercent(85);
        await viewerRef.current.parseVsfx(arrayBuffer);
        if (!isMounted) return;

        try {
          await fixFonts(viewerRef.current, 'gulim.ttc', '/fonts');
          await loadFonts(viewerRef.current, fontNameSetRef, '/fonts');
        } catch (e) { }

        setLoadPercent(95);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
        setIsLoading(false);        
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message);
          setIsLoading(false);
        }
      } 
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  // visible 대신 isActive만 써도 되는 구조로 바꿀 수 있음
  useEffect(() => {
    if (isInitializedRef.current && !isLoading) {
      if (isActive) {
        if (interactionsCleanupRef.current) interactionsCleanupRef.current();
        attachInteractions();
      } else if (interactionsCleanupRef.current) {
        interactionsCleanupRef.current();
        interactionsCleanupRef.current = null;
      }
    }
  }, [isActive, isLoading, attachInteractions]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = requestAnimationFrame(() => {
        if (viewerRef.current) handleResize();
        resizeFrameRef.current = null;
      });
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;
    handleResize();
    return () => {
      if (interactionsCleanupRef.current) interactionsCleanupRef.current();
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      if (viewerRef.current) viewerRef.current.destroy?.();
    };
  }, [handleResize]);

  useEffect(() => {
    const handleWindowResize = () => {
      setPanelPosition((prev) => clampPanelPosition(prev, panelSize));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [panelSize]);

  useEffect(() => {
    setPanelPosition((prev) => clampPanelPosition(prev, panelSize));
  }, [panelSize]);

  useEffect(() => {
    const base = computePanelPosition(panelSize.width, panelSize.height);
    setPanelPosition(clampPanelPosition(base, panelSize));
  }, [docno]);

  useEffect(() => {
    if (typeof onReadyChange === 'function') {
      onReadyChange(docno, !isLoading);
    }
  }, [docno, isLoading, onReadyChange]);

  const zoomFactor = 0.2;

  useEffect(() => {
    if (!isLoading && isActive && !hasFitRef.current) {
      hasFitRef.current = true;
      scheduleZoomExtents(120);
    }
  }, [isActive, isLoading, scheduleZoomExtents]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isActive, isLoading, clearSelection]);

  const handleZoomToEntity = useCallback(
    (handle) => {
      const viewer = viewerRef.current;
      const canvas = canvasRef.current;
      if (!viewer || !handle || !canvas) return;
      viewer.zoomToEntity?.(handle);
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      viewer.zoomAt?.(zoomFactor, centerX, centerY);
      viewer.update?.();
    },
    [zoomFactor]
  );

  const handleColorOverride = useCallback((handle, option) => {
    if (!handle || !option) return;
    const ok = applyTempColorOverride(
      viewerRef.current,
      libRef.current,
      entityDataMapRef.current,
      handle,
      option
    );
    if (ok) {
      const dataMap = entityDataMapRef.current;
      setEntities((prev) =>
        prev.map((ent) => {
          if (String(ent.handle) !== String(handle)) return ent;
          const updated = dataMap?.get(String(handle));
          return {
            ...ent,
            objectColor: updated?.objectColor ?? ent.objectColor,
            colorType: updated?.colorType ?? ent.colorType,
            indexColor: updated?.indexColor ?? ent.indexColor,
            originalColor: updated?.originalColor ?? ent.originalColor,
            initialOriginalColor: updated?.initialOriginalColor ?? ent.initialOriginalColor,
            lastColorOption: updated?.lastColorOption ?? ent.lastColorOption,
            hasColorChanged: updated?.hasColorChanged ?? ent.hasColorChanged,
          };
        })
      );
    }
  }, []);

  const visibleStyle = { opacity: isLoading ? 0.35 : 1 };
  const invertStyle = isInverted ? { filter: 'invert(1)' } : {};

  return (
    <div
      ref={containerRef}
      className="viewer-app-container"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
    >
      <GlobalLoadingOverlay visible={isLoading} percent={loadPercent} />
      <div className="viewer-canvas-container" style={{ flex: 1, position: 'relative', ...visibleStyle, ...invertStyle }}>
        <canvas
          ref={canvasRef}
          id={canvasId || `canvas-${docno}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {isActive && (
          <FloatingToolbar
            onToggleInvert={toggleInvert}
            isInverted={isInverted}
            onOpenPanel={() => setShowPanel((prev) => !prev)}
            isInfoActive={showPanel}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {errorMessage && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.9)',
              padding: '12px 16px',
              borderRadius: '8px',
              color: 'red',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      {showPanel && (
        <EntityPanel
          entities={entities}
          onClose={() => setShowPanel(false)}
          initialPosition={panelPosition}
          onPositionChange={(pos) => setPanelPosition(clampPanelPosition(pos, panelSize))}
          initialSize={panelSize}
          onSizeChange={(size) => {
            setPanelSize(size);
            setPanelPosition((prev) => clampPanelPosition(prev, size));
          }}
          resolveEntityColorDetails={(entityId) => {
            const entry = entityDataMapRef.current?.get(String(entityId)) || null;
            if (!entry) return null;
            return {
              objectColor: entry.originalColor || null,
              layer: entry.layer || null,
              type: entry.type || null,
            };
          }}
          onZoomToEntity={handleZoomToEntity}
          onColorOverride={handleColorOverride}
          onToggleInvert={toggleInvert}
          isInverted={isInverted}
          onRestoreOriginal={() => {
            const handles = selectedHandles || [];
            handles.forEach((h) => {
              applyTempColorOverride(
                viewerRef.current,
                libRef.current,
                entityDataMapRef.current,
                h,
                'restore-initial'
              );
            });
            setEntities((prev) =>
              prev.map((ent) => {
                if (!handles.includes(ent.handle)) return ent;
                const data = entityDataMapRef.current.get(String(ent.handle));
                if (!data) return ent;
                return {
                  ...ent,
                  objectColor: data.objectColor ?? data.originalColor ?? ent.objectColor,
                  colorType: data.colorType ?? ent.colorType,
                  indexColor: data.indexColor ?? ent.indexColor,
                  originalColor: data.originalColor ?? ent.originalColor,
                  lastColorOption: data.lastColorOption ?? null,
                };
              })
            );
          }}
        />
      )}
    </div>
  );
};

export default Canvas;
