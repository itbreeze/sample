// client/src/components/viewer/Canvas.js
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
} from './CanvasUtils';
import { attachCanvasInteractions } from './CanvasController';
import EntityPanel, { MIN_WIDTH as PANEL_MIN_WIDTH, MIN_HEIGHT as PANEL_MIN_HEIGHT } from './EntityPanel';
import GlobalLoadingOverlay from '../common/GlobalLoadingOverlay';

const Canvas = ({ filePath, isActive }) => {
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
  const PANEL_DEFAULT = { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT };

  const computePanelPosition = (width, height) => {
    const vw = window?.innerWidth || 1200;
    const vh = window?.innerHeight || 800;
    return {
      x: Math.max(8, vw - width - 24),
      y: Math.max(8, vh - height - 40),
    };
  };

  const [panelPosition, setPanelPosition] = useState(() =>
    computePanelPosition(PANEL_DEFAULT.width, PANEL_DEFAULT.height)
  );
  const [panelSize, setPanelSize] = useState(PANEL_DEFAULT);

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

  // 선택 이벤트 처리
  const handleSelect = useCallback(
    (payload) => {
      const handles =
        payload?.handles && Array.isArray(payload.handles) && payload.handles.length
          ? payload.handles
          : collectSelectedEntities(viewerRef.current, libRef.current, entityDataMapRef, false);

      // 선택된 것이 없으면 상태 초기화
      if (!handles || handles.length === 0) {
        // 이전 빨간 선택 모두 해제
        if (prevRedHandlesRef.current.size > 0) {
          updateRedSelection(viewerRef.current, libRef.current, entityDataMapRef.current, prevRedHandlesRef, []);
        }
        setSelectedHandles([]);
        setEntities([]);
        setShowPanel(false);
        return;
      }

      // 선택된 엔티티의 메타 데이터 매핑
      const mappedEntities = handles.map((h) => ({
        handle: h,
        ...(entityDataMapRef.current.get(String(h)) || {}),
      }));

      // 선택된 엔티티들을 빨간색으로 표시하고, 이전 선택은 해제
      updateRedSelection(viewerRef.current, libRef.current, entityDataMapRef.current, prevRedHandlesRef, handles);

      setSelectedHandles(handles);
      setEntities(mappedEntities);
      setShowPanel(true);
    },
    []
  );

  useEffect(() => {
    if (isActive && !isLoading && viewerRef.current) {
      viewerRef.current.update?.();
    }
  }, [isActive, isLoading]);

  const attachInteractions = useCallback(() => {
    const cleanup = attachCanvasInteractions(
      viewerRef.current,
      canvasRef.current,
      libRef.current,
      { onSelect: handleSelect }
    );
    interactionsCleanupRef.current = cleanup;
  }, [handleSelect]);

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

  /** 캔버스 리사이즈 처리 */
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
      if (!isLoading) {
        scheduleZoomExtents(80);
      }
    }
  }, [isLoading, scheduleZoomExtents]);

  /** 초기 로딩 */
  useEffect(() => {
    if (!filePath || isInitializedRef.current) return;

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
        } catch (e) {}

        setLoadPercent(95);
        viewerRef.current.setEnableSceneGraph?.(true);
        viewerRef.current.setEnableAnimation?.(false);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
        setIsLoading(false);

        if (isActive) attachInteractions();
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
  }, [filePath, handleResize, isActive, attachInteractions]);

  useEffect(() => {
    // 로딩이 끝난 뒤에도 탭 토글 없이 인터랙션이 붙도록 보정
    if (isInitializedRef.current && isActive && !isLoading) {
      if (interactionsCleanupRef.current) interactionsCleanupRef.current();
      attachInteractions();
    } else if (!isActive && interactionsCleanupRef.current) {
      interactionsCleanupRef.current();
      interactionsCleanupRef.current = null;
    }
  }, [isActive, isLoading, attachInteractions]);

  /** ResizeObserver 등록 */
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

  const zoomFactor = 0.2;

  // 초기 로딩이 끝난 후 화면 맞추기(뷰어 영역 자동 조정)
  useEffect(() => {
    if (!isLoading && isActive && !hasFitRef.current) {
      hasFitRef.current = true;
      scheduleZoomExtents(120);
    }
  }, [isActive, isLoading, scheduleZoomExtents]);

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

  const visibleStyle = { opacity: isLoading ? 0.35 : 1 };

  return (
    <div
      ref={containerRef}
      className="viewer-app-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
    >
      <GlobalLoadingOverlay
        visible={isLoading}
        percent={loadPercent}
      />
      <div className="viewer-canvas-container" style={{ flex: 1, position: 'relative', ...visibleStyle }}>
        <canvas
          ref={canvasRef}
          id="mainCanvas"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

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
          selectedHandles={selectedHandles}
          onClose={() => setShowPanel(false)}
          panelPosition={panelPosition}
          setPanelPosition={(pos) => setPanelPosition(clampPanelPosition(pos, panelSize))}
          panelSize={panelSize}
          setPanelSize={(size) => setPanelSize(clampPanelPosition(panelPosition, size) && size)}
          resolveEntityColorDetails={(entityId) => {
            // entityDataMapRef에 기록된 원본 색상 / 레이어 / 타입 정보 반환
            const entry = entityDataMapRef.current?.get(String(entityId)) || null;
            if (!entry) return null;
            return {
              objectColor: entry.originalColor || null,
              layer: entry.layer || null,
              type: entry.type || null,
            };
          }}
          onZoomToEntity={handleZoomToEntity}
        />
      )}
    </div>
  );
};

export default Canvas;
