import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDocumentLoader } from '../../components/hooks/useDocumentLoader';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentDocs } from '../../hooks/useRecentDocs';
import { getDocumentEquipment } from '../../services/documentsApi';
import { triggerResize } from '../utils/triggerResize';
import { buildEquipmentModel } from '../../components/utils/equipmentHandles';

const ViewerContext = createContext(null);

const areArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areLayerListsEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const prev = a[i];
    const next = b[i];
    if (!prev || !next) return false;
    if (prev.id !== next.id || prev.count !== next.count) return false;
  }
  return true;
};

const areColorsEqual = (a, b) => {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (
    !Number.isFinite(a.r) ||
    !Number.isFinite(a.g) ||
    !Number.isFinite(a.b) ||
    !Number.isFinite(b.r) ||
    !Number.isFinite(b.g) ||
    !Number.isFinite(b.b)
  ) {
    return false;
  }
  return a.r === b.r && a.g === b.g && a.b === b.b;
};

const parseHandlesFromValue = (value) => {
  if (!value) return [];
  return value
    .split('/')
    .map((handle) => (typeof handle === 'string' ? handle.trim() : ''))
    .filter(Boolean);
};

const summarizeHandleRows = (rows = [], sampleSize = 10) => {
  const collector = new Set();
  rows.forEach((row) => {
    const handles = parseHandlesFromValue(row?.handle);
    handles.forEach((handle) => collector.add(handle));
  });
  const allHandles = Array.from(collector);
  return {
    count: allHandles.length,
    sample: allHandles.slice(0, sampleSize),
  };
};

export const ViewerProvider = ({ children }) => {
  const { loadDocument } = useDocumentLoader();
  const {
    favoriteDocs,
    favoriteEquipments,
    favoriteDocMeta,
    refreshFavorites,
    toggleDocFavorite,
    isDocFavorite,
    toggleEquipmentFavorite,
    isEquipmentFavorite,
  } = useFavorites();
  const {
    recentDocs,
    loading: recentDocsLoading,
    error: recentDocsError,
    refreshRecentDocs,
    logDocumentOpen: logRecentDoc,
  } = useRecentDocs();

  const manualRecentLogRef = useRef(new Set());
  const flagManualRecentLog = useCallback((docId, docVr = '001') => {
    if (!docId) return;
    manualRecentLogRef.current.add(`${docId}-${docVr}`);
  }, []);
  const consumeManualRecentLog = useCallback((docId, docVr = '001') => {
    const key = `${docId}-${docVr}`;
    if (manualRecentLogRef.current.has(key)) {
      manualRecentLogRef.current.delete(key);
      return true;
    }
    return false;
  }, []);

  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewStates, setViewStates] = useState({});
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const fittedDocsRef = useRef(new Set());
  const viewerInstanceRef = useRef(null);
  const [docHighlights, setDocHighlights] = useState({});
  const [tabOrder, setTabOrder] = useState([]);
  const [layerListsByDoc, setLayerListsByDoc] = useState({});
  const [equipmentData, setEquipmentData] = useState([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentError, setEquipmentError] = useState(null);
  const equipmentHighlightCacheRef = useRef({
    manual: new Set(),
    group: new Set(),
  });
  const persistEquipmentHighlight = useCallback((manual = [], group = []) => {
    equipmentHighlightCacheRef.current.manual = new Set(manual);
    equipmentHighlightCacheRef.current.group = new Set(group);
  }, []);
  const readEquipmentHighlightCache = useCallback(() => ({
    manual: new Set(equipmentHighlightCacheRef.current.manual),
    group: new Set(equipmentHighlightCacheRef.current.group),
  }), []);
  const equipmentCacheRef = useRef(new Map());
  const [highlightActionsByDoc, setHighlightActionsByDoc] = useState(() => new Map());
  const moveDocToFront = useCallback((docno) => {
    if (!docno) return;
    setTabOrder((prev) => {
      const filtered = prev.filter((id) => id !== docno);
      return [docno, ...filtered];
    });
  }, []);

  const setLayerListForDoc = useCallback((docKey, layers) => {
    if (!docKey || !Array.isArray(layers)) return;
    setLayerListsByDoc((prev) => {
      const prevList = prev[docKey];
      if (prevList && areLayerListsEqual(prevList, layers)) {
        return prev;
      }
      return {
        ...prev,
        [docKey]: layers,
      };
    });
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    refreshRecentDocs({ limit: 40 });
  }, [refreshRecentDocs]);

  const handleFileSelect = useCallback(
    async ({ docId, docVr }) => {
      const existing = openFiles.find(
        (f) =>
          f.DOCNO === docId &&
          (docVr ? f.DOCVR === docVr : true)
      );
      if (existing) {
        setActiveFileId(existing.DOCNO);
        moveDocToFront(existing.DOCNO);
        return existing;
      }

      if (openFiles.length >= 5) {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('동시 열 수 있는 도면은 최대 5개입니다. 먼저 열려 있는 도면을 닫아주세요.');
        }
        return null;
      }

      const loaded = await loadDocument({ docId, docVr });
      if (!loaded) return null;

      setOpenFiles((prev) => [loaded, ...prev]);

      setActiveFileId(loaded.DOCNO);
      setIsFileLoaded(true);
      moveDocToFront(loaded.DOCNO);
      return loaded;
    },
    [loadDocument, openFiles]
  );

  const handleTabClick = useCallback((docno) => {
    if (docno) setActiveFileId(docno);
  }, []);

  const handleTabClose = useCallback((docno) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((file) => file.DOCNO !== docno);
      fittedDocsRef.current.delete(docno);
      setDocHighlights((prevHighlights) => {
        if (!prevHighlights[docno]) return prevHighlights;
        const next = { ...prevHighlights };
        delete next[docno];
        return next;
      });
      if (activeFileId === docno) {
        setActiveFileId(filtered[0]?.DOCNO || null);
      }
      if (filtered.length === 0) {
        setIsFileLoaded(false);
      }
      return filtered;
    });
    setTabOrder((prev) => prev.filter((id) => id !== docno));
  }, [activeFileId]);

  const handleCloseAllTabs = useCallback(() => {
    setOpenFiles([]);
    setActiveFileId(null);
    setIsFileLoaded(false);
    fittedDocsRef.current = new Set();
    setDocHighlights({});
    setTabOrder([]);
  }, []);

  const handleTabReorder = useCallback((newOrder = [], draggedDocId) => {
    if (!Array.isArray(newOrder) || newOrder.length === 0) return;
    const validDocnos = newOrder.filter((docno) => openFiles.some((file) => file.DOCNO === docno));
    const rest = openFiles
      .map((file) => file.DOCNO)
      .filter((docno) => !validDocnos.includes(docno));
    if (validDocnos.length === 0 && rest.length === 0) return;
    setTabOrder([...validDocnos, ...rest]);
    if (draggedDocId && validDocnos.includes(draggedDocId)) {
      setActiveFileId(draggedDocId);
    }
  }, [openFiles]);

  const setDocHighlight = useCallback((docno, handles = [], options = {}) => {
    if (!docno) return;
    setDocHighlights((prev) => {
      const normalized = Array.isArray(handles)
        ? handles.filter(Boolean).map((h) => String(h))
        : [];
      if (!normalized.length) {
        if (!prev[docno]) return prev;
        const next = { ...prev };
        delete next[docno];
        return next;
      }
      const existing = prev[docno];
      const highlightColorInput = options?.highlightColor;
      const nextHighlightColor =
        highlightColorInput === undefined
          ? existing?.highlightColor ?? null
          : highlightColorInput;

      if (
        existing &&
        areArraysEqual(existing.handles, normalized) &&
        areColorsEqual(existing.highlightColor, nextHighlightColor)
      ) {
        return prev;
      }
      const preview = normalized.slice(0, 10);
      return {
        ...prev,
        [docno]: { handles: normalized, highlightColor: nextHighlightColor },
      };
    });
  }, []);

  const clearDocHighlight = useCallback(
    (docno) => setDocHighlight(docno, []),
    [setDocHighlight]
  );

  const [viewerReadyVersion, setViewerReadyVersion] = useState(0);
  const handleViewerReady = useCallback((viewerInstance) => {
    viewerInstanceRef.current = viewerInstance;
    window.currentViewerInstance = viewerInstance;
    setViewerReadyVersion((prev) => prev + 1);
  }, []);

  const getViewerInstance = useCallback(() => viewerInstanceRef.current, []);

  const handleViewStateChange = useCallback((docno, viewState) => {
    setViewStates((prev) => ({
      ...prev,
      [docno]: { ...viewState, timestamp: Date.now() },
    }));
  }, []);

  const activeFile = useMemo(
    () => openFiles.find((file) => file.DOCNO === activeFileId),
    [activeFileId, openFiles]
  );

  const handleDocumentReady = useCallback(
    (docno, ready) => {
      if (!ready || !docno) return;
      const doc = openFiles.find((file) => file.DOCNO === docno);
      if (!doc) return;
      const docVr = doc.DOCVR || '001';
      if (consumeManualRecentLog(doc.DOCNO, docVr)) {
        return;
      }
      logRecentDoc({
        docId: doc.DOCNO,
        docVr,
        docNumber: doc.DOCNUMBER,
      });
    },
    [consumeManualRecentLog, logRecentDoc, openFiles]
  );

  const getPlantCode = (file) => file?.PLANTCODE || file?.PLANTCD || null;

  const loadEquipmentData = useCallback(
    async (token, options = {}) => {
      const docId = activeFile?.DOCNO;
      const docVr = activeFile?.DOCVR || '001';
      const plantCode = getPlantCode(activeFile);
      const cacheKey = docId ? `${docId}:${docVr}` : null;
      if (!docId || !plantCode || !isFileLoaded || !cacheKey) {
        if (token?.cancelled) return;
        setEquipmentData([]);
        setEquipmentError(null);
        setEquipmentLoading(false);
        return;
      }

      if (!options.force && cacheKey) {
        const cached = equipmentCacheRef.current.get(cacheKey);
        if (cached) {
          if (token?.cancelled) return;
          setEquipmentData(cached.data);
          setEquipmentError(cached.error);
          setEquipmentLoading(false);
          return;
        }
      }

      if (token?.cancelled) return;
      setEquipmentLoading(true);
      setEquipmentError(null);
      try {
        const data = await getDocumentEquipment({
          docId,
          docVr,
          plantCode,
        });
        if (token?.cancelled) return;
        const normalized = Array.isArray(data) ? data : [];
        if (cacheKey) {
          equipmentCacheRef.current.set(cacheKey, { data: normalized, error: null });
        }
        setEquipmentData(normalized);
        setEquipmentError(null);
      } catch (error) {
        if (token?.cancelled) return;
        const errorMessage = error?.message || '설비 목록 조회 실패';
        if (cacheKey) {
          equipmentCacheRef.current.set(cacheKey, { data: [], error: errorMessage });
        }
        setEquipmentData([]);
        setEquipmentError(errorMessage);
      } finally {
        if (token?.cancelled) return;
        setEquipmentLoading(false);
      }
    },
    [
      activeFile?.DOCNO,
      activeFile?.DOCVR,
      activeFile?.PLANTCODE,
      activeFile?.PLANTCD,
      isFileLoaded,
    ]
  );

  useEffect(() => {
    const token = { cancelled: false };
    void loadEquipmentData(token);
    return () => {
      token.cancelled = true;
    };
  }, [loadEquipmentData]);

  const refreshEquipmentData = useCallback(() => {
    const token = { cancelled: false };
    void loadEquipmentData(token, { force: true });
  }, [loadEquipmentData]);

  useEffect(() => {
    if (!isFileLoaded) return;
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;

    const shouldFit = activeFileId && !fittedDocsRef.current.has(activeFileId);
    if (shouldFit && typeof viewer.zoomExtents === 'function') {
      viewer.zoomExtents();
      fittedDocsRef.current.add(activeFileId);
    }
    triggerResize();
    if (typeof viewer.update === 'function') viewer.update();
  }, [activeFileId, isFileLoaded]);

  const handleToggleFavorite = useCallback(async () => {
    if (!activeFile) return;

    await toggleDocFavorite({
      docId: activeFile.DOCNO,
      docVer: activeFile.DOCVR,
      docName: activeFile.DOCNM,
      docNumber: activeFile.DOCNUMBER,
      plantCode: activeFile.PLANTCD || activeFile.PLANTCODE,
    });
  }, [activeFile, toggleDocFavorite]);

  const isActiveDocFavorite = useMemo(() => isDocFavorite(activeFile), [
    activeFile,
    isDocFavorite,
  ]);

  const registerHighlightActions = useCallback((docno, actions = {}) => {
    if (!docno) return;
    setHighlightActionsByDoc((prev) => {
      const next = new Map(prev);
      const hasActions = actions && Object.keys(actions).length > 0;
      if (hasActions) {
        next.set(docno, actions);
      } else {
        next.delete(docno);
      }
      return next;
    });
  }, []);

  const highlightActions = useMemo(() => {
    if (!activeFileId) return {};
    return highlightActionsByDoc.get(activeFileId) || {};
  }, [activeFileId, highlightActionsByDoc]);

  const equipmentHandleModel = useMemo(
    () => buildEquipmentModel(Array.isArray(equipmentData) ? equipmentData : []),
    [equipmentData]
  );

  const contextValue = useMemo(
    () => ({
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      favoriteDocMeta,
      recentDocs,
      recentDocsLoading,
      recentDocsError,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleDocumentReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
      toggleEquipmentFavorite,
      isEquipmentFavorite,
      docHighlights,
      setDocHighlight,
      clearDocHighlight,
      highlightActions,
      registerHighlightActions,
      refreshRecentDocs,
      flagManualRecentLog,
      consumeManualRecentLog,
      logRecentDoc,
      tabOrder,
      layerListsByDoc,
      setLayerListForDoc,
      equipmentData,
      equipmentLoading,
      equipmentError,
      equipmentHandleModel,
      refreshEquipmentData,
      persistEquipmentHighlight,
      readEquipmentHighlightCache,
      getViewerInstance,
      viewerReadyVersion,
    }),
    [
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      favoriteDocMeta,
      recentDocs,
      recentDocsLoading,
      recentDocsError,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleDocumentReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
      toggleEquipmentFavorite,
      isEquipmentFavorite,
      docHighlights,
      setDocHighlight,
      clearDocHighlight,
      highlightActions,
      registerHighlightActions,
      refreshRecentDocs,
      flagManualRecentLog,
      consumeManualRecentLog,
      logRecentDoc,
      tabOrder,
      layerListsByDoc,
      setLayerListForDoc,
      equipmentData,
      equipmentLoading,
      equipmentError,
      equipmentHandleModel,
      refreshEquipmentData,
      persistEquipmentHighlight,
      readEquipmentHighlightCache,
      getViewerInstance,
      viewerReadyVersion,
    ]
  );

  return (
    <ViewerContext.Provider value={contextValue}>
      {children}
    </ViewerContext.Provider>
  );
};

export const useViewer = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewer must be used within a ViewerProvider');
  }
  return context;
};
