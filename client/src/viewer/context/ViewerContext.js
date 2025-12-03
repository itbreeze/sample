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
import { triggerResize } from '../utils/triggerResize';

const ViewerContext = createContext(null);

const areArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
  } = useFavorites();

  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewStates, setViewStates] = useState({});
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const fittedDocsRef = useRef(new Set());
  const viewerInstanceRef = useRef(null);
  const [docHighlights, setDocHighlights] = useState({});
  const [highlightActions, setHighlightActions] = useState({});

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const handleFileSelect = useCallback(
    async ({ docId, docVr }) => {
      const existing = openFiles.find(
        (f) =>
          f.DOCNO === docId &&
          (docVr ? f.DOCVR === docVr : true)
      );
      if (existing) {
        setActiveFileId(existing.DOCNO);
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
  }, [activeFileId]);

  const handleCloseAllTabs = useCallback(() => {
    setOpenFiles([]);
    setActiveFileId(null);
    setIsFileLoaded(false);
    fittedDocsRef.current = new Set();
    setDocHighlights({});
  }, []);

  const handleTabReorder = useCallback((newFiles, draggedFileId) => {
    if (Array.isArray(newFiles)) {
      setOpenFiles(newFiles);
    }
    if (draggedFileId) {
      setActiveFileId(draggedFileId);
    }
  }, []);

  const setDocHighlight = useCallback((docno, handles = []) => {
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
      if (prev[docno] && areArraysEqual(prev[docno].handles, normalized)) {
        return prev;
      }
      return {
        ...prev,
        [docno]: { handles: normalized },
      };
    });
  }, []);

  const clearDocHighlight = useCallback(
    (docno) => setDocHighlight(docno, []),
    [setDocHighlight]
  );

  const handleViewerReady = useCallback((viewerInstance) => {
    viewerInstanceRef.current = viewerInstance;
    window.currentViewerInstance = viewerInstance;
  }, []);

  const handleViewStateChange = useCallback((docno, viewState) => {
    setViewStates((prev) => ({
      ...prev,
      [docno]: { ...viewState, timestamp: Date.now() },
    }));
  }, []);

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

  const activeFile = useMemo(
    () => openFiles.find((file) => file.DOCNO === activeFileId),
    [activeFileId, openFiles]
  );

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

  const registerHighlightActions = useCallback((actions = {}) => {
    setHighlightActions(actions);
  }, []);

  const contextValue = useMemo(
    () => ({
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      favoriteDocMeta,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
      docHighlights,
      setDocHighlight,
      clearDocHighlight,
      highlightActions,
      registerHighlightActions,
    }),
    [
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      favoriteDocMeta,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
      docHighlights,
      setDocHighlight,
      clearDocHighlight,
      highlightActions,
      registerHighlightActions,
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
