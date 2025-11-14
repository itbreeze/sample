/* eslint-env browser */
// client/src/components/viewer/CanvasController.js

/////////////////////////
// [BOX CURSOR]
/////////////////////////

const makeBoxCursorDataURL = ({ size = 15, color = '#000000', corner = 0, hotspot = null } = {}) => {
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

const applyBoxCursor = (canvas, opts) => {
  if (!canvas) return () => {};
  const prev = canvas.style.cursor;
  const { url } = makeBoxCursorDataURL(opts);
  canvas.style.cursor = url;
  return () => { canvas.style.cursor = prev; };
};

/////////////////////////
// [WHEEL ZOOM]
/////////////////////////

export const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
  if (!viewer || !canvas) return () => {};
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

/////////////////////////
// [PAN]
/////////////////////////

export const attachPan = (viewer, canvas) => {
  if (!viewer || !canvas) return () => {};

  let isPanning = false;
  let panButton = null;
  let lastMouseX = 0, lastMouseY = 0;
  let lastMiddleClickTime = 0;
  const doubleClickThreshold = 400;

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
        try { viewer.zoomExtents?.(); viewer.update?.(); } catch {}
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

  const endPan = (event) => {
    if (isPanning && (!event || event.button === panButton)) {
      isPanning = false;
      panButton = null;
      setBoxCursor();
    }
  };

  const onContextMenu = (event) => { event.preventDefault(); };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', endPan);
  canvas.addEventListener('mouseleave', endPan);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('mouseup', endPan);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', endPan);
    canvas.removeEventListener('mouseleave', endPan);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('mouseup', endPan);
    restoreBoxCursor?.();
  };
};

/////////////////////////
// [UNIFIED SELECT]
/////////////////////////

/**
 * 통합 선택 핸들러
 * - 클릭: 작은 박스 select
 * - 드래그: 박스 select
 * - onSelect: ({ additive, mode, dpr, box, hit, handles })
 */
export const attachUnifiedSelect = (viewer, canvas, lib, options = {}) => {
  // lib 유무와 상관없이 동작하도록 변경 (lib는 무시)
  if (!viewer || !canvas) return () => {};

  const { onSelect = () => {}, radius = 4 } = options;

  // 오버레이 캔버스
  let overlay = document.createElement('canvas');
  overlay.style.position = 'absolute';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.width = `${canvas.clientWidth}px`;
  overlay.style.height = `${canvas.clientHeight}px`;
  canvas.parentElement?.appendChild(overlay);
  const octx = overlay.getContext('2d');

  const syncOverlaySize = () => {
    if (!overlay) return;
    const dpr = window.devicePixelRatio || 1;
    overlay.style.width = canvas.clientWidth + 'px';
    overlay.style.height = canvas.clientHeight + 'px';
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
  };
  syncOverlaySize();

  const clearOverlay = () => {
    if (!overlay || !octx) return;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
  };

  const drawBox = (box) => {
    if (!overlay || !octx) return;
    syncOverlaySize();
    const dpr = window.devicePixelRatio || 1;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
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
    y2: Math.max(box.y1, box.y2),
  });

  // 현재 viewer 선택에서 handle 배열만 뽑기 (click/drag 공통)
  const collectHandlesFromSelection = () => {
    const result = [];
    try {
      const pSelected = viewer.getSelected?.();
      if (!pSelected || pSelected.isNull?.()) return result;

      const it = pSelected.getIterator?.();
      if (!it || typeof it.done !== 'function') return result;

      const seen = new Set();

      while (!it.done()) {
        const entityId = it.getEntity?.();
        if (entityId && !entityId.isNull?.()) {
          try {
            const t = entityId.getType?.();
            let obj = null;
            if (t === 1) obj = entityId.openObject?.();
            else if (t === 2) obj = entityId.openObjectAsInsert?.();
            else obj = entityId.openObject?.();

            const handle = obj?.getNativeDatabaseHandle?.();
            if (handle != null) {
              const hk = String(handle);
              if (!seen.has(hk)) {
                seen.add(hk);
                result.push(hk);
              }
            }
          } catch {
            // ignore per-entity errors
          }
        }
        try { it.step?.(); } catch { break; }
      }
    } catch {
      // ignore top-level selection errors
    }
    return result;
  };

  let isDown = false;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let lastBox = null;
  const DRAG_THRESHOLD = 5;

  // 드래그 판단용은 clientX/Y 로, 실제 select 좌표는 DPR 반영값 사용
  let downClientX = 0;
  let downClientY = 0;

  const onMouseDown = (event) => {
    if (event.button !== 0) return;
    const { x, y } = getScreenPoint(event);
    isDown = true;
    isDragging = false;
    downClientX = event.clientX;
    downClientY = event.clientY;
    dragStart = { x, y };
    lastBox = null;
  };

  const onMouseMove = (event) => {
    if (!isDown) return;

    const dxClient = event.clientX - downClientX;
    const dyClient = event.clientY - downClientY;

    if (!isDragging && (Math.abs(dxClient) > DRAG_THRESHOLD || Math.abs(dyClient) > DRAG_THRESHOLD)) {
      isDragging = true;
    }

    if (isDragging) {
      const { x, y } = getScreenPoint(event);
      lastBox = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
      drawBox(lastBox);
    }
  };

  const onMouseUp = (event) => {
    if (!isDown) return;
    if (event.button !== 0) {
      isDown = false;
      isDragging = false;
      clearOverlay();
      return;
    }

    const additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);
    const { x, y, dpr } = getScreenPoint(event);

    try {
      if (isDragging && lastBox) {
        // --- 드래그 선택 ---
        clearOverlay();
        const normalized = normalize(lastBox);

        if (!additive) viewer.unselect?.();
        viewer.select?.(normalized.x1, normalized.y1, normalized.x2, normalized.y2);
        viewer.update?.();

        const handles = collectHandlesFromSelection();

        onSelect({
          additive,
          mode: 'drag',
          dpr,
          box: normalized,
          hit: null,
          handles,
        });
      } else {
        // --- 단일 클릭: 작은 박스 select ---
        const scaledRadius = Math.max(1, radius * dpr);
        const x1 = Math.max(0, x - scaledRadius);
        const y1 = Math.max(0, y - scaledRadius);
        const x2 = x + scaledRadius;
        const y2 = y + scaledRadius;

        if (!additive) viewer.unselect?.();
        viewer.select?.(x1, y1, x2, y2);
        viewer.update?.();

        const handles = collectHandlesFromSelection();

        onSelect({
          additive,
          mode: 'click',
          dpr,
          box: { x1, y1, x2, y2 },
          hit: null,
          handles,
        });
      }
    } catch (error) {
      console.error('선택 처리 오류:', error);
    } finally {
      isDown = false;
      isDragging = false;
      lastBox = null;
      clearOverlay();
    }
  };

  const onMouseLeave = () => {
    if (isDown) {
      isDown = false;
      isDragging = false;
      lastBox = null;
      clearOverlay();
    }
  };

  const onResize = () => {
    syncOverlaySize();
    if (lastBox) drawBox(lastBox);
  };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  window.addEventListener('resize', onResize);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    window.removeEventListener('resize', onResize);
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };
};

/**
 * wheel + pan + unifiedSelect 한 번에 붙이고 cleanup 반환
 */
export const attachCanvasInteractions = (viewer, canvas, lib, { onSelect } = {}) => {
  if (!viewer || !canvas) return () => {};

  const cleanups = [];
  cleanups.push(attachWheelZoom(viewer, canvas));
  cleanups.push(attachPan(viewer, canvas));
  cleanups.push(attachUnifiedSelect(viewer, canvas, lib, { onSelect }));

  return () => {
    cleanups.forEach((fn) => fn && fn());
  };
};
