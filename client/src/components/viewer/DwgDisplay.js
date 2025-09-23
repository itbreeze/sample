import React, { useEffect, useRef, useState } from 'react';
import './DwgDisplay.css';

const fileCache = new Map();

const initializeVisualizeJS = async () => {
    if (!window.getVisualizeLibInst) {
        throw new Error('VisualizeJS가 로드되지 않았습니다. public 폴더에 Visualize.js 파일이 있는지 확인하세요.');
    }
    const wasmUrl = window.WasmUrl || '/Visualize.js.wasm';
    return await window.getVisualizeLibInst({
        TOTAL_MEMORY: 200 * 1024 * 1024,
        urlMemFile: wasmUrl,
        onprogress: (info) => {
            if (info.total > 0) {
                const percent = Math.floor((info.loaded / info.total) * 100);
                console.log(`VisualizeJS 로딩: ${percent}%`);
            }
        },
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

const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
    if (!viewer || !canvas) return () => {};
    const onWheel = (event) => {
        event.preventDefault();
        const delta = event.deltaY;
        const rect = canvas.getBoundingClientRect();
        const x1 = event.clientX - rect.left;
        const y1 = event.clientY - rect.top;

        if (viewer.zoomAt) {
            viewer.zoomAt(delta > 0 ? 1 / zoomFactor : zoomFactor, x1, y1);
            viewer.update();
        }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
};

const attachPan = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};
    let isPanning = false;
    let lastMouseX = 0, lastMouseY = 0;
    const defaultCursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect width=\"16\" height=\"16\" fill=\"none\" stroke=\"black\" stroke-width=\"2\"/></svg>') 8 8, auto";
    canvas.style.cursor = defaultCursor;
    const onMouseDown = (event) => {
        if (event.button === 1) { // Middle mouse button
            event.preventDefault();
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grab';
        }
    };
    const onMouseMove = (event) => {
        if (!isPanning) return;
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        viewer.pan?.(deltaX, deltaY);
        viewer.update?.();
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    };
    const onMouseUpOrLeave = () => {
        isPanning = false;
        canvas.style.cursor = defaultCursor;
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUpOrLeave);
    canvas.addEventListener('mouseleave', onMouseUpOrLeave);
    window.addEventListener('mouseup', onMouseUpOrLeave);
    return () => {
        if (canvas) {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUpOrLeave);
            canvas.removeEventListener('mouseleave', onMouseUpOrLeave);
        }
        window.removeEventListener('mouseup', onMouseUpOrLeave);
    };
};

function makeDxfList(entityId) {
    if (!entityId) return null;
    let obj = null;
    let objName = "Unknown";
    const type = entityId.getType();
    switch (type) {
        case 1: objName = 'ENTITY'; obj = entityId.openObject(); break;
        case 2: objName = 'INSERT'; obj = entityId.openObjectAsInsert(); break;
        default: break;
    }
    if (!obj) return { object: objName, handle: null };
    return {
        object: objName,
        layer: obj.getLayer().openObject().getName(),
        handle: obj.getNativeDatabaseHandle()
    };
}

const attachClickInfo = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};
    const onClick = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x1 = event.clientX - rect.left;
        const y1 = event.clientY - rect.top;
        try {
            viewer.unselect?.();
            viewer.select?.(x1, y1, x1 + 0.2, y1 + 0.2);
            viewer.update?.();
            const pSelected = viewer.getSelected?.();
            if (pSelected && !pSelected.isNull() && pSelected.numItems() !== 0) {
                const itr = pSelected.getIterator();
                while (itr && !itr.done()) {
                    const entityId = itr.getEntity();
                    if (entityId && !entityId.isNull?.()) {
                        console.log(makeDxfList(entityId));
                    }
                    itr.step();
                }
            } else {
                console.log("선택된 객체 없음");
            }
        } catch (err) {
            console.error("attachClickInfo 오류:", err);
        }
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
};

function resizeCanvas(viewer, canvas, container) {
    if (!viewer || !canvas || !container) return;
    try {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            viewer.resize?.(0, canvas.width, canvas.height, 0);
        }
        viewer.update?.();
    } catch (error) {
        console.error("Canvas 리사이즈 중 오류 발생:", error);
    }
}

const DwgDisplay = ({ filePath, initialViewState, onViewStateChange, onReady }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isDrawingLoading, setIsDrawingLoading] = useState(true);

    useEffect(() => {
        if (!filePath) return;

        let isMounted = true;
        let handleResize = null;
        let cleanupFunctions = [];

        const init = async () => {
            try {
                setIsDrawingLoading(true);
                if (!isMounted || !canvasRef.current || !containerRef.current) return;
                
                const libInstance = await initializeVisualizeJS();
                if (!isMounted || !canvasRef.current) return;

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
                    const blob = await response.blob();
                    arrayBuffer = await blob.arrayBuffer();
                    fileCache.set(filePath, arrayBuffer);
                }

                if (!isMounted) return;

                if (viewerRef.current.clear) viewerRef.current.clear();
                await viewerRef.current.parseVsfx(arrayBuffer);
                
                viewerRef.current.setEnableSceneGraph(true);
                viewerRef.current.setExperimentalFunctionalityFlag('gpu_select', false);
                viewerRef.current.setEnableAnimation(false);
                
                resizeCanvas(viewerRef.current, canvasRef.current, containerRef.current);

                if (initialViewState && viewerRef.current.setView) {
                    viewerRef.current.setView(initialViewState);
                } else {
                    viewerRef.current.zoomExtents();
                }

                if (onReady) onReady(filePath);

                cleanupFunctions.push(attachWheelZoom(viewerRef.current, canvasRef.current));
                cleanupFunctions.push(attachPan(viewerRef.current, canvasRef.current));
                cleanupFunctions.push(attachClickInfo(viewerRef.current, canvasRef.current));

                handleResize = () => resizeCanvas(viewerRef.current, canvasRef.current, containerRef.current);
                window.addEventListener('resize', handleResize);

            } catch (err) {
                if (isMounted) {
                    console.error(err);
                    setErrorMessage(err.message);
                }
            } finally {
                if(isMounted) {
                    setIsDrawingLoading(false);
                }
            }
        };

        const scriptId = 'visualize-script';
        let script = document.getElementById(scriptId);

        const handleScriptLoad = () => init().catch(console.error);

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
            if (handleResize) {
                window.removeEventListener('resize', handleResize);
            }
            cleanupFunctions.forEach(cleanup => cleanup());
            if (viewerRef.current) {
                if (onViewStateChange && typeof viewerRef.current.getView === 'function') {
                    const currentView = viewerRef.current.getView();
                    onViewStateChange(currentView);
                }

                viewerRef.current.destroy?.();
                viewerRef.current = null;
            }
            if (script) {
                script.removeEventListener('load', handleScriptLoad);
            }
        };
    }, [filePath, onReady, initialViewState, onViewStateChange]);

    return (
        <div ref={containerRef} className="viewer-app-container">
            {isDrawingLoading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                </div>
            )}
            <div className="viewer-canvas-container">
                <canvas ref={canvasRef} id="viewerCanvas" />
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default DwgDisplay;