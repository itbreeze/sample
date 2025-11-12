// client/src/components/viewer/viewerControls.js

// Box cursor generator (SVG data URL)
const makeBoxCursorDataURL = ({
    size = 15,
    color = '#000000',
    corner = 0,
    hotspot = null,
} = {}) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = Math.min(Math.round(size * dpr), 128);
    const W = 1;
    const R = Math.max(0, Math.round(corner * dpr));
    const x = W / 2;
    const y = W / 2;
    const rectW = Math.max(1, S - W);
    const rectH = Math.max(1, S - W);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <rect x="${x}" y="${y}" width="${rectW}" height="${rectH}" rx="${R}" ry="${R}"
        fill="none" stroke="${color}" stroke-width="${W}" />
    </svg>`;
    const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
    const hx = hotspot ? hotspot[0] : Math.round(S / 2);
    const hy = hotspot ? hotspot[1] : Math.round(S / 2);
    return { url: `url("data:image/svg+xml,${encoded}") ${hx} ${hy}, crosshair` };
};

// Apply box cursor to a canvas and return cleanup
export const applyBoxCursor = (canvas, opts) => {
    if (!canvas) return () => { };
    const prev = canvas.style.cursor;
    const { url } = makeBoxCursorDataURL(opts);
    canvas.style.cursor = url;
    return () => { canvas.style.cursor = prev; };
};

// Wheel zoom
export const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
    if (!viewer || !canvas) return () => { };
    const onWheel = (() => {
        let raf = 0, acc = 0, lastX = 0, lastY = 0;
        return (event) => {
            event.preventDefault();
            acc += event.deltaY;
            lastX = event.offsetX; lastY = event.offsetY;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                const factor = acc > 0 ? (1 / zoomFactor) : zoomFactor;
                viewer.zoomAt?.(factor, lastX, lastY);
                viewer.update?.();
                acc = 0; raf = 0;
            });
        };
    })();
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
};

// Right-click pan only
export const attachPan = (viewer, canvas) => {
    if (!viewer || !canvas) return () => { };

    let isPanning = false;
    let panButton = null;
    let lastMouseX = 0, lastMouseY = 0;
    // middle-button double-click detection (zoom extents)
    let lastMiddleClickTime = 0;
    const doubleClickThreshold = 400; // ms

    // Set cursor on entry
    let restoreBoxCursor = applyBoxCursor(canvas, {});
    const setBoxCursor = () => {
        restoreBoxCursor?.();
        restoreBoxCursor = applyBoxCursor(canvas, {});
    };

    const grabCursor = 'grabbing';

    const onMouseDown = (event) => {
        if (event.button === 1) {
            event.preventDefault();
            const now = Date.now();
            if (now - lastMiddleClickTime < doubleClickThreshold) {
                try { viewer.zoomExtents?.(); viewer.update?.(); } catch { }
                lastMiddleClickTime = 0;
                isPanning = false;
                panButton = null;
                setBoxCursor();
                return;
            }
            lastMiddleClickTime = now;
            isPanning = true;
            panButton = 1;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = grabCursor;
            return;
        }
        if (event.button !== 2) return;
        isPanning = true;
        panButton = 2;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        canvas.style.cursor = grabCursor;
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

    const onMouseUp = (event) => {
        if (isPanning && event.button === panButton) {
            isPanning = false;
            panButton = null;
            setBoxCursor();
        }
    };

    const onMouseLeave = () => {
        if (isPanning) {
            isPanning = false;
            panButton = null;
            setBoxCursor();
        }
    };

    const onContextMenu = (event) => { event.preventDefault(); };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
        if (canvas) {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('contextmenu', onContextMenu);
        }
        window.removeEventListener('mouseup', onMouseUp);
        restoreBoxCursor?.();
    };
};

// Left-click select (point pick via small screen box)
export const attachLeftClickSelect = (viewer, canvas, opts = {}) => {
    if (!viewer || !canvas) return () => { };

    const radius = typeof opts.radius === 'number' ? Math.max(1, opts.radius) : 4;
    const registeredHandles = opts.registeredHandles instanceof Set ? opts.registeredHandles : null;
    const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;

    let isDown = false;
    let downX = 0, downY = 0;
    let moved = false;

    const moveThreshold = 3; // px to treat as drag vs click

    const onMouseDown = (event) => {
        if (event.button !== 0) return; // left only
        isDown = true;
        moved = false;
        downX = event.clientX;
        downY = event.clientY;
    };

    const onMouseMove = (event) => {
        if (!isDown) return;
        const dx = event.clientX - downX;
        const dy = event.clientY - downY;
        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) moved = true;
    };

    const doPointPick = (x, y, additive, screenRadius) => {
        const r = screenRadius;
        const x1 = Math.max(0, x - r);
        const y1 = Math.max(0, y - r);
        const x2 = x + r;
        const y2 = y + r;

        if (!additive) viewer.unselect?.();
        viewer.select?.(x1, y1, x2, y2);
        console.log('Point pick at', { x1, y1, x2, y2 });

        const selectedHandles = [];
        try {
            const pSelected = viewer.getSelected?.();
            // pSelected가 null/빈 컬렉션인지 확인
            if (pSelected && !pSelected.isNull?.() && pSelected.numItems?.() > 0) {
                const itr = pSelected.getIterator?.();
                if (itr) {
                    while (!itr.done?.()) {
                        const entityId = itr.getEntity?.();
                        if (entityId) {
                            // type 1: Entity, type 2: Insert (사용 중인 API 규약에 맞춤)
                            if (entityId.getType?.() === 1) {
                                const obj = entityId.openObject?.();
                                const handle = obj?.getNativeDatabaseHandle?.();
                                if (!registeredHandles || registeredHandles.has(handle)) {
                                    selectedHandles.push(handle);
                                }
                            } else if (entityId.getType?.() === 2) {
                                const obj = entityId.openObjectAsInsert?.();
                                const handle = obj?.getNativeDatabaseHandle?.();
                                if (!registeredHandles || registeredHandles.has(handle)) {
                                    selectedHandles.push(handle);
                                }
                            }
                        }
                        itr.step?.();
                    }
                }
            }
        } catch (e) {
            // 필요 시 로깅
            // console.warn('point-pick error', e);
        } finally {
            viewer.update?.();
        }

        if (onSelect) {
            try {
                console.log('Point pick selected handles:', selectedHandles);
                onSelect({ x, y, additive, handles: selectedHandles });
            } catch {}
        }
    };

    const onMouseUp = (event) => {
        // 1) 좌클릭만 처리
        if (event.button !== 0) { isDown = false; moved = false; return; }
        // 2) 드래그로 판단되면 무시 (드래그-셀렉트는 다른 핸들러에서)
        if (!isDown || moved) { isDown = false; moved = false; return; }
        // 3) 이벤트 타겟이 캔버스가 아닐 수 있음(window mouseup). 이 경우 좌표 안전 가드.
        if (event.currentTarget !== canvas && event.target !== canvas) {
            // 캔버스 밖에서 놓은 경우는 취소로 처리
            isDown = false; moved = false; return;
        }

        isDown = false;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;
        const scaledRadius = Math.max(1, radius * dpr);
        const additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);

        doPointPick(x, y, additive, scaledRadius);
    };

    const onLeaveCancel = () => { isDown = false; moved = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onLeaveCancel);

    // window mouseup은 좌표가 맞지 않을 수 있으니 down 상태만 해제
    const onWindowMouseUp = () => { isDown = false; };
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('mouseleave', onLeaveCancel);
        window.removeEventListener('mouseup', onWindowMouseUp);
    };
};

/**
 * Drag select with overlay
 */
export const attachDragSelect = (viewer, canvas, options = {}) => {
    if (!viewer || !canvas) return () => { };

    const {
        onSelect = () => { },
        registeredHandles,
        overlayCanvas
    } = options;

    let overlay = overlayCanvas;
    let overlayCreated = false;
    if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.width = `${canvas.clientWidth}px`;
        overlay.style.height = `${canvas.clientHeight}px`;
        canvas.parentElement?.appendChild(overlay);
        overlayCreated = true;
    }
    const octx = overlay.getContext('2d');

    const syncOverlaySize = () => {
        const dpr = window.devicePixelRatio || 1;
        if (!overlay) return;
        overlay.style.width = `${canvas.clientWidth}px`;
        overlay.style.height = `${canvas.clientHeight}px`;
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (overlay.width !== w || overlay.height !== h) {
            overlay.width = w;
            overlay.height = h;
        }
    };
    syncOverlaySize();

    const drawBox = (box) => {
        if (!octx || !overlay) return;
        syncOverlaySize();
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, overlay.width, overlay.height);
        const dpr = window.devicePixelRatio || 1;
        octx.save();
        octx.lineWidth = Math.max(1, 1 * dpr);
        octx.strokeStyle = '#2563eb';
        octx.fillStyle = 'rgba(37,99,235,0.12)';
        const x1 = Math.min(box.x1, box.x2);
        const y1 = Math.min(box.y1, box.y2);
        const x2 = Math.max(box.x1, box.x2);
        const y2 = Math.max(box.y1, box.y2);
        octx.beginPath();
        octx.rect(x1, y1, x2 - x1, y2 - y1);
        octx.fill();
        octx.stroke();
        octx.restore();
    };

    const clearOverlay = () => {
        if (!octx || !overlay) return;
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, overlay.width, overlay.height);
    };

    const getScreenPoint = (event) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;
        return { x, y, dpr };
    };

    const normalize = (box) => ({
        x1: Math.min(box.x1, box.x2),
        y1: Math.min(box.y1, box.y2),
        x2: Math.max(box.x1, box.x2),
        y2: Math.max(box.y1, box.y2)
    });

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastBox = null;
    let shiftAdditive = false;

    const onKeyDown = (event) => { if (event.key === 'Shift') shiftAdditive = true; };
    const onKeyUp = (event) => { if (event.key === 'Shift') shiftAdditive = false; };

    const onMouseDown = (event) => {
        if (event.button !== 0) return;
        const { x, y } = getScreenPoint(event);
        isDragging = true;
        dragStart = { x, y };
        lastBox = { x1: x, y1: y, x2: x, y2: y };
        drawBox(lastBox);
    };

    const onMouseMove = (event) => {
        if (!isDragging) return;
        const { x, y } = getScreenPoint(event);
        lastBox = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
        drawBox(lastBox);
    };

    const onMouseUp = (event) => {
        if (!isDragging) return;
        isDragging = false;
        const { x, y, dpr } = getScreenPoint(event);
        lastBox = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
        clearOverlay();
        const normalized = normalize(lastBox);
        try {
            if (!shiftAdditive) viewer.unselect?.();
            viewer.select?.(normalized.x1, normalized.y1, normalized.x2, normalized.y2);
            viewer.update?.();
            const pSelected = viewer.getSelected?.();
            const handles = [];
            if (pSelected && !pSelected.isNull?.() && pSelected.numItems?.() > 0) {
                const itr = pSelected.getIterator?.();
                while (itr && !itr.done?.()) {
                    const entityId = itr.getEntity?.();
                    if (!entityId) { itr.step?.(); continue; }
                    const target =
                        entityId.getType?.() === 2 ? entityId.openObjectAsInsert?.() : entityId.openObject?.();
                    const handle = target?.getNativeDatabaseHandle?.();
                    if (handle && (!registeredHandles || registeredHandles.has(handle))) {
                        handles.push(handle);
                    }
                    itr.step?.();
                }
            }
            onSelect(Array.from(new Set(handles)), {
                x1: normalized.x1 / dpr,
                y1: normalized.y1 / dpr,
                x2: normalized.x2 / dpr,
                y2: normalized.y2 / dpr
            }, shiftAdditive);
        } catch (error) {
            console.error('attachDragSelect error:', error);
        } finally {
            lastBox = null;
        }
    };

    const onResize = () => {
        syncOverlaySize();
        if (lastBox) drawBox(lastBox);
    };

    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('keyup', onKeyUp, { passive: true });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('resize', onResize);
        if (overlayCreated && overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
    };
};
