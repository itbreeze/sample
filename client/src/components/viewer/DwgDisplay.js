// client/src/components/viewer/DwgDisplay.js

import React, { useEffect, useRef, useState } from 'react';
import './DwgDisplay.css';
import { attachWheelZoom, attachPan, attachClickInfo } from './viewerControls';

const fileCache = new Map();

const initializeVisualizeJS = async () => {
    if (!window.getVisualizeLibInst) {
        throw new Error('VisualizeJS가 로드되지 않았습니다. public 폴더에 Visualize.js 파일이 있는지 확인하세요.');
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
                if (!canvas) throw new Error("Canvas element not available for viewer creation.");
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

const getCurrentViewState = (viewer) => {
    if (!viewer) return null;
    const view = viewer.activeView;
    if (!view) return null;

    if (view.position && view.target && view.upVector) {
        const viewParams = {
            position: view.position.toArray(),
            target: view.target.toArray(),
            upVector: view.upVector.toArray(),
            fieldWidth: view.fieldWidth,
            fieldHeight: view.fieldHeight,
            projection: view.projection,
        };
        view.delete();
        return viewParams;
    }
    
    view.delete();
    return null;
};

// --- React Component ---
const DwgDisplay = ({ filePath, initialViewState, onViewStateChange, onViewerReady, viewerSize }) => {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const isInitialZoomDone = useRef(false);
    
    const [errorMessage, setErrorMessage] = useState(null);
    const [isViewerReady, setIsViewerReady] = useState(false);
    const [isCanvasVisible, setIsCanvasVisible] = useState(false);

    useEffect(() => {
        if (!filePath) return;

        let isMounted = true;
        
        setIsViewerReady(false);
        setIsCanvasVisible(false);

        const init = async () => {
            let cleanupFunctions = [];
            try {
                isInitialZoomDone.current = false;
                if (!isMounted || !canvasRef.current) return;
                
                const libInstance = await initializeVisualizeJS();
                if (!isMounted) return;

                const viewerInstance = await createViewer(libInstance, canvasRef.current);
                if (!isMounted) { viewerInstance?.destroy(); return; }
                viewerRef.current = viewerInstance;

                // 🔹 뷰어 준비 완료 콜백
                if (onViewerReady) {
                    onViewerReady(viewerInstance);
                }

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
                
                cleanupFunctions.push(attachWheelZoom(viewerRef.current, canvasRef.current) || (() => {}));
                cleanupFunctions.push(attachPan(viewerRef.current, canvasRef.current) || (() => {}));
                cleanupFunctions.push(attachClickInfo(viewerRef.current, canvasRef.current) || (() => {}));

                setIsViewerReady(true);
            } catch (err) {
                if (isMounted) setErrorMessage(err.message);
            }
            
            return cleanupFunctions;
        };
        
        let activeCleanups = [];
        const scriptId = 'visualize-script';
        let script = document.getElementById(scriptId);
        const handleScriptLoad = () => {
            init().then(cleanups => {
                if (isMounted) {
                    activeCleanups = cleanups;
                }
            }).catch(console.error);
        };
        
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = '/Visualize.js';
            script.async = true;
            script.addEventListener('load', handleScriptLoad);
            script.onerror = () => { if (isMounted) setErrorMessage('Visualize.js 로드 실패'); };
            document.body.appendChild(script);
        } else if (window.getVisualizeLibInst) {
            handleScriptLoad();
        } else {
            script.addEventListener('load', handleScriptLoad);
        }
        
        return () => {
            isMounted = false;
            activeCleanups.forEach(cleanup => cleanup());
            if (viewerRef.current) {
                // 🔹 컴포넌트 언마운트 시 뷰 상태 저장
                if (onViewStateChange) {
                    const lastState = getCurrentViewState(viewerRef.current);
                    if (lastState) {
                        onViewStateChange(lastState);
                    }
                }
                viewerRef.current.destroy?.();
                viewerRef.current = null;
            }
            if (script) {
                script.removeEventListener('load', handleScriptLoad);
            }
        };
    }, [filePath, onViewStateChange, onViewerReady]);

    useEffect(() => {
        const viewer = viewerRef.current;
        const canvas = canvasRef.current;
        
        if (!isViewerReady || !viewer || !canvas || viewerSize.width === 0 || viewerSize.height === 0) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const newWidth = Math.floor(viewerSize.width * dpr);
        const newHeight = Math.floor(viewerSize.height * dpr);

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            viewer.resize?.(0, newWidth, newHeight, 0);
        }
        
        if (!isInitialZoomDone.current) {
            if (initialViewState) {
                // 🔹 저장된 뷰 상태 복원
                const view = viewer.activeView;
                if (view) {
                    if (initialViewState.position && initialViewState.target && initialViewState.upVector) {
                        view.setView(
                            initialViewState.position,
                            initialViewState.target,
                            initialViewState.upVector,
                            initialViewState.fieldWidth,
                            initialViewState.fieldHeight,
                            initialViewState.projection
                        );
                    }
                    view.delete();
                }
            } else {
                // 🔹 초기 줌 익스텐트
                viewer.zoomExtents?.();
            }
            isInitialZoomDone.current = true;
            
            requestAnimationFrame(() => setIsCanvasVisible(true));
        }
        
        viewer.update?.();
    }, [viewerSize, isViewerReady, initialViewState]);

    return (
        <div className="viewer-app-container">
            {!isCanvasVisible && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">도면 로딩 중...</div>
                </div>
            )}
            <div className="viewer-canvas-container" style={{ visibility: isCanvasVisible ? 'visible' : 'hidden' }}>
                <canvas ref={canvasRef} id="viewerCanvas" />
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default React.memo(DwgDisplay);