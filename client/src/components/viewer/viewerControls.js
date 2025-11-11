// client/src/components/viewer/viewerControls.js

/**
 * 커스텀 박스 커서 DataURL 생성
 * - 크기/굵기/모서리 라운드 커스터마이징 가능
 */
const makeBoxCursorDataURL = ({
    size = 15, // 커서 총 크기(정사각형 한 변)
    stroke = 1, // 최대한 얇게
    color = '#000000', // 검은색
    corner = 0, // 모서리 라운드
    hotspot = null, // [x,y] 커서 기준점(기본: 중앙)
} = {}) => {
    // HIDPI 보정 & 최대 128px 제한
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = Math.min(Math.round(size * dpr), 128);
    // 최대한 얇게: 실제 굵기는 기본 1px 고정
    const W = 1;
    const R = Math.max(0, Math.round(corner * dpr));

    // 정사각형 외곽선 (전체 크기에 맞춤)
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

/**
 * 커스텀 박스 커서를 canvas에 적용하고 되돌리는 cleanup 반환
 */
export const applyBoxCursor = (canvas, opts) => {
    if (!canvas) return () => { };
    const prev = canvas.style.cursor;
    const { url } = makeBoxCursorDataURL(opts);
    canvas.style.cursor = url;
    return () => { canvas.style.cursor = prev; };
};

// 누적 선택 상태(캔버스별 박스 배열)
const selectionState = new WeakMap(); // canvas -> { boxes: Array<{x1,y1,x2,y2,type:'drag'|'click'}> }

// 박스 정규화
const normBox = (b) => {
    const x1 = Math.min(b.x1, b.x2), y1 = Math.min(b.y1, b.y2);
    const x2 = Math.max(b.x1, b.x2), y2 = Math.max(b.y1, b.y2);
    return { x1, y1, x2, y2 };
};

// 거의 같은 박스(픽셀 오차 eps 내) 판정
const sameBox = (a, b, eps = 2) => {
    const A = normBox(a), B = normBox(b);
    return Math.abs(A.x1 - B.x1) <= eps &&
        Math.abs(A.y1 - B.y1) <= eps &&
        Math.abs(A.x2 - B.x2) <= eps &&
        Math.abs(A.y2 - B.y2) <= eps;
};

// 박스 배열로 선택 재적용
const applySelectionFromBoxes = (viewer, boxes) => {
    viewer.unselect?.();
    for (const box of boxes) {
        viewer.select?.(box.x1, box.y1, box.x2, box.y2);
    }
    viewer.update?.();
};

/**
 * 마우스 휠 줌
 */
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

/**
 * 패닝 (우클릭/휠클릭)
 * - 기본 상태: 커스텀 박스 커서
 * - 패닝 중: grabbing
 * - 종료/리셋: 커스텀 박스 커서 복원
 */
export const attachPan = (viewer, canvas) => {
    if (!viewer || !canvas) return () => { };

    let isPanning = false;
    let panButton = null;
    let lastMouseX = 0, lastMouseY = 0;

    // 기본 진입 시 커스텀 커서 적용
    let restoreBoxCursor = applyBoxCursor(canvas, {});
    const setBoxCursor = () => {
        // (반복적인 브라우저 커서 캐시 이슈 회피)
        restoreBoxCursor?.();
        restoreBoxCursor = applyBoxCursor(canvas, {});
    };

    const grabCursor = 'grabbing';

    // 더블클릭(휠) 시 Zoom Extents
    let lastMiddleClickTime = 0;
    let clickCount = 0;
    const doubleClickThreshold = 400;

    const onMouseDown = (event) => {
        // 우클릭 패닝
        if (event.button === 2) {
            isPanning = true;
            panButton = 2;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = grabCursor;
        }

        // 휠클릭
        if (event.button === 1) {
            event.preventDefault();
            const now = Date.now();

            if (now - lastMiddleClickTime < doubleClickThreshold) {
                clickCount++;
                if (clickCount === 2) {
                    try {
                        viewer.zoomExtents?.();
                        viewer.update?.();
                    } catch (error) {
                        console.error('[Pan Control] Zoom Extents 오류:', error);
                    }
                    lastMiddleClickTime = 0;
                    clickCount = 0;
                    isPanning = false;
                    panButton = null;
                    setBoxCursor(); // 더블클릭 후 복원
                    return;
                }
            } else {
                clickCount = 1;
            }

            lastMiddleClickTime = now;
            isPanning = true;
            panButton = 1;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = grabCursor; // 패닝 중
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

    const onContextMenu = (event) => {
        event.preventDefault();
    };

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
        // 커서 복구
        restoreBoxCursor?.();
    };
};

/**
 * 클릭 정보
 */
function makeDxfList(entityId) {
    if (!entityId) return null;

    let obj = null;
    let objName = 'Unknown';
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
        handle: obj.getNativeDatabaseHandle(),
    };
}

/**
 * 좌클릭 클릭 시 객체 정보 출력
 */
export const attachClickInfo = (viewer, canvas) => {
    if (!viewer || !canvas) return () => { };

    let mouseDownX = 0;
    let mouseDownY = 0;
    let mouseDownTime = 0;
    let hasMoved = false;
    const moveThreshold = 5;
    const clickTimeThreshold = 300;

    const onMouseDown = (event) => {
        if (event.button === 0) {
            mouseDownX = event.clientX;
            mouseDownY = event.clientY;
            mouseDownTime = Date.now();
            hasMoved = false;
        }
    };

    const onMouseMove = (event) => {
        const deltaX = Math.abs(event.clientX - mouseDownX);
        const deltaY = Math.abs(event.clientY - mouseDownY);
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            hasMoved = true;
        }
    };

    const onClick = (event) => {
        const clickDuration = Date.now() - mouseDownTime;
        if (hasMoved || clickDuration > clickTimeThreshold) {
            hasMoved = false;
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x1 = (event.clientX - rect.left) * dpr;
        const y1 = (event.clientY - rect.top) * dpr;

        try {
            const additive = !!(event.ctrlKey || event.metaKey || event.shiftKey);
            // 클릭 위치를 기준으로 작은 박스 생성(px)
            const mini = 3;
            const clickBox = { x1: x1 - mini, y1: y1 - mini, x2: x1 + mini, y2: y1 + mini };
            const state = selectionState.get(canvas) || { boxes: [] };
            let boxes = state.boxes.slice();
            if (additive) {
                const idx = boxes.findIndex(b => sameBox(b, clickBox));
                if (idx >= 0) boxes.splice(idx, 1); else boxes.push({ ...clickBox, type: 'click' });
            } else {
                boxes = [{ ...clickBox, type: 'click' }];
            }
            selectionState.set(canvas, { boxes });
            applySelectionFromBoxes(viewer, boxes);
        } catch (err) {
            console.error('attachClickInfo 오류:', err);
        }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click', onClick);
    };
};

// (중복 정의 제거) 드래그 선택 구현은 아래 overlay 버전 attachDragSelect를 사용합니다.

/**
 * 드래그(마키) 영역 선택
 * - 좌클릭 드래그로 화면상의 사각형을 만들고 그 범위 내 엔티티들을 선택/수집
 * - Shift 누르면 누적 선택 시나리오 지원 (콜백에서 병합 처리)
 *
 * @param {object} viewer        Visualize.js 뷰어 인스턴스
 * @param {HTMLCanvasElement} canvas  뷰어 캔버스
 * @param {object} options
 *   - onSelect: (handles: string[], screenBox: {x1,y1,x2,y2}, additive:boolean) => void
 *   - registeredHandles?: Set<string>  // 존재 시 해당 집합에 포함된 핸들만 선정
 *   - overlayCanvas?: HTMLCanvasElement // 외부에서 준비한 오버레이 캔버스를 인수로 전달
 * @returns cleanup()
 */
export const attachDragSelect = (viewer, canvas, options = {}) => {
    if (!viewer || !canvas) return () => { };

    const {
        onSelect = () => { },
        registeredHandles,
        overlayCanvas
    } = options;

    // 드래그 진입 구간에서는 기본 커서 사용 (makeBoxCursorDataURL의 기본값)
    const restoreBoxCursor = applyBoxCursor(canvas, {});

    // 오버레이 캔버스 준비
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
        // 캔버스가 DOM 내 position:relative 컨테이너 안에 있는 것을 권장
        canvas.parentElement?.appendChild(overlay);
        overlayCreated = true;
    }
    const octx = overlay.getContext('2d');

    // 해상도에 맞추기
    const syncOverlaySize = () => {
        const dpr = window.devicePixelRatio || 1;
        if (overlay) {
            // CSS 사이즈를 최신화
            overlay.style.width = `${canvas.clientWidth}px`;
            overlay.style.height = `${canvas.clientHeight}px`;
            // 실제 캔버스 해상도 사이즈
            const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            if (overlay.width !== w || overlay.height !== h) {
                overlay.width = w;
                overlay.height = h;
            }
        }
    };
    syncOverlaySize();

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastBox = null;
    let shiftAdditive = false;

    const normalize = (b) => {
        const x1 = Math.min(b.x1, b.x2);
        const y1 = Math.min(b.y1, b.y2);
        const x2 = Math.max(b.x1, b.x2);
        const y2 = Math.max(b.y1, b.y2);
        return { x1, y1, x2, y2 };
    };

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
        const { x1, y1, x2, y2 } = normalize(box);
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

    const getRel = (evt) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (evt.clientX - rect.left) * dpr;
        const y = (evt.clientY - rect.top) * dpr;
        return { x, y, dpr };
    };

    const onKeyDown = (e) => {
        if (e.key === 'Shift') {
            shiftAdditive = true;
        }
    };
    const onKeyUp = (e) => {
        if (e.key === 'Shift') {
            shiftAdditive = false;
        }
    };

    const onMouseDown = (evt) => {
        if (evt.button !== 0) return; // 좌클릭만
        isDragging = true;
        const { x, y } = getRel(evt);
        dragStart = { x, y };
        lastBox = { x1: x, y1: y, x2: x, y2: y };
        drawBox(lastBox);
    };

    const onMouseMove = (evt) => {
        if (!isDragging) return;
        const { x, y } = getRel(evt);
        lastBox = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
        drawBox(lastBox);
    };

    const onMouseUp = (evt) => {
        if (!isDragging) return;
        isDragging = false;
        const { x, y, dpr } = getRel(evt);
        lastBox = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
        clearOverlay();

        const box = normalize(lastBox);
        // viewer.select는 좌하,우상 좌표를 사용 (프로젝트 관례)
        try {
            if (!shiftAdditive) viewer.unselect?.();
            viewer.select?.(box.x1, box.y1, box.x2, box.y2);
            viewer.update?.();
            const pSelected = viewer.getSelected?.();
            const handles = [];
            if (pSelected && !pSelected.isNull() && pSelected.numItems() !== 0) {
                const itr = pSelected.getIterator();
                while (!itr.done()) {
                    const entityId = itr.getEntity();
                    let h = null;
                    if (entityId.getType?.() === 1) {
                        h = entityId.openObject().getNativeDatabaseHandle();
                    } else if (entityId.getType?.() === 2) {
                        h = entityId.openObjectAsInsert().getNativeDatabaseHandle();
                    }
                    if (h) {
                        if (!registeredHandles || registeredHandles.has(h)) {
                            handles.push(h);
                        }
                    }
                    itr.step();
                }
            }

            const unique = Array.from(new Set(handles));
            // screen 좌표는 dpr 보정 제거 -> 콜백에 물리좌표(px) 전달
            onSelect(unique, { x1: box.x1 / dpr, y1: box.y1 / dpr, x2: box.x2 / dpr, y2: box.y2 / dpr }, shiftAdditive);
        } catch (e) {
            console.error('attachDragSelect 선택 오류:', e);
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
        // 커서 복구
        restoreBoxCursor?.();
    };
};