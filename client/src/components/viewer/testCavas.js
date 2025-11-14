// client/src/components/viewer/testCavas.js
//
// 테스트 전용 단일 파일 컴포넌트
// - 선택 시 자동 red 색상 적용
// - 핸들별 제외 기능 (색상 초기화)
// - 테이블 형식 핸들 리스트

import React, { useEffect, useRef, useState } from 'react';
import './DwgDisplay.css';

/////////////////////////
// [UTILS]
/////////////////////////

const fileCache = new Map();

/** 진행률 콜백 지원 fetch(ArrayBuffer) */
async function fetchArrayBufferWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('VSFX 파일 불러오기 실패');
  const contentLength = res.headers.get('content-length');

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
    const percent = Math.max(1, Math.floor((loaded / total) * 80));
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

/** Visualize.js 인스턴스 초기화 */
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

/** viewer 생성 */
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

/////////////////////////
// [CONTROLS]
/////////////////////////

/** 박스커서 생성 */
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
  return () => {
    canvas.style.cursor = prev;
  };
};

/** 휠줌 */
const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
  if (!viewer || !canvas) return () => {};
  const onWheel = (() => {
    let raf = 0,
      acc = 0,
      lastX = 0,
      lastY = 0;
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

/** 우클릭/휠클릭 팬 */
const attachPan = (viewer, canvas) => {
  if (!viewer || !canvas) return () => {};

  let isPanning = false;
  let panButton = null;
  let lastMouseX = 0,
    lastMouseY = 0;
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
        try {
          viewer.zoomExtents?.();
          viewer.update?.();
        } catch {}
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
// [COLOR / SELECTION UTILS]
/////////////////////////

/**
 * 선택된 엔티티로부터
 *  - handle 배열
 *  - entityId + originalColor 맵(entityDataMapRef.current)
 * 을 추출
 *
 * 주의:
 *  - 기존 맵을 clear 하지 않고, 한 번이라도 선택된 엔티티의 originalColor를 계속 유지
 */
const collectSelectedEntities = (viewer, lib, entityDataMapRef, preserveExisting = false) => {
  const handles = [];

  const pSelected = viewer.getSelected?.();
  if (!pSelected || pSelected.isNull?.() || pSelected.numItems?.() <= 0) {
    return handles;
  }

  const itr = pSelected.getIterator?.();
  if (!itr) return handles;

  const getOriginalColor = (entityId) => {
    const t = entityId.getType?.();
    try {
      if (t === 1) {
        const obj = entityId.openObject?.();
        if (!obj) return 7;
        const colorDef = obj.getColor(lib.GeometryTypes.kAll);
        let color = colorDef.getColor();
        if (typeof colorDef.getInheritedColor === 'function' && colorDef.getInheritedColor() === 0) {
          const layerColor = obj
            .getLayer(lib.GeometryTypes.kAll)
            .openObject()
            .getColor()
            .getColor();
          color = layerColor;
        }
        return { r: color[0], g: color[1], b: color[2] };
      }
      if (t === 2) {
        const insert = entityId.openObjectAsInsert?.();
        if (!insert) return 7;
        const colorDef = insert.getColor();
        let color = colorDef.getColor();
        if (typeof colorDef.getInheritedColor === 'function' && colorDef.getInheritedColor() === 0) {
          const layerColor = insert.getLayer().openObject().getColor().getColor();
          color = layerColor;
        }
        return { r: color[0], g: color[1], b: color[2] };
      }
    } catch (e) {
      // 실패 시 숫자 인덱스 색으로 fallback
    }
    return 7;
  };

  while (!itr.done?.()) {
    const entityId = itr.getEntity?.();
    if (!entityId) {
      itr.step?.();
      continue;
    }

    const target =
      entityId.getType?.() === 2 ? entityId.openObjectAsInsert?.() : entityId.openObject?.();
    const handle = target?.getNativeDatabaseHandle?.();

    if (handle) {
      const key = String(handle);
      handles.push(key);

      // 이미 존재하는 항목은 원본 색상 보존
      if (!entityDataMapRef.current.has(key)) {
        let originalColor = 7;
        try {
          originalColor = getOriginalColor(entityId);
        } catch (e) {
          console.warn(`원본 색상 가져오기 실패: ${handle}`, e);
        }
        entityDataMapRef.current.set(key, {
          entityId,
          originalColor,
        });
      }
    }
    itr.step?.();
  }

  return Array.from(new Set(handles));
};

const setColorBasic = (lib, entityId, color) => {
  if (!lib || !entityId || typeof entityId.getType !== 'function') return;
  const t = entityId.getType();

  if (t === 1) {
    // 일반 Entity
    const entity = entityId.openObject?.();
    if (!entity) return;

    if (typeof color !== 'number') {
      entity.setColor(color.r, color.g, color.b);
      if (typeof entity.getGeometryDataIterator === 'function') {
        const geomIter = entity.getGeometryDataIterator();
        for (; !geomIter.done(); geomIter.step()) {
          const geo = geomIter.getGeometryData().openObject();
          geo.setColor(color.r, color.g, color.b);
        }
      }
    } else {
      const colorObj = entity.getColor(lib.GeometryTypes.kAll);
      colorObj.setIndexedColor(color);
      entity.setColor(colorObj, lib.GeometryTypes.kAll);
    }
  } else if (t === 2) {
    // INSERT (블록 참조)
    const insert = entityId.openObjectAsInsert?.();
    if (!insert) return;

    try {
      const colorDef = insert.getColor();

      if (typeof color !== 'number') {
        colorDef.setColor(color.r, color.g, color.b);
      } else {
        colorDef.setIndexedColor(color);
      }

      insert.setColor(colorDef);
    } catch (e) {
      console.error('INSERT 색상 설정 실패:', e);
    }
  }
};

const setColorRed = (viewer, lib, entityDataMap, handles) => {
  if (!viewer || !lib || !entityDataMap || !handles || handles.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  const RED = { r: 255, g: 0, b: 0 };
  let successCount = 0;
  let failCount = 0;

  handles.forEach((handle) => {
    try {
      const data = entityDataMap.get(String(handle));
      if (!data || !data.entityId) {
        failCount++;
        return;
      }
      setColorBasic(lib, data.entityId, RED);
      successCount++;
    } catch (e) {
      console.error('setColorRed error:', e);
      failCount++;
    }
  });
  viewer.update?.();
  return { successCount, failCount };
};

const resetColorByHandle = (viewer, lib, entityDataMap, handle) => {
  if (!viewer || !lib || !entityDataMap || !handle) return false;

  try {
    const data = entityDataMap.get(String(handle));
    if (!data || !data.entityId) {
      // 필요 시 디버깅용 로그
      console.warn(`핸들 ${handle}에 대한 데이터가 없습니다.`);
      return false;
    }

    const originalColor = data.originalColor ?? 7;
    setColorBasic(lib, data.entityId, originalColor);
    viewer.update?.();
    return true;
  } catch (e) {
    console.error(`resetColorByHandle error for handle ${handle}:`, e);
    return false;
  }
};

/////////////////////////
// [SELECTION HANDLERS] (좌클릭 + 드래그)
/////////////////////////

/**
 * 일반 단일 클릭 선택
 * - Ctrl/Shift 조합 시 additive 모드
 */
const attachLeftClickSelect = (viewer, canvas, lib, options = {}) => {
  if (!viewer || !canvas || !lib) return () => {};

  const { onSelect = () => {}, radius = 4, entityDataMapRef } = options;

  let isDown = false;
  let moved = false;
  let downX = 0;
  let downY = 0;
  const moveThreshold = 3;

  const onMouseDown = (event) => {
    if (event.button !== 0) return;
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

  const onMouseUp = (event) => {
    // 좌클릭만 처리
    if (event.button !== 0) {
      isDown = false;
      moved = false;
      return;
    }
    // 드래그로 판단되면 여기서는 처리하지 않음(드래그 셀렉트에 맡김)
    if (!isDown || moved) {
      isDown = false;
      moved = false;
      return;
    }

    isDown = false;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cx = (event.clientX - rect.left) * dpr;
    const cy = (event.clientY - rect.top) * dpr;
    const r = Math.max(1, radius * dpr);

    const x1 = Math.max(0, cx - r);
    const y1 = Math.max(0, cy - r);
    const x2 = cx + r;
    const y2 = cy + r;

    const additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);

    try {
      if (!additive) viewer.unselect?.();
      viewer.select?.(x1, y1, x2, y2);
      viewer.update?.();

      const handles = collectSelectedEntities(viewer, lib, entityDataMapRef, additive);
      onSelect(handles, { x1, y1, x2, y2 }, additive, 'click', entityDataMapRef.current);
    } catch (e) {
      console.error('left-click select error:', e);
    }
  };

  const onLeaveCancel = () => {
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
  canvas.addEventListener('mouseleave', onLeaveCancel);
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
 * 드래그 박스 선택
 * - Shift / Ctrl / Meta 키가 눌려 있으면 additive 모드
 */
const attachDragSelect = (viewer, canvas, lib, options = {}) => {
  if (!viewer || !canvas || !lib) return () => {};

  const { onSelect = () => {}, entityDataMapRef } = options;

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
    y2: Math.max(box.y1, box.y2),
  });

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let lastBox = null;
  let additiveKeyDown = false;

  const onKeyDown = (event) => {
    if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta') {
      additiveKeyDown = true;
    }
  };
  const onKeyUp = (event) => {
    if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta') {
      additiveKeyDown = false;
    }
  };

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

    const additive =
      additiveKeyDown || event.shiftKey || event.ctrlKey || event.metaKey ? true : false;

    try {
      if (!additive) viewer.unselect?.();
      viewer.select?.(normalized.x1, normalized.y1, normalized.x2, normalized.y2);
      viewer.update?.();

      const handles = collectSelectedEntities(viewer, lib, entityDataMapRef, additive);

      onSelect(
        handles,
        {
          x1: normalized.x1 / dpr,
          y1: normalized.y1 / dpr,
          x2: normalized.x2 / dpr,
          y2: normalized.y2 / dpr,
        },
        additive,
        'drag',
        entityDataMapRef.current
      );
    } catch (error) {
      console.error('attachDragSelect error:', error);
    } finally {
      viewer.unselect();
      viewer.update();
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
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };
};

/////////////////////////
// [UI - HandlePanel]
/////////////////////////

const HandlePanel = ({
  handles,
  onClear,
  onRemoveHandle,
  collapsed,
  setCollapsed,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        right: 8,
        bottom: 8,
        background: 'rgba(0,0,0,0.9)',
        color: '#fff',
        padding: '14px 16px',
        borderRadius: 8,
        maxWidth: 600,
        minWidth: 320,
        fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 14, color: '#ef4444' }}>선택 핸들 (RED)</strong>
        <span style={{ opacity: 0.8, fontSize: 13 }}>({handles.length}개)</span>
        <div style={{ flex: 1 }} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: '#374151',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 'bold',
          }}
          title={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? '▼' : '▲'}
        </button>

        <button
          onClick={onClear}
          disabled={handles.length === 0}
          style={{
            background: handles.length > 0 ? '#dc2626' : '#4b5563',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: handles.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 'bold',
          }}
          title="전체 초기화"
        >
          전체 초기화
        </button>
      </div>

      {!collapsed && (
        <div
          style={{
            maxHeight: 300,
            overflow: 'auto',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {handles.length === 0 ? (
            <div
              style={{
                opacity: 0.7,
                textAlign: 'center',
                padding: '40px 20px',
                fontSize: 13,
              }}
            >
              선택된 핸들이 없습니다
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderBottom: '2px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      width: '60px',
                    }}
                  >
                    번호
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                    }}
                  >
                    핸들값
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      width: '80px',
                    }}
                  >
                    제외
                  </th>
                </tr>
              </thead>
              <tbody>
                {handles.map((handle, index) => (
                  <tr
                    key={handle}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td
                      style={{
                        padding: '10px 12px',
                        color: '#9ca3af',
                        fontWeight: 'bold',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        wordBreak: 'break-all',
                      }}
                    >
                      {handle}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        onClick={() => onRemoveHandle(handle)}
                        style={{
                          background: '#f59e0b',
                          color: '#000',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 'bold',
                          transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#fbbf24';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#f59e0b';
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="선택 제외 및 색상 초기화"
                      >
                        제외
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

/////////////////////////
// [MAIN] TestCavas
/////////////////////////

const TestCavas = ({ filePath, isActive }) => {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const resizeObserverRef = useRef(null);
  const cleanupFunctionsRef = useRef([]);

  const libRef = useRef(null);
  const entityDataMapRef = useRef(new Map());

  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadPercent, setLoadPercent] = useState(0);
  const [selectedHandles, setSelectedHandles] = useState([]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  /**
   * 선택 결과 처리
   * - 일반 클릭: 기존 목록 초기화 후 신규만 하이라이트
   * - Ctrl/Shift + 클릭/드래그: 윈도우 아이콘처럼 토글(추가/제외)
   * - 빈 영역 클릭(비 additive): 전체 초기화
   */
  const handleSelection = (handles, screenBox, additive, mode) => {
    setSelectedHandles((prev) => {
      const prevList = prev || [];
      const prevSet = new Set(prevList);
      const clickedList = handles || [];
      const clickedSet = new Set(clickedList);

      // 아무 것도 선택되지 않은 경우
      if (clickedList.length === 0) {
        if (!additive && prevList.length > 0) {
          // 빈 영역 클릭 - 전체 색상 초기화
          prevList.forEach((h) => {
            resetColorByHandle(
              viewerRef.current,
              libRef.current,
              entityDataMapRef.current,
              h
            );
          });
          return [];
        }
        // additive 모드에서 빈 선택이면 변화 없음
        return prevList;
      }

      // 비 additive: 기존 선택 제거, 신규만 유지
      if (!additive) {
        // 이전 선택 중에서 이번에 선택되지 않은 것들 색상 복원
        prevList.forEach((h) => {
          if (!clickedSet.has(h)) {
            resetColorByHandle(
              viewerRef.current,
              libRef.current,
              entityDataMapRef.current,
              h
            );
          }
        });

        const next = Array.from(clickedSet);
        // 새로 빨간색으로 칠해야 하는 핸들만 골라서 적용
        const newlySelected = next.filter((h) => !prevSet.has(h));
        if (newlySelected.length > 0) {
          setColorRed(
            viewerRef.current,
            libRef.current,
            entityDataMapRef.current,
            newlySelected
          );
        }
        return next;
      }

      // additive 모드: 토글(있으면 제거, 없으면 추가)
      const nextSet = new Set(prevSet);
      const toggledOff = [];
      const toggledOn = [];

      clickedSet.forEach((h) => {
        if (nextSet.has(h)) {
          nextSet.delete(h);
          toggledOff.push(h);
        } else {
          nextSet.add(h);
          toggledOn.push(h);
        }
      });

      // 색상 복원 (제외된 것)
      toggledOff.forEach((h) => {
        resetColorByHandle(
          viewerRef.current,
          libRef.current,
          entityDataMapRef.current,
          h
        );
      });

      // 색상 적용 (새로 추가된 것)
      if (toggledOn.length > 0) {
        setColorRed(
          viewerRef.current,
          libRef.current,
          entityDataMapRef.current,
          toggledOn
        );
      }

      return Array.from(nextSet);
    });
  };

  const handleRemoveHandle = (handle) => {
    if (!viewerRef.current || !libRef.current) {
      console.warn('Viewer 또는 Library가 초기화되지 않았습니다.');
      return;
    }

    const ok = resetColorByHandle(
      viewerRef.current,
      libRef.current,
      entityDataMapRef.current,
      handle
    );

    if (ok) {
      setSelectedHandles((prev) => prev.filter((h) => h !== handle));
      // 필요 시 맵에서 제거해도 되고, 남겨 놔도 됨(원본 색상 정보 유지)
      // entityDataMapRef.current.delete(String(handle));
      console.log(`핸들 ${handle} 제외 완료`);
    } else {
      console.error(`핸들 ${handle} 제외 실패`);
    }
  };

  const attachEventListeners = () => {
    if (!viewerRef.current || !canvasRef.current || !libRef.current) return;

    cleanupFunctionsRef.current.forEach((fn) => fn?.());
    cleanupFunctionsRef.current = [];

    const c1 = attachWheelZoom(viewerRef.current, canvasRef.current);
    const c2 = attachPan(viewerRef.current, canvasRef.current);
    const c3 = attachLeftClickSelect(viewerRef.current, canvasRef.current, libRef.current, {
      onSelect: handleSelection,
      radius: 4,
      entityDataMapRef,
    });
    const c4 = attachDragSelect(viewerRef.current, canvasRef.current, libRef.current, {
      onSelect: handleSelection,
      entityDataMapRef,
    });

    cleanupFunctionsRef.current = [c1, c2, c3, c4].filter(Boolean);
  };

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

  useEffect(() => {
    if (!filePath || isInitializedRef.current) return;

    let isMounted = true;

    const init = async () => {
      try {
        setIsLoading(true);
        setLoadPercent(1);

        const libInstance = await initializeVisualizeJS();
        if (!isMounted) return;

        libRef.current = libInstance;

        const viewerInstance = await createViewer(libInstance, canvasRef.current);
        if (!isMounted) {
          viewerInstance?.destroy();
          return;
        }

        viewerRef.current = viewerInstance;

        let arrayBuffer;
        if (fileCache.has(filePath)) {
          arrayBuffer = fileCache.get(filePath);
          setLoadPercent(30);
        } else {
          arrayBuffer = await fetchArrayBufferWithProgress(filePath, (p) => {
            if (isMounted) setLoadPercent(p);
          });
          if (!isMounted) return;
          fileCache.set(filePath, arrayBuffer);
        }

        setLoadPercent(85);
        await viewerRef.current.parseVsfx(arrayBuffer);
        if (!isMounted) return;

        setLoadPercent(95);
        viewerRef.current.setEnableSceneGraph?.(true);
        viewerRef.current.setEnableAnimation?.(false);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
        setIsLoading(false);

        if (isActive) attachEventListeners();
      } catch (err) {
        console.error('TestCavas 초기화 실패:', err);
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

  useEffect(() => {
    if (isInitializedRef.current && isActive) {
      attachEventListeners();
    }
  }, [isActive]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (viewerRef.current) handleResize();
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;
    handleResize();
    return () => observer.disconnect();
  }, [filePath]);

  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach((fn) => fn?.());
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (viewerRef.current) viewerRef.current.destroy?.();
    };
  }, []);

  const clearHandles = () => {
    if (!viewerRef.current || !libRef.current) {
      console.warn('Viewer 또는 Library가 초기화되지 않았습니다.');
      return;
    }

    if (selectedHandles.length > 0) {
      let successCount = 0;
      selectedHandles.forEach((h) => {
        const ok = resetColorByHandle(
          viewerRef.current,
          libRef.current,
          entityDataMapRef.current,
          h
        );
        if (ok) successCount++;
      });
      console.log(`전체 초기화: ${successCount}/${selectedHandles.length}개 성공`);
    }

    setSelectedHandles([]);
    // 전체 초기화 시 맵도 함께 비워도 되고, 유지해도 됨.
    entityDataMapRef.current.clear();
  };

  const visibleStyle = { opacity: isLoading ? 0.35 : 1 };

  return (
    <div
      ref={containerRef}
      className="viewer-app-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
    >
      <div
        className="viewer-canvas-container"
        style={{ flex: 1, position: 'relative', ...visibleStyle }}
      >
        <canvas
          ref={canvasRef}
          id="testCanvas"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.85)',
              padding: '20px 40px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 'bold',
            }}
          >
            로딩 중... {loadPercent}%
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              backgroundColor: 'rgba(220, 53, 69, 0.9)',
              padding: 20,
              borderRadius: 8,
            }}
          >
            {errorMessage}
          </div>
        )}

        <HandlePanel
          handles={selectedHandles}
          onClear={clearHandles}
          onRemoveHandle={handleRemoveHandle}
          collapsed={panelCollapsed}
          setCollapsed={setPanelCollapsed}
        />
      </div>
    </div>
  );
};

export default TestCavas;
