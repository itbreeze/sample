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

  // content-length 가 없거나 스트리밍 미지원인 경우
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
    const percent = Math.max(1, Math.floor((loaded / total) * 80)); // 다운로드 0~80%
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

  // 이벤트 등록
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

  // Resize
  const handleResize = () => {
    const canvas = canvasRef.current;
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!canvas || !viewer || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const newWidth = Math.floor(rect.width * dpr);
    const newHeight = Math.floor(rect.height * dpr);

    if (
      newWidth > 0 &&
      newHeight > 0 &&
      (canvas.width !== newWidth || canvas.height !== newHeight)
    ) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      viewer.resize?.(0, newWidth, newHeight, 0);
      viewer.update?.();
    }
  };

  // 뷰어 초기화
  useEffect(() => {
    if (!filePath || isInitializedRef.current) return;

    let isMounted = true;

    const init = async () => {
      try {
        setIsLoading(true);
        setLoadPercent(0);

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
          setLoadPercent(80); // 캐시 히트 시 즉시 80%
        } else {
          arrayBuffer = await fetchArrayBufferWithProgress(filePath, (p) => {
            if (isMounted) setLoadPercent(p); // 0~80%
          });
          if (!isMounted) return;
          fileCache.set(filePath, arrayBuffer);
        }

        // 파싱 단계
        setLoadPercent((p) => Math.max(p, 85));
        await viewerRef.current.parseVsfx(arrayBuffer);
        if (!isMounted) return;
        setLoadPercent(90);

        // 폰트 정규화/로딩
        try {
          await fixFonts(viewerRef.current, 'gulim.ttc', '/fonts');
        } catch {}
        try {
          await loadFonts(viewerRef.current, fontNameSetRef, '/fonts/');
        } catch {}
        setLoadPercent(95);

        // 초기 렌더
        viewerRef.current.setEnableSceneGraph(true);
        viewerRef.current.setEnableAnimation(false);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
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

  // initialState 적용
  useEffect(() => {
    if (!viewerRef.current || !initialState) return;
    const viewer = viewerRef.current;
    if (initialState.zoom !== undefined) viewer.setZoom(initialState.zoom);
    if (initialState.pan) viewer.setPan(initialState.pan.x, initialState.pan.y);
    if (initialState.camera) viewer.setCamera(initialState.camera);
  }, [viewerRef.current, initialState]);

  // isActive 변경 시 이벤트 설정
  useEffect(() => {
    if (isInitializedRef.current && isActive) attachEventListeners();
  }, [isActive]);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (viewerRef.current) handleResize();
    });

    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    handleResize(); // 초기 강제 resize

    return () => observer.disconnect();
  }, [filePath]);

  // 언마운트 정리
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
      {/* 전역 오버레이: 페이지 전체 덮음 */}
      <GlobalLoadingOverlay visible={isLoading} percent={loadPercent} />

      <div className="viewer-canvas-container" style={{ opacity: isLoading ? 0.35 : 1 }}>
        <canvas ref={canvasRef} id="viewerCanvas" />
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        {!isLoading && <TestModule />}
      </div>
    </div>
  );
};

export default DwgDisplay;
