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
  if (!res.ok) throw new Error('Failed to load VSFX file');
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
    throw new Error('VisualizeJS failed to load.');
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
      } catch (_) { }

      if (!styleId || typeof styleId.openObject !== 'function') {
        try { typeof iter.step === 'function' && iter.step(); } catch (_) { }
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
        } catch (_) { }
      }

      try { typeof iter.step === 'function' && iter.step(); } catch (_) { }
    }
  } catch (_) { }
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
        } catch (_) { }
      }

      try { iter.step?.(); } catch (_) { }
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
        } catch (_) { }

        if (buffer.byteLength < 3200) {
          try {
            const api = (typeof window !== 'undefined' && window.Api) ? window.Api : null;
            if (api?.document?.setFontLog) {
              api.document.setFontLog(name);
            }
          } catch (_) { }
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
      } catch (_) { }
    }
  } catch (_) { }
}

/////////////////////////
// [SELECTION / COLOR UTILS]
/////////////////////////

/** ENTITY / INSERT 공통 ColorDef 추출 (읽기 전용) */
const getColorDefFromEntity = (lib, entityId) => {
  if (!lib || !entityId || typeof entityId.getType !== 'function') return null;

  const t = entityId.getType();
  try {
    if (t === 1) {
      const obj = entityId.openObject?.();
      return obj?.getColor?.(lib.GeometryTypes.kAll) || null;
    }
    if (t === 2) {
      const insert = entityId.openObjectAsInsert?.();
      return insert?.getColor?.() || null;
    }
  } catch (_) {
    return null;
  }

  return null;
};

/**
 * 엔터티의 인덱스 컬러(ACI)를 읽어옵니다.
 * 색상 상속 여부와 무관하게 ColorDef에 지정된 값을 그대로 반환합니다.
 */
export const getIndexedColor = (lib, entityId) => {
  const colorDef = getColorDefFromEntity(lib, entityId);
  if (!colorDef || typeof colorDef.getIndexedColor !== 'function') return null;

  try {
    const idx = colorDef.getIndexedColor();
    return Number.isFinite(idx) ? idx : null;
  } catch (_) {
    return null;
  }
};

/**
 * 엔터티의 트루컬러(RGB)를 읽어옵니다.
 * 레이어/상속 처리를 하지 않고 ColorDef에 담긴 값만 반환합니다.
 */
export const getTrueColor = (lib, entityId) => {
  const colorDef = getColorDefFromEntity(lib, entityId);
  if (!colorDef || typeof colorDef.getColor !== 'function') return null;

  try {
    const colorArr = colorDef.getColor();
    const rgb = parseRgbColor(colorArr);
    if (rgb) return rgb;
  } catch (_) {
    return null;
  }

  // Fallback: try raw array/object
  try {
    const raw = colorDef.getColor?.();
    const rgb = parseRgbColor(raw);
    if (rgb) return rgb;
  } catch (_) { }

  return null;
};

const isZeroColor = (c) => {
  if (!c || typeof c !== 'object') return true;
  return c.r === 0 && c.g === 0 && c.b === 0;
};

const extractColorFromColorDef = (colorDef) => {
  if (!colorDef) return null;
  try {
    if (
      typeof colorDef.getRed === 'function' &&
      typeof colorDef.getGreen === 'function' &&
      typeof colorDef.getBlue === 'function'
    ) {
      const r = colorDef.getRed();
      const g = colorDef.getGreen();
      const b = colorDef.getBlue();
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return { r, g, b };
      }
    }
  } catch (_) { }

  try {
    const raw = typeof colorDef.getColor === 'function' ? colorDef.getColor() : null;
    const rgb = parseRgbColor(raw);
    if (rgb) return rgb;
  } catch (_) { }

  return null;
};

const extractTrueColorFromLayer = (layerObj) => {
  if (!layerObj) return null;
  try {
    const tc = typeof layerObj.getTrueColor === 'function' ? layerObj.getTrueColor() : null;
    if (tc) {
      const r = typeof tc.getRed === 'function' ? tc.getRed() : tc.r;
      const g = typeof tc.getGreen === 'function' ? tc.getGreen() : tc.g;
      const b = typeof tc.getBlue === 'function' ? tc.getBlue() : tc.b;
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return { r, g, b };
      }
      const parsed = parseRgbColor(tc);
      if (parsed) return parsed;
      // 마지막 수단: 객체 내 숫자 프로퍼티 스캔
      const vals = Object.values(tc).filter((v) => Number.isFinite(v));
      if (vals.length >= 3) {
        return { r: vals[0], g: vals[1], b: vals[2] };
      }
    }
  } catch (_) { }
  return null;
};

const parseRgbColor = (val) => {
  if (!val) return null;

  const tryArray = (arr) => {
    if (!arr || arr.length < 3) return null;
    const [r, g, b] = arr;
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return { r, g, b };
    }
    return null;
  };

  if (Array.isArray(val)) {
    return tryArray(val);
  }

  if (ArrayBuffer.isView(val)) {
    return tryArray(Array.from(val));
  }

  if (typeof val === 'object' && val.r !== undefined && val.g !== undefined && val.b !== undefined) {
    const { r, g, b } = val;
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return { r, g, b };
    }
  }
  return null;
};

/**
 * ENTITY / INSERT 색상 정보를 인덱스/트루컬러로 분리해서 반환
 * - colorType: kDefault=0, kColor=1, kInherited(byLayer)=2, kIndexed=3
 * - indexColor: 인덱스 번호 (없으면 null)
 * - trueColor: { r, g, b } | null
 * - displayColor: 색상칩용 RGB (없으면 null)
 * - resetColor: setColorBasic에 바로 전달할 원본 값
 * - 주의: 레이어에 지정된 RGB(trueColor)는 라이브러리 제약으로 직접 지원되지 않음
 */
const getEntityColorInfo = (lib, entityId) => {
  const indexedColor = getIndexedColor(lib, entityId);
  const trueColor = getTrueColor(lib, entityId);
  const colorDef = getColorDefFromEntity(lib, entityId);
  const colorTypeNum = typeof colorDef?.getType === 'function' ? colorDef.getType() : null;

  const ctEnum = lib?.ColorType;
  const valOr = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
  const kDefaultVal = valOr(ctEnum?.kDefault);
  const kColorVal = valOr(ctEnum?.kColor);
  const kInheritedVal = valOr(ctEnum?.kInherited);
  const kIndexedVal = valOr(ctEnum?.kIndexed ?? ctEnum?.['kIndexed ']);

  const normalizeColorType = (num) => {
    if (num === kColorVal) return 'kColor';
    if (num === kIndexedVal) return 'kIndexed';
    if (num === kInheritedVal) return 'kInherited';
    if (num === kDefaultVal) return 'kDefault';
    return null;
  };

  const hasIndex = typeof indexedColor === 'number' && Number.isFinite(indexedColor);
  const hasTrueColor = !!trueColor;
  const trueIsZero = isZeroColor(trueColor);
  const idxVal = hasIndex ? indexedColor : 0;

  let colorType = normalizeColorType(colorTypeNum) || 'kDefault';
  let resetColor = 7;
  let displayColor = hasTrueColor ? trueColor : null;

  if (colorType === 'kDefault' || colorType === null) {
    if (hasTrueColor && !trueIsZero) {
      colorType = 'kColor';
    } else if (hasIndex && idxVal !== 0) {
      colorType = 'kIndexed';
    } else {
      colorType = 'kInherited';
    }
  }

  if (colorType === 'kColor') {
    resetColor = hasTrueColor ? trueColor : resetColor;
  } else if (colorType === 'kIndexed') {
    resetColor = hasIndex ? indexedColor : resetColor;
  } else if (colorType === 'kInherited') {
    resetColor = 7;
  }

  return {
    colorType,
    indexColor: hasIndex ? indexedColor : null,
    trueColor: hasTrueColor ? trueColor : null,
    displayColor,
    resetColor,
  };
};

/** 선택 엔티티에서 type / layer 추출 (간단 버전) */
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

/** ENTITY / INSERT 색상을 읽어 인덱스/트루컬러 정보를 함께 반환 */
const getOriginalColorFromEntity = (lib, entityId) => getEntityColorInfo(lib, entityId);

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

  if (!entityDataMapRef.current || !(entityDataMapRef.current instanceof Map)) {
    entityDataMapRef.current = new Map();
  }
  const dataMap = entityDataMapRef.current;

  const pSelected = viewer.getSelected?.();
  if (!pSelected || pSelected.isNull?.() || pSelected.numItems?.() <= 0) {
    return handles;
  }

  const itr = pSelected.getIterator?.();
  if (!itr) return handles;

  while (!itr.done?.()) {
    const entityId = itr.getEntity?.();
    if (!entityId || (entityId.isNull?.() && entityId.isNull())) {
      itr.step?.();
      continue;
    }

    const t = entityId.getType?.();
    let target = null;
    try {
      target =
        t === 2 && entityId.openObjectAsInsert
          ? entityId.openObjectAsInsert()
          : entityId.openObject?.();
    } catch (_) {
      target = null;
    }

    const handle = target?.getNativeDatabaseHandle?.();
    if (handle) {
      const key = String(handle);
      handles.push(key);

      let rawName = null;
      try {
        rawName = target.getName?.();
      } catch (_) { }

      const type = normalizeEntityType(rawName, t);

      let layer = '';
      try {
        layer = target.getLayer?.()?.openObject?.()?.getName?.() ?? '';
      } catch (_) {
        layer = '';
      }

      const colorInfo = getOriginalColorFromEntity(lib, entityId);
      let layerColor = null;
      try {
        const layerPtr = (() => {
          try {
            const gt = lib?.GeometryTypes?.kAll;
            return target?.getLayer?.(gt !== undefined ? gt : undefined) ?? target?.getLayer?.();
          } catch (_) {
            return target?.getLayer?.();
          }
        })();
        const layerObj = layerPtr?.openObject?.();

        let colorDef = null;
        try {
          const gt = lib?.GeometryTypes?.kAll;
          colorDef =
            typeof layerObj?.getColor === 'function'
              ? layerObj.getColor(gt !== undefined ? gt : undefined)
              : null;
        } catch (_) {
          colorDef = layerObj?.getColor?.() ?? null;
        }
        const colorTypeNum = typeof colorDef?.getType === 'function' ? colorDef.getType() : null;
        const inheritedFlag = typeof colorDef?.getInheritedColor === 'function' ? colorDef.getInheritedColor() : null;

        // 1) ColorDef 기반
        layerColor = extractColorFromColorDef(colorDef);

        // 2) 레이어 trueColor()
        if ((!layerColor || isZeroColor(layerColor)) && layerObj) {
          const tcLayer = extractTrueColorFromLayer(layerObj);
          if (tcLayer && !isZeroColor(tcLayer)) {
            layerColor = tcLayer;
          }
        }

        // 3) ColorDef가 ByLayer(default)이고 getColorIndex/Color가 0,0,0인 경우: getLayer().getColor().getColor() 직접 시도
        if ((!layerColor || isZeroColor(layerColor)) && layerObj && inheritedFlag === 0) {
          try {
            const gt = lib?.GeometryTypes?.kAll;
            const lcArr =
              layerObj.getColor?.(gt !== undefined ? gt : undefined)?.getColor?.() ??
              layerObj.getColor?.()?.getColor?.();
            const parsed = parseRgbColor(lcArr);
            if (parsed && !isZeroColor(parsed)) {
              layerColor = parsed;
            }
          } catch (_) { }
        }

        // 4) getColorDef()가 있다면 추가 시도
        if ((!layerColor || isZeroColor(layerColor)) && typeof layerObj?.getColorDef === 'function') {
          try {
            const def2 = layerObj.getColorDef();
            const raw2 = def2?.getColor?.();
            const parsed2 = parseRgbColor(raw2);
            if (parsed2 && !isZeroColor(parsed2)) {
              layerColor = parsed2;
            }
          } catch (_) { }
        }

        // 4) ColorDef index만 있는 경우 (여기선 그대로 둠)
        if (!layerColor && typeof colorDef?.getColorIndex === 'function') {
          const idx = colorDef.getColorIndex();
          if (Number.isFinite(idx) && idx !== 0) {
            layerColor = null;
          }
        }

      } catch (_) {
        layerColor = null;
      }

      const idxVal = Number.isFinite(colorInfo.indexColor) ? colorInfo.indexColor : 0;
      const tc = colorInfo.trueColor;
      const trueIsZero = isZeroColor(tc);

      let resolvedColorType = colorInfo.colorType || 'kDefault';
      let originalColor = layerColor;

      if (resolvedColorType === 'kColor' && tc) {
        originalColor = tc;
      } else if (resolvedColorType === 'kIndexed') {
        originalColor = idxVal;
      } else if (resolvedColorType === 'kInherited') {
        originalColor = layerColor;
      } else {
        if (tc && !trueIsZero) {
          resolvedColorType = 'kColor';
          originalColor = tc;
        } else if (idxVal !== 0) {
          resolvedColorType = 'kIndexed';
          originalColor = idxVal;
        } else {
          resolvedColorType = 'kInherited';
          originalColor = layerColor;
        }
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          entityId,
          originalColor,
          initialOriginalColor: originalColor,
          objectColor: colorInfo.displayColor ?? originalColor,
          colorType: resolvedColorType,
          indexColor: colorInfo.indexColor,
          trueColor: colorInfo.trueColor,
          layerColor,
          type,
          layer,
          lastColorOption: null,
          hasColorChanged: false,
        });
      } else if (additive) {
        const prev = dataMap.get(key);
        const originalColor = prev.originalColor ?? originalColor;
        dataMap.set(key, {
          entityId: prev.entityId || entityId,
          originalColor,
          initialOriginalColor: prev.initialOriginalColor ?? originalColor,
          objectColor: prev.objectColor ?? colorInfo.displayColor ?? originalColor,
          colorType: prev.colorType ?? resolvedColorType,
          indexColor: prev.indexColor ?? colorInfo.indexColor,
          trueColor: prev.trueColor ?? colorInfo.trueColor,
          layerColor: prev.layerColor ?? layerColor,
          type: prev.type || type,
          layer: prev.layer || layer,
          lastColorOption: prev.lastColorOption ?? null,
          hasColorChanged: prev.hasColorChanged ?? false,
        });
      }
    }

    itr.step?.();
  }

  // 중복 제거
  return Array.from(new Set(handles));
};

/**
 * 기본 색상 설정 (ENTITY / INSERT 공통, ColorDef 기반)
 * - GeometryData 수준 setColor 호출은 하지 않는다.
 */
export const setColorBasic = (lib, entityId, color) => {
  if (!lib || !entityId || typeof entityId.getType !== 'function') return;
  const t = entityId.getType();

  const applyColorToColorDef = (colorDef, col) => {
    if (!colorDef) return;
    if (typeof col === 'number') {
      colorDef.setIndexedColor(col);
    } else if (col && typeof col === 'object') {
      const { r, g, b } = col;
      colorDef.setColor(r, g, b);
    }
  };

  try {
    if (t === 1) {
      // ENTITY
      const entity = entityId.openObject?.();
      if (!entity) return;
      const colorDef = entity.getColor(lib.GeometryTypes.kAll);
      applyColorToColorDef(colorDef, color);
      entity.setColor(colorDef, lib.GeometryTypes.kAll);
    } else if (t === 2) {
      // INSERT
      const insert = entityId.openObjectAsInsert?.();
      if (!insert) return;
      const colorDef = insert.getColor();
      applyColorToColorDef(colorDef, color);
      insert.setColor(colorDef);
    }
  } catch (e) {
    // 필요하면 로그
    // console.warn('[setColorBasic] error', e);
  }
};

/** 지정 핸들들을 빨간색으로 설정 (viewer.update는 한 번만 호출) */
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

/** 특정 핸들의 원본 색상으로 복원 (update는 호출하지 않음) */
export const resetColorByHandle = (viewer, lib, entityDataMap, handle) => {
  if (!viewer || !lib || !entityDataMap || !handle) return false;

  try {
    const data = entityDataMap.get(String(handle));
    if (!data || !data.entityId) {
      return false;
    }

    const originalColor =
      data.originalColor ??
      data.initialOriginalColor ??
      (data.colorType === 'kColor' ? data.trueColor : null) ??
      (Number.isFinite(data.indexColor) ? data.indexColor : null) ??
      7;

    setColorBasic(lib, data.entityId, originalColor);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * 여러 핸들의 색상을 원본으로 복원하고 마지막에 한 번만 update()
 */
export const resetColorsForHandles = (viewer, lib, entityDataMap, handles) => {
  if (!viewer || !lib || !entityDataMap || !handles || handles.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  handles.forEach((handle) => {
    const ok = resetColorByHandle(viewer, lib, entityDataMap, handle);
    if (ok) successCount++;
    else failCount++;
  });

  viewer.update?.();
  return { successCount, failCount };
};

/**
 * 선택된 핸들을 하이라이트로 표시
 *
 * prevRedHandlesRef: { current: Set<string> }
 */
export const updateRedSelection = (
  viewer,
  lib,
  entityDataMap,
  prevRedHandlesRef,
  nextHandles
) => {
  if (!viewer || !prevRedHandlesRef) {
    return { added: 0, removed: 0 };
  }

  if (!viewer || !lib || !entityDataMap || !prevRedHandlesRef) {
    return { added: 0, removed: 0 };
  }

  const prevSet =
    prevRedHandlesRef.current instanceof Set
      ? prevRedHandlesRef.current
      : (prevRedHandlesRef.current = new Set());

  const nextSet = new Set(nextHandles?.map(String) || []);

  const toReset = [];
  const toRed = [];

  prevSet.forEach((h) => {
    if (!nextSet.has(h)) toReset.push(h);
  });

  nextSet.forEach((h) => {
    if (!prevSet.has(h)) toRed.push(h);
  });

  const RED = { r: 255, g: 0, b: 0 };
  let removed = 0;
  let added = 0;

  toReset.forEach((handle) => {
    const ok = resetColorByHandle(viewer, lib, entityDataMap, handle);
    if (ok) removed++;
  });

  toRed.forEach((handle) => {
    const data = entityDataMap.get(String(handle));
    if (!data || !data.entityId) return;
    setColorBasic(lib, data.entityId, RED);
    added++;
  });

  viewer.update?.();
  prevRedHandlesRef.current = nextSet;
  return { added, removed };
};

/**
 * [TEMP] 패널에서 색상 콤보로 임시 색상 지정/복구
 * option 형식:
 *  - 'restore' : resetColorByHandle로 원래 색 복구
 *  - 'rgb:r,g,b' : 트루컬러 적용
 *  - 'index:N' : 인덱스 컬러 적용
 */
export const applyTempColorOverride = (viewer, lib, entityDataMap, handle, option) => {
  if (!viewer || !lib || !entityDataMap || !handle || !option) return false;

  const data = entityDataMap.get(String(handle));
  if (!data || !data.entityId) return false;

  const setAndUpdate = (color) => {
    setColorBasic(lib, data.entityId, color);
    viewer.update?.();
  };

  if (option === 'restore') {
    const ok = resetColorByHandle(viewer, lib, entityDataMap, handle);
    if (ok) {
      const restored = entityDataMap.get(String(handle));
      if (restored) {
        const oc = restored.originalColor;
        restored.objectColor = oc;
        if (typeof oc === 'number') {
          restored.colorType = 'indexcolor';
          restored.indexColor = oc;
        } else if (!isZeroColor(oc)) {
          restored.colorType = 'rgb';
          restored.indexColor = null;
        } else {
          restored.colorType = 'layercolor';
          restored.indexColor = null;
        }
        restored.lastColorOption = null;
        restored.hasColorChanged = false;
      }
      viewer.update?.();
    }
    return ok;
  }

  if (option === 'restore-initial') {
    const target = data.initialOriginalColor ?? data.originalColor;
    if (target === undefined) return false;
    const applyTarget = (color) => {
      setAndUpdate(color);
      data.objectColor = color;
      if (typeof color === 'number') {
        data.colorType = 'indexcolor';
        data.indexColor = color;
        data.trueColor = null;
      } else if (!isZeroColor(color)) {
        data.colorType = 'rgb';
        data.indexColor = null;
        data.trueColor = color;
      } else {
        data.colorType = 'layercolor';
        data.indexColor = null;
      }
      data.originalColor = color;
      data.lastColorOption = null;
      data.hasColorChanged = false;
    };

    if (Array.isArray(target)) {
      applyTarget(target);
      console.log('[TempColorOverride] restore-initial(array)', { handle: String(handle), target });
      return true;
    }

    applyTarget(target);
    console.log('[TempColorOverride] restore-initial', { handle: String(handle), target });
    return true;
  }

  if (option.startsWith('rgb:')) {
    const parts = option.slice(4).split(',').map((v) => parseInt(v, 10));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const color = { r: parts[0], g: parts[1], b: parts[2] };
      data.objectColor = color;
      data.colorType = 'rgb';
      data.indexColor = null;
      data.trueColor = color;
      data.originalColor = color;
      data.lastColorOption = option;
      data.hasColorChanged = true;
      setAndUpdate(color);
      console.log('[TempColorOverride] rgb', { handle: String(handle), color });
      return true;
    }
  }

  if (option.startsWith('index:')) {
    const idx = parseInt(option.slice(6), 10);
    if (Number.isFinite(idx)) {
      data.objectColor = idx;
      data.colorType = 'indexcolor';
      data.indexColor = idx;
      data.originalColor = idx;
      data.lastColorOption = option;
      data.hasColorChanged = true;
      setAndUpdate(idx);
      console.log('[TempColorOverride] index', { handle: String(handle), index: idx });
      return true;
    }
  }

  return false;
};

// DWG 클래스 이름 → 화면 표시용 타입명 변환
// 예) "AcDbMText" → "MText", "AcDbLine" → "Line"
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
  // 필요하면 대문자 변환
  // return name.toUpperCase();
};
