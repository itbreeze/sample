// client/src/components/viewer/ViewerCanvas.js
/* eslint-env browser */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  fileCache,
  fetchArrayBufferWithProgress,
  initializeVisualizeJS,
  createViewer,
  fixFonts,
  loadFonts,
  collectSelectedEntities,
  applySelectionColor,
  applyTempColorOverride,
  resetColorByHandle,
  setColorBasic,
  HOVER_SELECTION_COLOR,
  SELECTED_SELECTION_COLOR,
  EQUIPMENT_SELECTION_COLOR,
} from './ViewerCanvasUtils';
import ViewerCanvasToolbar from './ViewerCanvasToolbar';
import { attachCanvasInteractions } from './ViewerCanvasController';
import EntityDetailsPanel, { MIN_WIDTH as PANEL_MIN_WIDTH, MIN_HEIGHT as PANEL_MIN_HEIGHT } from './EntityDetailsPanel';
import EquipmentInfoPanel from '../components/EquipmentInfoPanel';
import CanvasLoadingOverlay from './CanvasLoadingOverlay';
import { useViewer } from '../context/ViewerContext';
import { normalizeHandles } from '../../components/utils/equipmentHandles';

const EquipmentInfoPanelComponent = EquipmentInfoPanel || (() => null);

const VIEWER_MODES = {
  PID: 'ViewerMode',
  PLD: 'PLDMode',
  INTELLIGENT: 'IntelligentMode',
  INHERIT: 'InheritMode',
};

const EQUIPMENT_PANEL_SIZE = { width: 320, height: 360 };

const ViewerCanvas = ({
  filePath,
  docno,
  isActive,
  visible,          // 그대로 두고 싶으면 유지 (없애도 무관)
  onReadyChange,
  canvasId,
  isFavorite,
  onToggleFavorite,
  highlightHandles = [],
  highlightColor,
  allowEntityPanel = true,
  allowEquipmentInfoPanel = true,
  viewerMode = VIEWER_MODES.PID,
}) => { 

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const libRef = useRef(null);
  const isInitializedRef = useRef(false);
  const hasFitRef = useRef(false);
  const resizeObserverRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const zoomTimeoutRef = useRef(null);
  const interactionsCleanupRef = useRef(null);
  const fontNameSetRef = useRef(new Set());
  const entityDataMapRef = useRef(new Map());
  const selectionColorHandlesRef = useRef(new Set());
  const highlightHandlesRef = useRef([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadPercent, setLoadPercent] = useState(0);

  const [selectedHandles, setSelectedHandles] = useState([]);
  const [entities, setEntities] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const currentDocRef = useRef(null);
  const [equipmentInfoEntries, setEquipmentInfoEntries] = useState([]);
  const [showEquipmentInfoPanel, setShowEquipmentInfoPanel] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const hoverColorHandlesRef = useRef(new Set());
  const PANEL_DEFAULT = { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT };
  const selectedHandlesRef = useRef([]);
  const computePanelPosition = (width, height) => {
    const vw = window?.innerWidth || 1200;
    const vh = window?.innerHeight || 800;
    return {
      x: Math.max(8, vw - width - 24),
      y: Math.max(8, vh - height - 40),
    };
  };
  const clampPanelPosition = (position, size) => {
    const vw = window?.innerWidth || 1200;
    const vh = window?.innerHeight || 800;
    const maxX = Math.max(8, vw - size.width - 24);
    const maxY = Math.max(8, vh - size.height - 40);
    return {
      x: Math.min(Math.max(8, position.x), maxX),
      y: Math.min(Math.max(8, position.y), maxY),
    };
  };
  const updateSelectedHandles = useCallback((handles = []) => {
    selectedHandlesRef.current = handles;
    setSelectedHandles(handles);
  }, []);

  const [equipmentPanelPosition, setEquipmentPanelPosition] = useState(() =>
    clampPanelPosition(computePanelPosition(EQUIPMENT_PANEL_SIZE.width, EQUIPMENT_PANEL_SIZE.height), EQUIPMENT_PANEL_SIZE)
  );


  const positionEquipmentPanelNearBounds = useCallback(
    (screenBox) => {
      if (!screenBox || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.left + ((screenBox.x1 + screenBox.x2) / 2);
      const centerY = rect.top + ((screenBox.y1 + screenBox.y2) / 2);
      const offset = 12;
      const target = {
        x: centerX + offset,
        y: centerY + offset,
      };
      setEquipmentPanelPosition(clampPanelPosition(target, EQUIPMENT_PANEL_SIZE));
    },
    [canvasRef]
  );

  const [panelPosition, setPanelPosition] = useState(() => {
    const initial = computePanelPosition(PANEL_DEFAULT.width, PANEL_DEFAULT.height);
    return clampPanelPosition(initial, PANEL_DEFAULT);
  });
  const [panelSize, setPanelSize] = useState(PANEL_DEFAULT);
  const mode = viewerMode || VIEWER_MODES.PID;
  const modeConfig = useMemo(() => ({
    allowDragSelect: mode === VIEWER_MODES.INTELLIGENT,
    enforceEquipmentSelection: mode === VIEWER_MODES.PID,
    allowHoverHighlight: mode === VIEWER_MODES.PID,
  }), [mode]);
  const enableHoverVisuals = modeConfig.allowHoverHighlight;
  const {
    registerHighlightActions,
    openFiles,
    activeFileId,
    equipmentHandleModel,
    handleFileSelect,
  } = useViewer();

  const activeFile = useMemo(
    () => openFiles.find((file) => file.DOCNO === activeFileId),
    [openFiles, activeFileId]
  );

  useEffect(() => {
    currentDocRef.current = activeFile?.DOCNO || null;
  }, [activeFile?.DOCNO]);

  const equipmentTagMap = useMemo(() => {
    const map = new Map();
    const tags = Array.isArray(activeFile?.tags) ? activeFile.tags : [];
    tags.forEach((tag) => {
      const handle = tag.TAGHANDLE;
      if (!handle) return;
      const key = String(handle);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(tag);
    });
    return map;
  }, [activeFile?.tags]);

  const tagHandleGroups = useMemo(() => {
    const map = new Map();
    equipmentTagMap.forEach((tags, handle) => {
      const normalizedHandle = String(handle);
      tags.forEach((tag) => {
        const tagNo = tag?.TAGNO ?? tag?.tagNo ?? '';
        if (!tagNo) return;
        if (!map.has(tagNo)) {
          map.set(tagNo, new Set());
        }
        map.get(tagNo)?.add(normalizedHandle);
      });
    });
    return map;
  }, [equipmentTagMap]);
  const expandHandlesToTagGroup = useCallback(
    (handles = []) => {
      const normalized = Array.isArray(handles)
        ? handles.map((handle) => (handle ? String(handle) : '')).filter(Boolean)
        : [];
      if (!normalized.length) return [];
      const collected = new Set();
      normalized.forEach((handle) => {
        collected.add(handle);
        const tags = equipmentTagMap.get(handle);
        if (!tags?.length) return;
        tags.forEach((tag) => {
          const tagNo = tag?.TAGNO ?? tag?.tagNo ?? '';
          if (!tagNo) return;
          const related = tagHandleGroups.get(tagNo);
          related?.forEach((relatedHandle) => {
            collected.add(relatedHandle);
          });
        });
      });
      return Array.from(collected);
    },
    [equipmentTagMap, tagHandleGroups]
  );

  const buildEquipmentInfoDetails = useCallback(
    (handles = []) => {
      const groupMap = new Map();
      handles.forEach((handle) => {
        const key = String(handle);
        const tagsForHandle = equipmentTagMap.get(key);
        if (!tagsForHandle) return;
        tagsForHandle.forEach((tag) => {
          const tagNo = tag.TAGNO || '기타';
          const func = tag.FUNCTION || '기능 미정';
          const groupKey = `${tagNo}|${func}`;
          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              tagNo,
              func,
              handles: new Set(),
              raw: {
                TAG_TYPE: tag.TAG_TYPE || tag.tagType || 'UNKNOWN',
                LIBDS: tag.LIBDS || tag.libDs || null,
                TAGHANDLE: tag.TAGHANDLE || tag.tagHandle || null,
              },
            });
          }
          groupMap.get(groupKey)?.handles.add(key);
        });
      });
      return Array.from(groupMap.values()).map((group) => ({
        tagNo: group.tagNo,
        func: group.func,
        handles: Array.from(group.handles),
        tagType: group.raw.TAG_TYPE,
        libds: group.raw.LIBDS,
        handleKey: group.raw.TAGHANDLE,
      }));
    },
    [equipmentTagMap]
  );

  const showEquipmentPopup = useCallback(() => {}, []);

  const equipmentHandleSet = useMemo(() => {
    const handles = Array.isArray(equipmentHandleModel?.allHandles) ? equipmentHandleModel.allHandles : [];
    const normalized = normalizeHandles(handles);
    return new Set(normalized);
  }, [equipmentHandleModel]);

  const filterHandlesByEquipment = useCallback(
    (handles = []) => {
      if (!modeConfig.enforceEquipmentSelection) return handles || [];
      if (!Array.isArray(handles) || !handles.length) return [];
      if (!equipmentHandleSet?.size) return [];
      return handles
        .map((handle) => (handle ? String(handle) : ''))
        .filter((handle) => handle && equipmentHandleSet.has(handle));
    },
    [equipmentHandleSet, modeConfig.enforceEquipmentSelection]
  );

  const hoverSuppressedRef = useRef(false);

  const hoverFilter = useCallback(
    (handle) => {
      if (!handle) return false;
      if (!equipmentHandleSet?.size) return false;
      return equipmentHandleSet.has(String(handle));
    },
    [equipmentHandleSet]
  );

  const handleHoverCandidate = useCallback(
    (handle) => {
      if (hoverSuppressedRef.current) return;
      if (!handle) return;
      const key = String(handle);
      const inEquipment = equipmentHandleSet.size ? equipmentHandleSet.has(key) : false;
      const inCache = entityDataMapRef.current.has(key);
    },
    [equipmentHandleSet]
  );

  const ensureEntityRef = useRef(() => null);

  const colorizeHoverHandles = useCallback((handles) => {
    const normalized = Array.isArray(handles)
      ? handles.map((item) => (item ? String(item) : '')).filter(Boolean)
      : [];

    const current = hoverColorHandlesRef.current;
    const nextSet = new Set(normalized);
    const toRemove = [];

    current.forEach((handle) => {
      if (!nextSet.has(handle)) {
        toRemove.push(handle);
      }
    });

    toRemove.forEach((handle) => {
      current.delete(handle);
      const selected = Array.isArray(selectedHandlesRef.current)
        ? selectedHandlesRef.current.includes(handle)
        : false;
      if (selected) {
        const entry = entityDataMapRef.current.get(handle);
        if (entry?.entityId && libRef.current) {
          setColorBasic(libRef.current, entry.entityId, SELECTED_SELECTION_COLOR);
        }
      } else if (viewerRef.current && libRef.current) {
        resetColorByHandle(
          viewerRef.current,
          libRef.current,
          entityDataMapRef.current,
          handle
        );
      }
    });

    normalized.forEach((handle) => {
      if (current.has(handle)) return;
      ensureEntityRef.current(handle);
      const entry = entityDataMapRef.current.get(handle);
      if (!entry?.entityId || !libRef.current) return;
      setColorBasic(libRef.current, entry.entityId, HOVER_SELECTION_COLOR);
      current.add(handle);
    });
  }, []);

  const applyHoverVisuals = useCallback((handle) => {
    const canvas = canvasRef.current;
    if (enableHoverVisuals && canvas) {
      canvas.style.cursor = handle ? 'pointer' : '';
    }
    const handles = handle ? expandHandlesToTagGroup([handle]) : [];
    colorizeHoverHandles(handles);
  }, [colorizeHoverHandles, enableHoverVisuals, expandHandlesToTagGroup]);

  const setHoverSuppressed = useCallback(
    (value = true) => {
      const next = !!value;
      if (hoverSuppressedRef.current === next) return;
      hoverSuppressedRef.current = next;
      if (next) {
        applyHoverVisuals(null);
      }
    },
    [applyHoverVisuals]
  );

  useEffect(() => {
    setHoverSuppressed(!modeConfig.allowHoverHighlight);
  }, [modeConfig.allowHoverHighlight, setHoverSuppressed]);

  const handleHover = useCallback(
    (handle) => {
    if (hoverSuppressedRef.current) return;
    if (!handle) {
      applyHoverVisuals(null);
      return;
    }
    const entry = entityDataMapRef.current.get(String(handle));
    applyHoverVisuals(handle);
  },
  [applyHoverVisuals]
);

  const handleHoverEndColor = useCallback(() => {
    if (hoverSuppressedRef.current) return;
    applyHoverVisuals(null);
  }, [applyHoverVisuals]);

  const clearSelection = useCallback(({ keepHighlight = false } = {}) => {
    applyHoverVisuals(null);
    if (!keepHighlight) {
      applySelectionColor(
        viewerRef.current,
        libRef.current,
        entityDataMapRef.current,
        selectionColorHandlesRef,
        []
      );
    }
    viewerRef.current?.unselect?.();
    viewerRef.current?.update?.();
    updateSelectedHandles([]);
    setEntities([]);
    setShowPanel(false);
    setShowEquipmentInfoPanel(false);
    setEquipmentInfoEntries([]);
  }, [applyHoverVisuals]);
  // 선택 이벤트 처리
  const handleSelect = useCallback(
    (payload) => {
      const additive = !!payload?.additive;
      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }
      const selectionHandles = collectSelectedEntities(
        viewer,
        libRef.current,
        entityDataMapRef,
        true
      );
      const incoming =
        payload?.handles && Array.isArray(payload.handles) && payload.handles.length
          ? payload.handles
          : selectionHandles;

      const filteredIncoming = filterHandlesByEquipment(incoming);
      const groupHandles = expandHandlesToTagGroup(filteredIncoming);
      let handles = groupHandles;
      if (additive) {
        const current = new Set(
          (selectedHandlesRef.current || []).map((h) => (h ? String(h) : ''))
        );
        groupHandles.forEach((h) => {
          if (current.has(h)) {
            current.delete(h); // 토글 group
          } else {
            current.add(h);
          }
        });
        handles = Array.from(current);
      }
      handles = expandHandlesToTagGroup(handles);

      if (!handles || handles.length === 0) {
        const keepHighlight = Boolean(highlightHandlesRef.current?.length);
        clearSelection({ keepHighlight });
        return;
      }

        const applySelectionHandles = (hList) => {
          if (!viewer) return;
          try {
            viewer.unselect?.();
            if (Array.isArray(hList)) {
            hList.forEach((h) => {
              const key = String(h);
              const entry = entityDataMapRef.current.get(key);
              const entityId = entry?.entityId;
              if (entityId) {
                try {
                  viewer.setSelectedEntity?.(entityId);
                } catch (_) { }
              }
            });
          }
          viewer.update?.();
        } catch (_) { }
      };
      applySelectionHandles(handles);
      collectSelectedEntities(viewer, libRef.current, entityDataMapRef, true);
      viewer.unselect?.();
      viewer.update?.();

      const mappedEntities = handles.map((h) => {
        const data = entityDataMapRef.current.get(String(h)) || {};
        const displayColor = (() => {
          if (data.colorType === 'kColor' && data.trueColor) return data.trueColor;
          if (data.colorType === 'kIndexed' && Number.isFinite(data.indexColor)) return data.indexColor;
          if (data.colorType === 'kDefault' && data.trueColor) return data.trueColor;
          if (data.colorType === 'kDefault' && Number.isFinite(data.indexColor)) return data.indexColor;
          return data.objectColor ?? null;
        })();
        return {
          handle: h,
          ...data,
          objectColor: displayColor,
          layerColor: data.layerColor ?? null,
          lastColorOption: data.lastColorOption ?? null,
          initialOriginalColor: data.initialOriginalColor ?? null,
          hasColorChanged: data.hasColorChanged ?? false,
        };
      });

      updateSelectedHandles(handles);
      const selectionColor = payload?.highlightColor ?? SELECTED_SELECTION_COLOR;
      applySelectionColor(
        viewerRef.current,
        libRef.current,
        entityDataMapRef.current,
        selectionColorHandlesRef,
        handles,
        { color: selectionColor }
      );
      setEntities(mappedEntities);
      const shouldOpenPanel = allowEntityPanel && payload?.openPanel !== false;
      setShowPanel(shouldOpenPanel);
        const shouldPopulateEquipmentInfo =
          allowEquipmentInfoPanel &&
          payload?.openPanel !== false;
      if (shouldPopulateEquipmentInfo) {
        const entries = buildEquipmentInfoDetails(handles);
        setEquipmentInfoEntries(entries);
        setShowEquipmentInfoPanel(entries.length > 0);
        if (entries.length > 0) {
          if (payload?.screenBox) {
            positionEquipmentPanelNearBounds(payload.screenBox);
          } else {
            setEquipmentPanelPosition(
              clampPanelPosition(
                computePanelPosition(EQUIPMENT_PANEL_SIZE.width, EQUIPMENT_PANEL_SIZE.height),
                EQUIPMENT_PANEL_SIZE
              )
            );
          }
        }
      } else {
        setShowEquipmentInfoPanel(false);
        setEquipmentInfoEntries([]);
      }
    },
      [
        allowEntityPanel,
        allowEquipmentInfoPanel,
        buildEquipmentInfoDetails,
        clearSelection,
        expandHandlesToTagGroup,
        updateSelectedHandles,
        filterHandlesByEquipment,
        positionEquipmentPanelNearBounds,
        handleFileSelect,
        activeFile?.DOCNO,
        activeFile?.DOCVR,
      ]
    );

  useEffect(() => {
    if (isActive && !isLoading && viewerRef.current) {
      window.currentViewerInstance = viewerRef.current;
      window.currentViewerDocno = docno || null;
      viewerRef.current.update?.();
    }
  }, [isActive, isLoading, docno]);

  const attachInteractions = useCallback(() => {
    const cleanup = attachCanvasInteractions(
      viewerRef.current,
      canvasRef.current,
      libRef.current,
      {
        onSelect: handleSelect,
        cursorColor: isInverted ? '#ffffff' : '#000000',
        hoverFilter,
        onHoverCandidate: handleHoverCandidate,
        onHover: handleHover,
        onHoverEnd: handleHoverEndColor,
        enableDragSelect: modeConfig.allowDragSelect,
      }
    );
    interactionsCleanupRef.current = cleanup;
  }, [handleSelect, handleHoverCandidate, hoverFilter, handleHover, handleHoverEndColor, isInverted, modeConfig.allowDragSelect]);

  const handleSelectRef = useRef(handleSelect);
  useEffect(() => {
    handleSelectRef.current = handleSelect;
  }, [handleSelect]);

  const selectHandlesDirectly = useCallback(
    (handles = [], options = {}) => {
      const normalized = Array.isArray(handles)
        ? handles.map((handle) => (handle ? String(handle) : '')).filter(Boolean)
        : [];
      if (!normalized.length) {
        clearSelection();
        return;
      }
      handleSelectRef.current?.({
        handles: normalized,
        additive: false,
        openPanel: false,
        highlightColor: options.highlightColor,
      });
    },
    [clearSelection]
  );

  const toggleInvert = useCallback(() => {
    setIsInverted((prev) => !prev);
  }, []);

  const runZoomExtents = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.zoomExtents?.();
    viewer.update?.();
  }, []);

  const scheduleZoomExtents = useCallback(
    (delay = 80) => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(runZoomExtents, delay);
    },
    [runZoomExtents]
  );

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!canvas || !viewer || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const newWidth = Math.floor(rect.width * dpr);
    const newHeight = Math.floor(rect.height * dpr);

    if (newWidth > 0 && newHeight > 0 && (canvas.width !== newWidth || canvas.height !== newHeight)) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      viewer.resize?.(0, newWidth, newHeight, 0);
      viewer.update?.();
    }
  }, []);

  /** 초기 로딩 */
  useEffect(() => {

    let isMounted = true;

    const init = async () => {
      try {
        hasFitRef.current = false;
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
        window.currentViewerInstance = viewerInstance;

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

        try {
          await fixFonts(viewerRef.current, 'gulim.ttc', '/fonts');
          await loadFonts(viewerRef.current, fontNameSetRef, '/fonts');
        } catch (e) { }

        setLoadPercent(95);
        viewerRef.current.zoomExtents?.();
        viewerRef.current.update?.();

        isInitializedRef.current = true;
        setLoadPercent(100);
        setIsLoading(false);        
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message);
          setIsLoading(false);
        }
      } 
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  // visible 대신 isActive만 써도 되는 구조로 바꿀 수 있음
  useEffect(() => {
    if (isInitializedRef.current && !isLoading) {
      if (isActive) {
        if (interactionsCleanupRef.current) interactionsCleanupRef.current();
        attachInteractions();
      } else if (interactionsCleanupRef.current) {
        interactionsCleanupRef.current();
        interactionsCleanupRef.current = null;
      }
    }
  }, [isActive, isLoading, attachInteractions]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = requestAnimationFrame(() => {
        if (viewerRef.current) handleResize();
        resizeFrameRef.current = null;
      });
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;
    handleResize();
    return () => {
      if (interactionsCleanupRef.current) interactionsCleanupRef.current();
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      if (viewerRef.current) viewerRef.current.destroy?.();
    };
  }, [handleResize]);

  useEffect(() => {
    const handleWindowResize = () => {
      setPanelPosition((prev) => clampPanelPosition(prev, panelSize));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [panelSize]);

  useEffect(() => {
    setPanelPosition((prev) => clampPanelPosition(prev, panelSize));
  }, [panelSize]);

  useEffect(() => {
    const base = computePanelPosition(panelSize.width, panelSize.height);
    setPanelPosition(clampPanelPosition(base, panelSize));
  }, [docno]);

  useEffect(() => {
    if (typeof onReadyChange === 'function') {
      onReadyChange(docno, !isLoading);
    }
  }, [docno, isLoading, onReadyChange]);

  const zoomFactor = 0.2;

  useEffect(() => {
    if (!isLoading && isActive && !hasFitRef.current) {
      hasFitRef.current = true;
      scheduleZoomExtents(120);
    }
  }, [isActive, isLoading, scheduleZoomExtents]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isActive, isLoading, clearSelection]);

  useEffect(() => {
    if (!allowEquipmentInfoPanel) {
      setShowEquipmentInfoPanel(false);
      setEquipmentInfoEntries([]);
    }
  }, [allowEquipmentInfoPanel]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handles = Array.isArray(highlightHandles)
      ? highlightHandles.map((h) => String(h)).filter(Boolean)
      : [];
    highlightHandlesRef.current = handles;

    if (!handles.length) {
      clearSelection();
      viewer.unselect?.();
      viewer.update?.();
      return;
    }

    try {
      viewer.unselect?.();
      handles.forEach((handle) => {
        const entry = entityDataMapRef.current.get(handle);
        const entityId = entry?.entityId;
        if (!entityId) return;
        try {
          viewer.setSelectedEntity?.(entityId);
        } catch (err) {
          console.warn('[ViewerCanvas] setSelectedEntity failed', handle, err);
        }
      });
      viewer.update?.();
      handleSelectRef.current?.({
        handles,
        additive: false,
        openPanel: false,
        highlightColor,
      });
    } catch (err) {
      console.warn('[ViewerCanvas] highlight fail', err);
    }
  }, [highlightHandles, highlightColor, isActive, isLoading, clearSelection]);

  const setSelectionHandles = useCallback((handles = []) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.unselect?.();
    handles.forEach((handle) => {
      try {
        const entry = entityDataMapRef.current.get(String(handle));
        const entityId = entry?.entityId;
        if (entityId) {
          viewer.setSelectedEntity?.(entityId);
        } else {
          viewer.setSelectedEntity?.(handle);
        }
      } catch (_) { }
    });
    viewer.update?.();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onNonLeftDown = (event) => {
      if (event.button === 1 || event.button === 2) {
        clearSelection();
      }
    };
    canvas.addEventListener('mousedown', onNonLeftDown);
    return () => {
      canvas.removeEventListener('mousedown', onNonLeftDown);
    };
  }, [clearSelection]);

  const forcePopulateEntityCache = useCallback(() => {
    const viewer = viewerRef.current;
    const canvas = canvasRef.current;
    const libInstance = libRef.current;
    if (!viewer || !canvas || !libInstance) return;

    const prevHandles = Array.isArray(selectedHandlesRef.current)
      ? [...selectedHandlesRef.current]
      : [];

    viewer.unselect?.();
    const width = canvas.width || canvas.clientWidth || 0;
    const height = canvas.height || canvas.clientHeight || 0;
    if (width && height) {
      viewer.select?.(0, 0, width, height);
      collectSelectedEntities(viewer, libInstance, entityDataMapRef, true);
    }
    if (prevHandles.length) {
      setSelectionHandles(prevHandles);
    } else {
      viewer.unselect?.();
    }
    viewer.update?.();
  }, [setSelectionHandles]);


  const ensureEntityForHandle = useCallback(
    (handle, options = {}) => {
      if (!handle) return null;
      const key = String(handle);
      const callDoc = currentDocRef.current;
      if (callDoc && callDoc !== activeFile?.DOCNO) {
        console.log(
          '[ViewerCanvas] ensureEntityForHandle skipped stale doc',
          key,
          callDoc,
          activeFile?.DOCNO
        );
        return null;
      }
      let entry = entityDataMapRef.current.get(key);
      if (entry?.entityId) {
        return entry.entityId;
      }

      const viewer = viewerRef.current;
      const libInstance = libRef.current;
      if (!viewer || !libInstance) {
        console.warn(
          '[ViewerCanvas] ensureEntityForHandle missing viewer/lib',
          key,
          activeFile?.DOCNO,
          activeFile?.DOCNUMBER
        );
        return null;
      }

      const prevHandles = Array.isArray(selectedHandlesRef.current) ? [...selectedHandlesRef.current] : [];

      setSelectionHandles([key]);
      collectSelectedEntities(viewer, libInstance, entityDataMapRef, true, options);

      if (prevHandles.length) {
        setSelectionHandles(prevHandles);
      } else {
        viewer.unselect?.();
        viewer.update?.();
      }

      entry = entityDataMapRef.current.get(key);
      if (!entry?.entityId) {
        forcePopulateEntityCache();
        entry = entityDataMapRef.current.get(key);
      }
      if (!entry?.entityId) {
        // do nothing when handle is missing
      }
      return entry?.entityId || null;
    },
    [setSelectionHandles, forcePopulateEntityCache, activeFile?.DOCNO, activeFile?.DOCNUMBER]
  );

  useEffect(() => {
    ensureEntityRef.current = ensureEntityForHandle;
  }, [ensureEntityForHandle]);

  const prepareHandles = useCallback(
    (handles = [], options = {}) => {
      const normalized = Array.isArray(handles)
        ? handles.map((handle) => (handle ? String(handle) : '')).filter(Boolean)
        : [];
      if (!normalized.length) {
        return Promise.resolve({ resolved: [], missing: [] });
      }

      const chunkSize = Math.max(1, options.chunkSize || 16);
      const shouldYield = options.shouldYield !== false;

      const waitForIdle = () =>
        new Promise((resolve) => {
          if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => resolve(), { timeout: 50 });
          } else {
            setTimeout(resolve, 16);
          }
        });

      const processChunk = async (start = 0) => {
        if (start >= normalized.length) {
          return;
        }
        if (!viewerRef.current || !libRef.current) return;
        const end = Math.min(normalized.length, start + chunkSize);
        for (let idx = start; idx < end; idx += 1) {
          ensureEntityForHandle(normalized[idx], { allowedHandleSet: equipmentHandleSet });
        }
        if (end >= normalized.length) return;
        if (shouldYield) await waitForIdle();
        return processChunk(end);
      };

      const run = async () => {
        await processChunk(0);
        const resolved = [];
        const missing = [];
        normalized.forEach((handle) => {
          const entry = entityDataMapRef.current.get(handle);
          if (entry?.entityId) {
            resolved.push(handle);
          } else {
            missing.push(handle);
          }
        });
        return { resolved, missing };
      };

      return run();
    },
    [ensureEntityForHandle, equipmentHandleSet]
  );

  const handleZoomToEntity = useCallback(
    (handle) => {
      const viewer = viewerRef.current;
      const canvas = canvasRef.current;
      if (!viewer || !handle || !canvas) return;
      currentDocRef.current = activeFile?.DOCNO || null;
      const entity = ensureEntityForHandle(handle);
      if (!entity) return;
      viewer.zoomToEntity?.(entity);
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      viewer.zoomAt?.(zoomFactor, centerX, centerY);
      viewer.update?.();
    },
    [zoomFactor, activeFile?.DOCNO]
  );

  const handleZoomToHandles = useCallback(
    (handles = []) => {
      const normalized = Array.isArray(handles)
        ? handles.map((handle) => (handle ? String(handle) : '')).filter(Boolean)
        : [];
      if (!normalized.length) return;
      currentDocRef.current = activeFile?.DOCNO || null;
      normalized.forEach((handle) => {
        ensureEntityRef.current?.(handle);
      });

      const entries = normalized
        .map((handle) => {
          const entry = entityDataMapRef.current.get(handle);
          if (!entry?.entityId) return null;
          const extents =
            typeof entry.entityId.getExtents === 'function'
              ? entry.entityId.getExtents()
              : null;
          if (!extents) return null;
          const minPoint = extents.getMinPoint?.();
          const maxPoint = extents.getMaxPoint?.();
          if (!minPoint || !maxPoint) return null;
          return {
            handle,
            entry,
            min: minPoint,
            max: maxPoint,
            center: {
              x: (minPoint.x + maxPoint.x) / 2,
              y: (minPoint.y + maxPoint.y) / 2,
              z: (minPoint.z + maxPoint.z) / 2,
            },
          };
        })
        .filter(Boolean);

      if (!entries.length) return;

      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      entries.forEach(({ min, max }) => {
        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
      });

      if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return;

      const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      };

      const viewer = viewerRef.current;
      if (!viewer) return;

      let bestEntry = entries[0];
      let bestDist = Number.POSITIVE_INFINITY;
      entries.forEach(({ entry, center: entryCenter }) => {
        const dx = entryCenter.x - center.x;
        const dy = entryCenter.y - center.y;
        const dz = entryCenter.z - center.z;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          bestEntry = { entry, center: entryCenter };
        }
      });

      viewer.zoomToEntity?.(bestEntry.entry.entityId);
      viewer.update?.();
    },
    [activeFile?.DOCNO]
  );

  const handleColorOverride = useCallback((handle, option) => {
    if (!handle || !option) return;
    const ok = applyTempColorOverride(
      viewerRef.current,
      libRef.current,
      entityDataMapRef.current,
      handle,
      option
    );
    if (ok) {
      const dataMap = entityDataMapRef.current;
      setEntities((prev) =>
        prev.map((ent) => {
          if (String(ent.handle) !== String(handle)) return ent;
          const updated = dataMap?.get(String(handle));
          return {
            ...ent,
            objectColor: updated?.objectColor ?? ent.objectColor,
            colorType: updated?.colorType ?? ent.colorType,
            indexColor: updated?.indexColor ?? ent.indexColor,
            originalColor: updated?.originalColor ?? ent.originalColor,
            initialOriginalColor: updated?.initialOriginalColor ?? ent.initialOriginalColor,
            lastColorOption: updated?.lastColorOption ?? ent.lastColorOption,
            hasColorChanged: updated?.hasColorChanged ?? ent.hasColorChanged,
          };
        })
      );
    }
  }, []);


  useEffect(() => {
    if (typeof registerHighlightActions !== 'function' || !docno) return undefined;
    registerHighlightActions(docno, {
      zoomToHandle: handleZoomToEntity,
      zoomToHandles: handleZoomToHandles,
      colorOverride: handleColorOverride,
      prepareHandles,
      selectHandles: selectHandlesDirectly,
      setHoverSuppressed,
    });
    return () => registerHighlightActions(docno, {});
  }, [
    docno,
    handleZoomToEntity,
    handleZoomToHandles,
    handleColorOverride,
    prepareHandles,
    registerHighlightActions,
    selectHandlesDirectly,
    setHoverSuppressed,
  ]);

  useEffect(() => {
    if (!allowEntityPanel) {
      setShowPanel(false);
    }
  }, [allowEntityPanel]);

  const visibleStyle = { opacity: isLoading ? 0.35 : 1 };
  const invertStyle = isInverted ? { filter: 'invert(1)' } : {};
  const overlayVisible = Boolean(isLoading);
  const overlayText = '도면을 불러오는 중입니다...';

  return (
    <div
      ref={containerRef}
      className="viewer-app-container"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
    >
      <CanvasLoadingOverlay
        visible={overlayVisible}
        percent={loadPercent}
        text={overlayText}
      />
      <div className="viewer-canvas-container" style={{ flex: 1, position: 'relative', ...visibleStyle, ...invertStyle }}>
        <canvas
          ref={canvasRef}
          id={canvasId || `canvas-${docno}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {isActive && (
        <ViewerCanvasToolbar
          onToggleInvert={toggleInvert}
          isInverted={isInverted}
          onZoomExtents={runZoomExtents}
          onOpenPanel={allowEntityPanel ? () => setShowPanel((prev) => !prev) : undefined}
          isInfoActive={showPanel}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          showEntityInfoButton={allowEntityPanel}
        />
        )}

        {errorMessage && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.9)',
              padding: '12px 16px',
              borderRadius: '8px',
              color: 'red',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

  {showPanel && (
  <EntityDetailsPanel
    entities={entities}
    onClose={() => setShowPanel(false)}
    initialPosition={panelPosition}
    onPositionChange={(pos) => setPanelPosition(clampPanelPosition(pos, panelSize))}
    initialSize={panelSize}
    onSizeChange={(size) => {
      setPanelSize(size);
      setPanelPosition((prev) => clampPanelPosition(prev, size));
    }}
          resolveEntityColorDetails={(entityId) => {
            const entry = entityDataMapRef.current?.get(String(entityId)) || null;
            if (!entry) return null;
            return {
              objectColor: entry.originalColor || null,
              layer: entry.layer || null,
              type: entry.type || null,
            };
          }}
      onZoomToEntity={handleZoomToEntity}
      onColorOverride={handleColorOverride}
          onToggleInvert={toggleInvert}
          isInverted={isInverted}
          onRestoreOriginal={() => {
            const handles = selectedHandles || [];
            handles.forEach((h) => {
              applyTempColorOverride(
                viewerRef.current,
                libRef.current,
                entityDataMapRef.current,
                h,
                'restore-initial'
              );
            });
            setEntities((prev) =>
              prev.map((ent) => {
                if (!handles.includes(ent.handle)) return ent;
                const data = entityDataMapRef.current.get(String(ent.handle));
                if (!data) return ent;
                return {
                  ...ent,
                  objectColor: data.objectColor ?? data.originalColor ?? ent.objectColor,
                  colorType: data.colorType ?? ent.colorType,
                  indexColor: data.indexColor ?? ent.indexColor,
                  originalColor: data.originalColor ?? ent.originalColor,
                  lastColorOption: data.lastColorOption ?? null,
                };
              })
            );
          }}
        />
      )}
        {allowEquipmentInfoPanel && (
          <EquipmentInfoPanelComponent
            entries={equipmentInfoEntries}
            visible={showEquipmentInfoPanel}
            position={equipmentPanelPosition}
            onClose={() => setShowEquipmentInfoPanel(false)}
          />
        )}
    </div>
  );
};

export default ViewerCanvas;
