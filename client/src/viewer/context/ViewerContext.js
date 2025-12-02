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

export const ViewerProvider = ({ children }) => {
  const { loadDocument } = useDocumentLoader();
  const {
    favoriteDocs,
    favoriteEquipments,
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

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const handleFileSelect = useCallback(
    async ({ docId, docVr }) => {
      const loaded = await loadDocument({ docId, docVr });
      if (!loaded) return null;

      setOpenFiles((prev) => {
        const exists = prev.some((f) => f.DOCNO === loaded.DOCNO);
        const next = exists
          ? [loaded, ...prev.filter((f) => f.DOCNO !== loaded.DOCNO)]
          : [loaded, ...prev];
        return next;
      });

      setActiveFileId(loaded.DOCNO);
      setIsFileLoaded(true);
      return loaded;
    },
    [loadDocument]
  );

  const handleTabClick = useCallback((docno) => {
    if (docno) setActiveFileId(docno);
  }, []);

  const handleTabClose = useCallback((docno) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((file) => file.DOCNO !== docno);
      fittedDocsRef.current.delete(docno);
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
  }, []);

  const handleTabReorder = useCallback((newFiles, draggedFileId) => {
    if (Array.isArray(newFiles)) {
      setOpenFiles(newFiles);
    }
    if (draggedFileId) {
      setActiveFileId(draggedFileId);
    }
  }, []);

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
      plantCode: activeFile.PLANTCODE,
    });
  }, [activeFile, toggleDocFavorite]);

  const isActiveDocFavorite = useMemo(() => isDocFavorite(activeFile), [
    activeFile,
    isDocFavorite,
  ]);

  const contextValue = useMemo(
    () => ({
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
    }),
    [
      openFiles,
      activeFileId,
      viewStates,
      isFileLoaded,
      favoriteDocs,
      favoriteEquipments,
      handleFileSelect,
      handleTabClick,
      handleTabClose,
      handleCloseAllTabs,
      handleTabReorder,
      handleViewerReady,
      handleViewStateChange,
      handleToggleFavorite,
      isActiveDocFavorite,
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
