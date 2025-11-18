/* eslint-env browser */
// client/src/components/viewer/CanvasUtils.js

/////////////////////////
// [FILE CACHE + FETCH]
/////////////////////////

// VSFX 파일 캐시
export const fileCache = new Map();

/** 진행률 콜백 지원 fetch(ArrayBuffer) */
export async function fetchArrayBufferWithProgress(url, onProgress) {
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

/////////////////////////
// [VISUALIZE INIT]
/////////////////////////

/** Visualize.js 인스턴스 초기화 */
export async function initializeVisualizeJS() {
  if (!window.getVisualizeLibInst) {
    throw new Error('VisualizeJS가 로드되지 않았습니다.');
  }
  const wasmUrl = window.WasmUrl || '/Visualize.js.wasm';
  return await window.getVisualizeLibInst({
    TOTAL_MEMORY: 200 * 1024 * 1024,
    urlMemFile: wasmUrl,
  });
}

/** viewer 생성 */
export async function createViewer(lib, canvas) {
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
}

/////////////////////////
// [FONT UTILS]
/////////////////////////

/**
 * 텍스트 스타일의 폰트 파일 경로를 basename 기준으로 정리하고
 * SHX 폰트 big-font는 whgtxt.shx, 그 외는 defaultFont 사용.
 */
export async function fixFonts(viewer, defaultFont = 'gulim.ttc', basePath = '') {
  if (!viewer || typeof viewer.getTextStylesIterator !== 'function') return;

  try {
    const iter = viewer.getTextStylesIterator();
    if (!iter || typeof iter.done !== 'function') return;

    let prefix = basePath || '';
    if (prefix && !prefix.endsWith('/')) prefix = prefix + '/';

    while (!iter.done()) {
      let styleId = null;
      try {
        styleId = typeof iter.getTextStyle === 'function' ? iter.getTextStyle() : null;
      } catch (_) {}

      if (!styleId || typeof styleId.openObject !== 'function') {
        try { typeof iter.step === 'function' && iter.step(); } catch (_) {}
        continue;
      }

      let style = null;
      try {
        style = styleId.openObject();
      } catch (_) { style = null; }

      if (style) {
        try {
          const fileName = typeof style.getFileName === 'function' ? style.getFileName() : null;
          if (fileName && typeof fileName === 'string' && fileName.length) {
            const match = /[^\/\\]*$/gi.exec(fileName);
            const base = match && match[0] ? match[0] : null;
            if (base) {
              const fileOnly = base;
              const bigName = fileOnly.toLowerCase().endsWith('.shx') ? 'whgtxt.shx' : defaultFont;

              const resolvedFile = prefix ? (prefix + fileOnly) : fileOnly;
              const resolvedBig = prefix ? (prefix + bigName) : bigName;

              if (typeof style.setFileName === 'function') style.setFileName(resolvedFile);
              if (typeof style.setBigFontFileName === 'function') style.setBigFontFileName(resolvedBig);
            }
          }
        } catch (_) {}
      }

      try { typeof iter.step === 'function' && iter.step(); } catch (_) {}
    }
  } catch (_) {}
}

/**
 * 텍스트 스타일에서 참조하는 폰트를 /fonts 경로에서 로드해
 * viewer에 embed 하고 필요 시 regenAll 호출.
 *
 * fontNameSetRef: { current: Set<string> }
 */
export async function loadFonts(viewer, fontNameSetRef, basePath = '/fonts') {
  if (!viewer || typeof viewer.getTextStylesIterator !== 'function') return;

  const seenRef = fontNameSetRef && fontNameSetRef.current instanceof Set
    ? fontNameSetRef
    : { current: new Set() };

  let regenNeeded = false;

  try {
    const iter = viewer.getTextStylesIterator();
    if (!iter || typeof iter.done !== 'function') return;

    const namesToFetch = [];

    while (!iter.done()) {
      let styleId = null;
      try { styleId = iter.getTextStyle?.(); } catch (_) { styleId = null; }

      const style = styleId && styleId.openObject
        ? (() => { try { return styleId.openObject(); } catch (_) { return null; } })()
        : null;

      if (style) {
        try {
          const nameA = typeof style.getFileName === 'function' ? style.getFileName() : '';
          const nameB = typeof style.getBigFontFileName === 'function' ? style.getBigFontFileName() : '';

          const pushIfNeeded = (raw) => {
            if (raw && raw.length) {
              const base = /[^\/\\]*$/gi.exec(raw)?.[0] || raw;
              const normalized = base.includes('.') ? base : (base + '.ttf');
              if (!seenRef.current.has(normalized)) {
                namesToFetch.push(normalized);
              }
            }
          };

          pushIfNeeded(nameA);
          pushIfNeeded(nameB);
        } catch (_) {}
      }

      try { iter.step?.(); } catch (_) {}
    }

    for (let name of namesToFetch) {
      try {
        const url = (basePath && !basePath.endsWith('/')) ? `${basePath}/${name}` : `${basePath}${name}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();

        try {
          if (typeof window !== 'undefined' && typeof window.log === 'function') {
            window.log('font loaded', name, buffer.byteLength);
          }
        } catch (_) {}

        if (buffer.byteLength < 3200) {
          try {
            const api = (typeof window !== 'undefined' && window.Api) ? window.Api : null;
            if (api?.document?.setFontLog) {
              api.document.setFontLog(name);
            }
          } catch (_) {}
          continue;
        }

        if (typeof viewer.addEmbeddedFile === 'function') {
          viewer.addEmbeddedFile(name, new Uint8Array(buffer));
          seenRef.current.add(name);
          regenNeeded = true;
        }
      } catch (_) {
        // ignore
      }
    }

    if (regenNeeded && typeof viewer.regenAll === 'function') {
      try {
        viewer.regenAll();
      } catch (_) {}
    }
  } catch (_) {}
}

/////////////////////////
// [SELECTION / COLOR UTILS]
/////////////////////////

/** 선택 엔티티에서 type / layer 추출 */
export const extractTypeAndLayer = (entityId) => {
  try {
    const t = entityId.getType?.();
    let type = 'UNKNOWN';
    let obj = null;

    if (t === 1) {
      type = 'ENTITY';
      obj = entityId.openObject?.();
    } else if (t === 2) {
      type = 'INSERT';
      obj = entityId.openObjectAsInsert?.();
    } else {
      type = String(t ?? 'UNKNOWN');
      obj = entityId.openObject?.();
    }

    let layer = null;
    try {
      layer = obj
        ?.getLayer?.()
        ?.openObject?.()
        ?.getName?.() ?? null;
    } catch {
      layer = null;
    }

    return { type, layer };
  } catch {
    return { type: 'UNKNOWN', layer: null };
  }
};

/**
 * viewer.getSelected()에서
 *  - handle 배열
 *  - handle → { entityId, originalColor, type, layer } 맵
 * 을 갱신해서 반환.
 *
 * preserveExisting = true 이면 기존 entityDataMapRef는 유지하면서 새 것만 추가.
 */
/**
 * viewer.getSelected()에서
 *  - handle 배열
 *  - handle → { entityId, originalColor, type, layer } 맵
 * 을 갱신해서 반환.
 *
 * additive = true 이면 기존 entityDataMapRef 유지하면서 새 것만 추가/갱신.
 */
// CanvasUtils.js 안의 기존 collectSelectedEntities 를 이걸로 교체

/**
 * viewer.getSelected()에서
 *  - handle 배열
 *  - handle → { entityId, originalColor, type, layer } 맵(entityDataMapRef.current)
 * 을 갱신해서 반환.
 *
 * additive = true 이면 기존 entityDataMapRef 유지하면서 새 것만 추가/보정.
 */
// CanvasUtils.js 안의 기존 collectSelectedEntities 를 이걸로 교체

/**
 * viewer.getSelected()에서
 *  - handle 배열
 *  - handle → { entityId, originalColor, type, layer } 맵(entityDataMapRef.current)
 * 을 갱신해서 반환.
 *
 * additive = true 이면 기존 entityDataMapRef 유지하면서 새 것만 추가/보정.
 */
export const collectSelectedEntities = (viewer, lib, entityDataMapRef, additive = false) => {
  const handles = [];
  if (!viewer || !lib || !entityDataMapRef) return handles;

  const pSelected = viewer.getSelected?.();
  if (!pSelected || pSelected.isNull?.() || pSelected.numItems?.() <= 0) {
    return handles;
  }

  const itr = pSelected.getIterator?.();
  if (!itr) return handles;

  // testCavas에서 쓰던 원본 색상 추출 로직 그대로
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
    if (!entityId || entityId.isNull?.() && entityId.isNull()) {
      itr.step?.();
      continue;
    }

    // ENTITY / INSERT 각각에서 handle 뽑기
    const t = entityId.getType?.();
    const target =
      t === 2 && entityId.openObjectAsInsert
        ? entityId.openObjectAsInsert()
        : entityId.openObject?.();

    const handle = target?.getNativeDatabaseHandle?.();
    if (handle) {
      const key = String(handle);
      handles.push(key);

      const dataMap = entityDataMapRef.current;

      // type/layer 정보
      let rawName = null;
      try {
        rawName = target.getName?.();
      } catch (_) {}

      const type = normalizeEntityType(rawName, t);

      let layer = '';
      try {
        layer = target.getLayer?.()?.openObject?.()?.getName?.() ?? '';
      } catch (_) {
        layer = '';
      }

      // 원본 색상
      const originalColor = getOriginalColor(entityId);

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          entityId,
          originalColor,
          type,
          layer,
        });
      } else if (additive) {
        // additive 모드에서 기존 정보 보존/보정
        const prev = dataMap.get(key);
        dataMap.set(key, {
          entityId: prev.entityId || entityId,
          originalColor: prev.originalColor ?? originalColor,
          type: prev.type || type,
          layer: prev.layer || layer,
        });
      }
    }

    itr.step?.();
  }

  // 중복 제거
  return Array.from(new Set(handles));
};




/** 기본 색상 설정 (ENTITY / INSERT 공통 처리) */
export const setColorBasic = (lib, entityId, color) => {
  if (!lib || !entityId || typeof entityId.getType !== 'function') return;
  const t = entityId.getType();

  if (t === 1) {
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
    }
  }
};

/** 지정 핸들들을 빨간색으로 설정 */
export const setColorRed = (viewer, lib, entityDataMap, handles) => {
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
      failCount++;
    }
  });

  viewer.update?.();
  return { successCount, failCount };
};

/** 특정 핸들의 원본 색상으로 복원 */
export const resetColorByHandle = (viewer, lib, entityDataMap, handle) => {
  if (!viewer || !lib || !entityDataMap || !handle) return false;

  try {
    const data = entityDataMap.get(String(handle));
    if (!data || !data.entityId) {
      return false;
    }

    const originalColor = data.originalColor ?? 7;
    setColorBasic(lib, data.entityId, originalColor);
    viewer.update?.();
    return true;
  } catch (e) {
    return false;
  }
};


// DWG 클래스 이름 → 화면 표시용 타입명 변환
// 예) "AcDbMText" → "mtext", "AcDbLine" → "line"
const normalizeEntityType = (rawName, typeCode) => {
  // typeCode가 2면 INSERT로 고정 (블록참조)
  if (typeCode === 2) return 'Insert';

  if (!rawName) return 'unknown';

  let name = String(rawName);

  // "AcDb" 접두어 제거
  if (name.startsWith('AcDb')) {
    name = name.slice(4); // "MText" → "MText", "Line" → "Line"
  }
  return name;
  // return name.toUpperCase(); // "MText" → "MTEXT"
};
