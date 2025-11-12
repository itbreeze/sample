import React, { useEffect, useRef, useState } from 'react';
import './DwgDisplay.css';
import { attachWheelZoom, attachPan, attachLeftClickSelect, attachDragSelect } from './viewerControls';
import TestModule from './testmodule';
import { fixFonts, loadFonts } from './fontUtils';
import GlobalLoadingOverlay from '../common/GlobalLoadingOverlay';

const fileCache = new Map();

/** 진행률 콜백을 지원하는 fetch(ArrayBuffer) */
async function fetchArrayBufferWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('VSFX 파일 불러오기 실패');
  const contentLength = res.headers.get('content-length');

  if (!res.body || !contentLength) {
    const ab = await res.arrayBuffer();
    onProgress?.(100);
    return ab;
  }

  const total = parseInt(contentLength, 10);
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    const percent = Math.max(1, Math.floor((loaded / total) * 80));
    onProgress?.(percent);
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress?.(80);
  return merged.buffer;
}

const initializeVisualizeJS = async () => {
  if (!window.getVisualizeLibInst) {
    throw new Error('VisualizeJS가 로드되지 않았습니다.');
  }
  const wasmUrl = window.WasmUrl || '/Visualize.js.wasm';
  return await window.getVisualizeLibInst({
    TOTAL_MEMORY: 200 * 1024 * 1024,
    urlMemFile: wasmUrl,
  });
};

const createViewer = async (lib, canvas) => {
  return new Promise((resolve, reject) => {
    lib.postRun.push(async () => {
      try {
        if (!canvas) throw new Error('Canvas element not available.');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        lib.canvas = canvas;
        lib.Viewer.initRender(canvas.width, canvas.height, true);
        const viewer = lib.Viewer.create();
        resolve(viewer);
      } catch (err) {
        reject(err);
      }
    });
  });
};

const DwgDisplay = ({ filePath, isActive, initialState, onStateChange }) => {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const cleanupFunctionsRef = useRef([]);
  const resizeObserverRef = useRef(null);
  const fontNameSetRef = useRef(new Set());

  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadPercent, setLoadPercent] = useState(0);
  const [displayPercent, setDisplayPercent] = useState(1);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // 디스플레이 퍼센트를 부드럽게 증가
  useEffect(() => {
    if (!isLoading || displayPercent >= 100) return;

    const timer = setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= loadPercent) return prev;
        // 목표값과의 차이에 따라 증가 속도 조절
        const diff = loadPercent - prev;
        const step = Math.max(1, Math.ceil(diff / 10));
        return Math.min(prev + step, loadPercent);
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isLoading, loadPercent, displayPercent]);

  const handleMouseEvent = (e) => {
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const attachEventListeners = () => {
    if (!viewerRef.current || !canvasRef.current) return;

    cleanupFunctionsRef.current.forEach((fn) => fn?.());
    cleanupFunctionsRef.current = [];

    const cleanup1 = attachWheelZoom(viewerRef.current, canvasRef.current);
    const cleanup2 = attachPan(viewerRef.current, canvasRef.current);
    const cleanup3 = attachLeftClickSelect(viewerRef.current, canvasRef.current);
    const cleanup4 = attachDragSelect(viewerRef.current, canvasRef.current);

    cleanupFunctionsRef.current = [cleanup1, cleanup2, cleanup3, cleanup4].filter(Boolean);
  };

  const handleResize = () => {
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
  };

  useEffect(() => {
    if (!filePath || isInitializedRef.current) return;

    let isMounted = true;

    const init = async () => {
      try {
        setIsLoading(true);
        setLoadPercent(1);
        setDisplayPercent(1);

        const libInstance = await initializeVisualizeJS();
        if (!isMounted) return;

        const viewerInstance = await createViewer(libInstance, canvasRef.current);
        if (!isMounted) {
          viewerInstance?.destroy();
          return;
        }
        viewerRef.current = viewerInstance;
        window.currentViewerInstance = viewerRef.current;

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

        setLoadPercent((p) => Math.max(p, 85));
        await viewerRef.current.parseVsfx(arrayBuffer);
        if (!isMounted) return;
        setLoadPercent(90);

        try {
          await fixFonts(viewerRef.current, 'gulim.ttc', '/fonts');
        } catch {}
        try {
          await loadFonts(viewerRef.current, fontNameSetRef, '/fonts/');
        } catch {}
        setLoadPercent(95);

        viewerRef.current.setEnableSceneGraph(true);
        viewerRef.current.setEnableAnimation(false);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
        
        // displayPercent가 100에 도달할 때까지 대기
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            setDisplayPercent(prev => {
              if (prev >= 100) {
                clearInterval(checkInterval);
                resolve();
                return 100;
              }
              return Math.min(prev + 2, 100);
            });
          }, 20);
        });
        
        setIsLoading(false);

        if (isActive) attachEventListeners();
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message);
          setIsLoading(false);
        }
      }
    };

    const scriptId = 'visualize-script';
    let script = document.getElementById(scriptId);

    const handleScriptLoad = () => {
      init().catch(console.error);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = '/Visualize.js';
      script.async = true;
      script.addEventListener('load', handleScriptLoad);
      script.onerror = () => {
        if (isMounted) {
          setErrorMessage('Visualize.js 로드 실패');
          setIsLoading(false);
        }
      };
      document.body.appendChild(script);
    } else if (window.getVisualizeLibInst) {
      handleScriptLoad();
    } else {
      script.addEventListener('load', handleScriptLoad);
    }

    return () => {
      isMounted = false;
    };
  }, [filePath, isActive]);

  useEffect(() => {
    if (!viewerRef.current || !initialState) return;
    const viewer = viewerRef.current;
    if (initialState.zoom !== undefined) viewer.setZoom(initialState.zoom);
    if (initialState.pan) viewer.setPan(initialState.pan.x, initialState.pan.y);
    if (initialState.camera) viewer.setCamera(initialState.camera);
  }, [initialState]);

  useEffect(() => {
    if (isInitializedRef.current && isActive) attachEventListeners();
  }, [isActive]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (viewerRef.current) handleResize();
    });

    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    handleResize();

    return () => observer.disconnect();
  }, [filePath]);

  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach((fn) => fn?.());
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (viewerRef.current) viewerRef.current.destroy?.();
    };
  }, []);

  const containerClassName = isLoading ? 'viewer-app-container loading' : 'viewer-app-container';

  return (
    <div ref={containerRef} className={containerClassName} aria-busy={isLoading}>
      <GlobalLoadingOverlay visible={isLoading} percent={displayPercent} />
      <div className="viewer-canvas-container" style={{ opacity: isLoading ? 0.35 : 1 }}>
        <canvas
          ref={canvasRef}
          id="viewerCanvas"
          onMouseMove={handleMouseEvent}
          onMouseDown={handleMouseEvent}
        />
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        {!isLoading && <TestModule lastMouse={lastMouse} />}
      </div>
    </div>
  );
};

export default DwgDisplay;