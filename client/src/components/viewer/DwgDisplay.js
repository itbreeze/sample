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

// 🔹 React Component - isActive prop 추가
const DwgDisplay = ({ filePath, isActive }) => {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const isInitializedRef = useRef(false);
    const cleanupFunctionsRef = useRef([]);
    
    const [errorMessage, setErrorMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // 🔹 뷰어 초기화 (한 번만 실행)
    useEffect(() => {
        if (!filePath || isInitializedRef.current) return;

        let isMounted = true;
        
        const init = async () => {
            try {
                setIsLoading(true);
                
                if (!isMounted || !canvasRef.current) return;
                
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
                
                const cleanup1 = attachWheelZoom(viewerRef.current, canvasRef.current);
                const cleanup2 = attachPan(viewerRef.current, canvasRef.current);
                const cleanup3 = attachClickInfo(viewerRef.current, canvasRef.current);
                
                cleanupFunctionsRef.current = [cleanup1, cleanup2, cleanup3].filter(Boolean);

                viewerRef.current.zoomExtents?.();
                viewerRef.current.update?.();
                
                isInitializedRef.current = true;
                setIsLoading(false);
                
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
    }, [filePath]);

    // 🔹 활성화 상태에 따라 업데이트
    useEffect(() => {
        if (isActive && viewerRef.current && isInitializedRef.current) {
            viewerRef.current.update?.();
        }
    }, [isActive]);

    // 🔹 언마운트 시에만 정리
    useEffect(() => {
        return () => {
            cleanupFunctionsRef.current.forEach(cleanup => cleanup?.());
            if (viewerRef.current) {
                viewerRef.current.destroy?.();
                viewerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="viewer-app-container">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">도면 로딩 중...</div>
                </div>
            )}
            <div 
                className="viewer-canvas-container" 
                style={{ visibility: isLoading ? 'hidden' : 'visible' }}
            >
                <canvas ref={canvasRef} id="viewerCanvas" />
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default React.memo(DwgDisplay);