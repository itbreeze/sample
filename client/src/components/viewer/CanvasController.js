/* eslint-env browser */
// client/src/components/viewer/CanvasController.js

/////////////////////////
// [BOX CURSOR]
/////////////////////////

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
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  const hx = hotspot ? hotspot[0] : Math.round(S / 2);
  const hy = hotspot ? hotspot[1] : Math.round(S / 2);
  return {
    url: `url("data:image/svg+xml,${encoded}") ${hx} ${hy}, crosshair`,
  };
};

const applyBoxCursor = (canvas, opts) => {
  if (!canvas) return () => { };
  const prev = canvas.style.cursor;
  const { url } = makeBoxCursorDataURL(opts);
  canvas.style.cursor = url;
  return () => {
    canvas.style.cursor = prev;
  };
};

/////////////////////////
// [WHEEL ZOOM]
/////////////////////////

export const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
  if (!viewer || !canvas) return () => { };
  const onWheel = (() => {
    let raf = 0;
    let acc = 0;
    let lastX = 0;
    let lastY = 0;
    return (event) => {
      event.preventDefault();
      acc += event.deltaY;
      lastX = event.offsetX;
      lastY = event.offsetY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const factor = acc > 0 ? 1 / zoomFactor : zoomFactor;
        viewer.zoomAt?.(factor, lastX, lastY);
        viewer.update?.();
        acc = 0;
        raf = 0;
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
  if (!viewer || !canvas) return () => { };

  let isPanning = false;
  let panButton = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastMiddleClickTime = 0;
  const doubleClickThreshold = 400;

  let restoreBoxCursor = applyBoxCursor(canvas, {});
  const setBoxCursor = () => {
    restoreBoxCursor?.();
    restoreBoxCursor = applyBoxCursor(canvas, {});
  };

  const grabCursor = 'grabbing';

  const onMouseDown = (event) => {
    // 휠 클릭(pan + zoomExtents 더블클릭)
    if (event.button === 1) {
      event.preventDefault();
      const now = Date.now();
      if (now - lastMiddleClickTime < doubleClickThreshold) {
        try {
          viewer.zoomExtents?.();
          viewer.update?.();
        } catch { }
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

    // 우클릭 드래그 pan
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

  const onContextMenu = (event) => {
    event.preventDefault();
  };

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
// [HANDLE COLLECTOR]
/////////////////////////

/**
 * 현재 viewer 선택에서 handle 배열만 추출
 * - testCavas.js 패턴
 */
const makeHandleCollector = (viewer) => () => {
  const handles = [];
  try {
    const pSelected = viewer.getSelected?.();

    if (!pSelected || pSelected.isNull?.() || pSelected.numItems?.() <= 0) {
      return handles;
    }

    const it = pSelected.getIterator?.();
    if (!it) return handles;

    const seen = new Set();

    while (!it.done?.()) {
      const entityId = it.getEntity?.();

      if (entityId && !entityId.isNull?.()) {
        try {
          const t = entityId.getType?.();
          let target = null;
          if (t === 2) {
            target = entityId.openObjectAsInsert?.();
          } else {
            target = entityId.openObject?.();
          }

          const handle = target?.getNativeDatabaseHandle?.();

          if (handle != null) {
            const key = String(handle);
            if (!seen.has(key)) {
              seen.add(key);
              handles.push(key);
            }
          }
        } catch (e) {
          // ignore per-entity error
        }
      }

      try {
        it.step?.();
      } catch (e) {
        break;
      }
    }
  } catch (e) {
    // ignore collector error
  }
  return handles;
};

/////////////////////////
// [LEFT CLICK SELECT]
/////////////////////////

/////////////////////////
// [LEFT CLICK SELECT]
// - testCanvas.js 단일선택 로직을 그대로 이식
/////////////////////////

export const attachLeftClickSelect = (viewer, canvas, lib, options = {}) => {
  if (!viewer || !canvas) return () => { };

  const { onSelect = () => { }, radius = 15 } = options; // testCanvas 기본값과 동일
  const collectHandlesFromSelection = makeHandleCollector(viewer);

  let isDown = false;
  let moved = false;
  let downX = 0;
  let downY = 0;
  const moveThreshold = 1; // 1px 이내는 클릭으로 처리 (testCanvas와 동일)

  const onMouseDown = (event) => {
    if (event.button !== 0) return; // 좌클릭만 처리
    isDown = true;
    moved = false;
    downX = event.clientX;
    downY = event.clientY;
  };

  const onMouseMove = (event) => {
    if (!isDown) return;
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    // 한 축이라도 임계값 넘으면 드래그로 간주
    if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
      moved = true;
    }
  };

  // [LEFT CLICK SELECT] 내부에서 이 함수만 교체
  const doClickSelect = (event) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 클릭한 지점 (viewer 좌표계 기준)
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;

    const additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);

    // TypeScript 코드와 동일한 허용범위 배열
    const tolerances = [1, 3, 6, 10];

    // 최종 선택 박스/핸들
    let finalBox = null;
    let handles = [];

    try {
      if (!additive) {
        // 기존 선택 초기화
        viewer.unselect?.();
      }

      for (const tolerance of tolerances) {
        const t = tolerance * dpr;

        // 질문에 준 코드와 동일한 좌표 순서
        const x1 = x - t;
        const y1 = y + t;
        const x2 = x + t;
        const y2 = y - t;

        finalBox = { x1, y1, x2, y2 };

        viewer.select?.(x1, y1, x2, y2);
        viewer.update?.();

        handles = collectHandlesFromSelection();

        // 뭔가라도 잡혔으면 거기서 멈춤
        if (handles.length > 0) {
          break;
        }
      }

      // 아무 tolerance에서도 안 잡혔으면 finalBox는 마지막 tolerance 기준
      console.log('[CanvasController] select mode: click (tolerance scan)', {
        additive,
        handlesCount: handles.length,
        handles,
        box: finalBox,
      });

      const box = finalBox || { x1: x, y1: y, x2: x, y2: y };
      const screenBox = {
        x1: box.x1 / dpr,
        y1: box.y1 / dpr,
        x2: box.x2 / dpr,
        y2: box.y2 / dpr,
      };

      onSelect({
        additive,
        mode: 'click',
        dpr,
        box,
        screenBox,
        hit: null,
        handles,
      });
    } catch (e) {
      console.warn('[CanvasController] click select error:', e);
    } finally {
      viewer.unselect?.();
      viewer.update?.();
    }
  };


  const onMouseUp = (event) => {
    // 좌클릭만 처리
    if (event.button !== 0) {
      isDown = false;
      moved = false;
      return;
    }

    // 이미 드래그로 판단된 경우 → 여기서는 처리 안 함 (dragSelect에 맡김)
    if (!isDown || moved) {
      isDown = false;
      moved = false;
      return;
    }

    isDown = false;

    // 순수 클릭 → 작은 박스로 선택
    doClickSelect(event);
  };

  const cancel = () => {
    isDown = false;
    moved = false;
  };

  const onWindowMouseUp = () => {
    isDown = false;
    moved = false;
  };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', cancel);
  window.addEventListener('mouseup', onWindowMouseUp);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mouseleave', cancel);
    window.removeEventListener('mouseup', onWindowMouseUp);
  };
};


/////////////////////////
// [DRAG BOX SELECT]
/////////////////////////

/**
 * 드래그 박스 선택
 * - Shift / Ctrl / Meta 키가 눌려 있으면 additive 모드
 * - "살짝 드래그"는 클릭으로만 처리하고, 여기서는 무시
 * - onSelect({ additive, mode: 'drag', dpr, box, screenBox, hit, handles })
 */
export const attachDragSelect = (viewer, canvas, lib, options = {}) => {
  if (!viewer || !canvas) return () => { };

  const { onSelect = () => { } } = options;
  const collectHandlesFromSelection = makeHandleCollector(viewer);

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
    const rect = canvas.getBoundingClientRect();
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    const w = Math.max(1, Math.floor(canvas.width));
    const h = Math.max(1, Math.floor(canvas.height));
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
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.save();
    octx.lineWidth = 1;
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

  const normalize = (box) => ({
    x1: Math.min(box.x1, box.x2),
    y1: Math.min(box.y1, box.y2),
    x2: Math.max(box.x1, box.x2),
    y2: Math.max(box.y1, box.y2),
  });

  const getScreenPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width || 1;
    const sy = canvas.height / rect.height || 1;
    const x = (event.clientX - rect.left) * sx;
    const y = (event.clientY - rect.top) * sy;
    return { x, y, rect };
  };

  const toScreenBox = (box, rect) => {
    const sx = canvas.width / rect.width || 1;
    const sy = canvas.height / rect.height || 1;
    return {
      x1: box.x1 / sx,
      y1: box.y1 / sy,
      x2: box.x2 / sx,
      y2: box.y2 / sy,
    };
  };

  const DRAG_THRESHOLD = 3; // 클릭쪽 moveThreshold 와 동일

  let isMouseDown = false;
  let isDragging = false;
  let dragStartCanvas = { x: 0, y: 0 };
  let dragStartClient = { x: 0, y: 0 };
  let lastBox = null;

  const onMouseDown = (event) => {
    if (event.button !== 0) return;

    isMouseDown = true;
    isDragging = false; // 아직은 "클릭 후보"
    dragStartClient = { x: event.clientX, y: event.clientY };

    const { x, y } = getScreenPoint(event);
    dragStartCanvas = { x, y };
    lastBox = null;
  };

  const onMouseMove = (event) => {
    if (!isMouseDown) return;

    const dx = event.clientX - dragStartClient.x;
    const dy = event.clientY - dragStartClient.y;

    // 아직 드래그로 전환되지 않은 상태라면, 임계값 검사
    if (!isDragging) {
      if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) {
        // 아직은 "살짝 흔들린 클릭" 범위 → 드래그 시작하지 않음
        return;
      }
      // 임계값을 넘는 순간부터 진짜 드래그 시작
      isDragging = true;
    }

    // 드래그 시작 이후에는 박스 그리기
    const { x, y } = getScreenPoint(event);
    lastBox = { x1: dragStartCanvas.x, y1: dragStartCanvas.y, x2: x, y2: y };
    drawBox(lastBox);
  };

  const onMouseUp = (event) => {
    if (!isMouseDown) return;
    isMouseDown = false;

    // 드래그로 전환되지 않았다면 → 이건 "클릭"으로 처리되었어야 하는 경우.
    // 여기서는 아무 것도 하지 않고, 클릭 핸들러 결과만 남김.
    if (!isDragging) {
      clearOverlay();
      lastBox = null;
      return;
    }

    isDragging = false;

    if (!lastBox) {
      clearOverlay();
      return;
    }

    const { rect } = getScreenPoint(event);
    const normalized = normalize(lastBox);
    const screenBox = toScreenBox(normalized, rect);
    clearOverlay();

    const additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);

    try {
      if (!additive) viewer.unselect?.();
      viewer.select?.(normalized.x1, normalized.y1, normalized.x2, normalized.y2);
      viewer.update?.();

      const handles = collectHandlesFromSelection();

      console.log('[CanvasController] select mode: drag', {
        additive,
        handlesCount: handles.length,
        handles,
        box: normalized,
      });

      onSelect({
        additive,
        mode: 'drag',
        dpr: 1,
        box: normalized,
        screenBox,
        hit: null,
        handles,
      });
    } catch (e) {
      console.warn('[CanvasController] drag select error:', e);
    } finally {
      viewer.unselect?.();
      viewer.update?.();
      lastBox = null;
    }
  };

  const onResize = () => {
    syncOverlaySize();
    if (lastBox) drawBox(lastBox);
  };

  const cancel = () => {
    isMouseDown = false;
    isDragging = false;
    lastBox = null;
    clearOverlay();
  };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onResize);
  canvas.addEventListener('mouseleave', cancel);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('mouseleave', cancel);
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };
};

/////////////////////////
// [COMPOSE ALL]
/////////////////////////

/**
 * wheel + pan + leftClickSelect (+ dragSelect는 나중에) 한 번에 붙이고 cleanup 반환
 */
export const attachCanvasInteractions = (viewer, canvas, lib, { onSelect } = {}) => {
  if (!viewer || !canvas) return () => { };

  const cleanups = [];
  const c1 = attachWheelZoom(viewer, canvas);
  const c2 = attachPan(viewer, canvas);
  const c3 = attachLeftClickSelect(viewer, canvas, lib, { onSelect });
  const c4 = attachDragSelect(viewer, canvas, lib, { onSelect });

  cleanups.push(c1, c2, c3, c4);
  return () => {
    cleanups.forEach((fn) => fn && fn());
  };
};
