/* eslint-env browser */
// client/src/components/viewer/fontUtils.js

// Fix text style font file names to use just the basename, and set big-fonts.
// For SHX fonts, use 'whgtxt.shx' as big-font for proper unicode rendering.
// For other fonts, set the big-font to the provided default (e.g., 'gulim.ttc').
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
      } catch (_) { /* ignore per-style errors */ }

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
        } catch (_) { /* ignore per-style errors */ }
      }

      try { typeof iter.step === 'function' && iter.step(); } catch (_) {}
    }
  } catch (_) { /* ignore top-level errors */ }
}

// Load missing fonts referenced by text styles from a public fonts path,
// embed them into the viewer, and trigger a regen if any were added.
// fontNameSetRef should be a React-like ref object: { current: Set<string> }
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

      const style = styleId && styleId.openObject ? (() => { try { return styleId.openObject(); } catch (_) { return null; } })() : null;
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
        } catch (_) { /* ignore per-style read errors */ }
      }

      try { iter.step?.(); } catch (_) {}
    }

    for (let name of namesToFetch) {
      try {
        const url = (basePath && !basePath.endsWith('/')) ? `${basePath}/${name}` : `${basePath}${name}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();

        // Optional logging hook via window.log, if present
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
        // ignore individual load errors
      }
    }

    if (regenNeeded && typeof viewer.regenAll === 'function') {
      try {
        viewer.regenAll();
      } catch (_) {}
    }
  } catch (_) {
    // ignore top-level errors
  }
}
