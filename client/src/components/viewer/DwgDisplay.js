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

const DwgDisplay = ({ filePath, isActive }) => {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const containerRef = useRef(null);
    const isInitializedRef = useRef(false);
    const cleanupFunctionsRef = useRef([]);
    const resizeObserverRef = useRef(null);
    
    const [errorMessage, setErrorMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // 🔹 이벤트 리스너 등록 함수 (독립적으로 분리)
    const attachEventListeners = () => {
        if (!viewerRef.current || !canvasRef.current) {
            console.warn('[DwgDisplay] 이벤트 리스너 등록 실패: viewer 또는 canvas 없음');
            return;
        }

        console.log('[DwgDisplay] 이벤트 리스너 등록');

        // 🔹 기존 리스너 정리
        cleanupFunctionsRef.current.forEach(cleanup => cleanup?.());
        cleanupFunctionsRef.current = [];

        // 🔹 새로운 리스너 등록
        const cleanup1 = attachWheelZoom(viewerRef.current, canvasRef.current);
        const cleanup2 = attachPan(viewerRef.current, canvasRef.current);
        const cleanup3 = attachClickInfo(viewerRef.current, canvasRef.current);
        
        cleanupFunctionsRef.current = [cleanup1, cleanup2, cleanup3].filter(Boolean);
    };

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

                viewerRef.current.zoomExtents?.();
                viewerRef.current.update?.();
                
                isInitializedRef.current = true;
                setIsLoading(false);
                
                // 🔹 초기화 완료 후 이벤트 리스너 등록
                if (isActive) {
                    // 약간의 지연을 두어 DOM이 완전히 준비된 후 등록
                    setTimeout(() => {
                        if (isMounted) {
                            attachEventListeners();
                        }
                    }, 100);
                }
                
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
    }, [filePath, isActive]); // 🔹 isActive 의존성 추가

    // 🔹 isActive 변경 시 이벤트 리스너 재등록
    useEffect(() => {
        if (!isInitializedRef.current || !isActive) {
            return;
        }

        console.log('[DwgDisplay] 탭 활성화 - 이벤트 리스너 재등록');
        
        attachEventListeners();

        // 뷰어 업데이트
        if (viewerRef.current) {
            viewerRef.current.update?.();
        }

    }, [isActive]); // 🔹 isActive가 변경될 때마다 실행

    // 🔹 ResizeObserver 설정
    useEffect(() => {
        if (!viewerRef.current || !isInitializedRef.current || !containerRef.current) {
            return;
        }

        let resizeTimeout;
        
        const handleResize = (entries) => {
            if (!entries || entries.length === 0) return;

            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const { width, height } = entries[0].contentRect;
                
                if (width === 0 || height === 0) return;

                const canvas = canvasRef.current;
                const viewer = viewerRef.current;
                
                if (!canvas || !viewer) return;

                const dpr = window.devicePixelRatio || 1;
                const newWidth = Math.floor(width * dpr);
                const newHeight = Math.floor(height * dpr);

                if (canvas.width !== newWidth || canvas.height !== newHeight) {
                    console.log(`[DwgDisplay] 캔버스 리사이즈: ${newWidth}x${newHeight}`);
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    viewer.resize?.(0, newWidth, newHeight, 0);
                    viewer.update?.();
                }
            }, 100);
        };

        resizeObserverRef.current = new ResizeObserver(handleResize);
        resizeObserverRef.current.observe(containerRef.current);

        // 초기 리사이즈 강제 실행
        const initialResize = () => {
            if (containerRef.current && canvasRef.current && viewerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const canvas = canvasRef.current;
                const viewer = viewerRef.current;
                
                const dpr = window.devicePixelRatio || 1;
                const newWidth = Math.floor(rect.width * dpr);
                const newHeight = Math.floor(rect.height * dpr);

                if (newWidth > 0 && newHeight > 0) {
                    console.log(`[DwgDisplay] 초기 캔버스 리사이즈: ${newWidth}x${newHeight}`);
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    viewer.resize?.(0, newWidth, newHeight, 0);
                    viewer.update?.();
                }
            }
        };

        setTimeout(initialResize, 150);

        return () => {
            clearTimeout(resizeTimeout);
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
        };
    }, [isInitializedRef.current]);

    // 🔹 언마운트 시에만 정리
    useEffect(() => {
        return () => {
            cleanupFunctionsRef.current.forEach(cleanup => cleanup?.());
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
            if (viewerRef.current) {
                viewerRef.current.destroy?.();
                viewerRef.current = null;
            }
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

export default DwgDisplay;