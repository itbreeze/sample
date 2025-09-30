// client/src/components/viewer/DwgDisplay.js

import React, { useEffect, useRef, useState } from 'react';
import './DwgDisplay.css';
import { attachWheelZoom, attachPan, attachClickInfo } from './viewerControls';

const fileCache = new Map();

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
                if (!canvas) throw new Error("Canvas element not available.");
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

    const [errorMessage, setErrorMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // 이벤트 등록
    const attachEventListeners = () => {
        if (!viewerRef.current || !canvasRef.current) return;

        // 기존 이벤트 제거
        cleanupFunctionsRef.current.forEach(cleanup => cleanup?.());
        cleanupFunctionsRef.current = [];

        // 안전하게 callback 없이 attach
        const cleanup1 = attachWheelZoom(viewerRef.current, canvasRef.current);
        const cleanup2 = attachPan(viewerRef.current, canvasRef.current);
        const cleanup3 = attachClickInfo(viewerRef.current, canvasRef.current);

        cleanupFunctionsRef.current = [cleanup1, cleanup2, cleanup3].filter(Boolean);
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


        if (newWidth > 0 && newHeight > 0 &&
            (canvas.width !== newWidth || canvas.height !== newHeight)) {
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

                const libInstance = await initializeVisualizeJS();
                if (!isMounted) return;

                const viewerInstance = await createViewer(libInstance, canvasRef.current);
                if (!isMounted) {
                    viewerInstance?.destroy();
                    return;
                }
                viewerRef.current = viewerInstance;

                let arrayBuffer;
                if (fileCache.has(filePath)) {
                    arrayBuffer = fileCache.get(filePath);
                } else {
                    const response = await fetch(filePath);
                    if (!response.ok) throw new Error('VSFX 파일 불러오기 실패');
                    arrayBuffer = await response.arrayBuffer();
                    fileCache.set(filePath, arrayBuffer);
                }

                if (!isMounted) return;

                await viewerRef.current.parseVsfx(arrayBuffer);
                viewerRef.current.setEnableSceneGraph(true);
                viewerRef.current.setEnableAnimation(false);
                viewerRef.current.zoomExtents?.();
                viewerRef.current.update?.();

                isInitializedRef.current = true;
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

        const handleScriptLoad = () => { init().catch(console.error); };

        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = '/Visualize.js';
            script.async = true;
            script.addEventListener('load', handleScriptLoad);
            script.onerror = () => {
                if (isMounted) { setErrorMessage('Visualize.js 로드 실패'); setIsLoading(false); }
            };
            document.body.appendChild(script);
        } else if (window.getVisualizeLibInst) {
            handleScriptLoad();
        } else {
            script.addEventListener('load', handleScriptLoad);
        }

        return () => { isMounted = false; };
    }, [filePath, isActive]);

    // initialState 적용
    useEffect(() => {
        if (!viewerRef.current || !initialState) return;
        const viewer = viewerRef.current;

        if (initialState.zoom !== undefined) viewer.setZoom(initialState.zoom);
        if (initialState.pan) viewer.setPan(initialState.pan.x, initialState.pan.y);
        if (initialState.camera) viewer.setCamera(initialState.camera);

    }, [viewerRef.current, initialState]);

    // isActive 변경 시 이벤트 재등록
    useEffect(() => {
        if (isInitializedRef.current && isActive) attachEventListeners();
    }, [isActive]);

    // ResizeObserver
    // ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(() => {
            // viewer가 초기화되면 resize 적용
            if (viewerRef.current) handleResize();
        });

        observer.observe(containerRef.current);
        resizeObserverRef.current = observer;

        // 초기 강제 resize
        handleResize();

        return () => observer.disconnect();
    }, [filePath]);

    // 언마운트 시 정리
    useEffect(() => {
        return () => {
            cleanupFunctionsRef.current.forEach(cleanup => cleanup?.());
            if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
            if (viewerRef.current) viewerRef.current.destroy?.();
        };
    }, []);

    return (
        <div ref={containerRef} className="viewer-app-container">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">도면 로딩 중...</div>
                </div>
            )}
            <div className="viewer-canvas-container" style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
                <canvas ref={canvasRef} id="viewerCanvas" />
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default DwgDisplay;
