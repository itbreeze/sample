import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './EpnidSystemPage.css';
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText, History } from 'lucide-react';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import MainView from '../components/MainView';
import { Panel } from '../components/utils/Panel';
import DrawingList from '../components/DrawingList';
import ResizablePanel from '../components/ResizablePanel';
import { useDocumentTree } from '../components/hooks/useDocumentTree';
import { useDocumentLoader } from '../components/hooks/useDocumentLoader';
import SearchResultList from '../components/Search/SearchResultList';
import { persistPlantContext } from '../services/api';
import FavoriteDocsPanel from '../components/FavoriteDocsPanel';
import { useAuthState } from '../hooks/useAuthState';
import { useFavorites } from '../hooks/useFavorites';
import { usePanelState } from '../hooks/usePanelState';






const DEFAULT_EXPAND_LEVEL = 0;


const findPathToNode = (nodes, nodeId, path = []) => {
  for (const node of nodes) {
    const newPath = [...path, node.ID];
    if (node.ID === nodeId) return newPath;
    if (node.CHILDREN) {
      const result = findPathToNode(node.CHILDREN, nodeId, newPath);
      if (result.length) return result;
    }
  }
  return [];
};

const collectIdsToLevel = (nodes, maxLevel, currentLevel = 0) => {
  if (currentLevel > maxLevel) return [];
  let ids = [];
  for (const node of nodes) {
    if (node.TYPE === 'FOLDER' && node.CHILDREN && node.CHILDREN.length > 0) {
      ids.push(node.ID);
      ids = ids.concat(collectIdsToLevel(node.CHILDREN, maxLevel, currentLevel + 1));
    }
  }
  return ids;
};

const triggerResize = () => {
  window.dispatchEvent(new Event('resize'));
};

const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'pld', label: 'PLD' },
  { id: 'intelligent', label: '지능화', requiresAuth: true },
  { id: 'inherit', label: '지능화 승계', requiresAuth: true },
];

const sidebarMenus = {
  drawing: [
    { id: 'search', icon: <Search size={20} />, label: '도면검색' },
    { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기 목록' },
    { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서함' },
    { id: 'recentdocs', icon: <History size={20} />, label: '최근 본 도면' },
    { id: 'equipments', icon: <Settings size={20} />, label: '설비 목록' },
    { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '배관 목록' },
    { id: 'layers', icon: <Layers size={20} />, label: '레이어 목록' },
  ],
  pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD 메뉴' }],
  intelligent: [{ id: 'intelligent', icon: <FileText size={20} />, label: '샘플 메뉴' }],
  inherit: [{ id: 'inherit', icon: <FileText size={20} />, label: '샘플 메뉴' }],
};

const NotImplemented = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>🚧 해당 기능은 아직 준비되지 않았습니다.</div>
);

const equipmentTabs = [
  { id: 'equipmentList', label: '설비목록', content: () => <NotImplemented /> },
  { id: 'searchEquipment', label: '설비 상세검색', content: () => <NotImplemented /> },
];

function EpnidSystemPage() {
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewStates, setViewStates] = useState({});
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const tabSwitchTimeoutRef = useRef(null);
  const currentViewerInstanceRef = useRef(null);
  const [activeSearchTab, setActiveSearchTab] = useState('documentList');
  const [isDefaultExpandApplied, setIsDefaultExpandApplied] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [advancedSearchConditions, setAdvancedSearchConditions] = useState({
    leafNodeIds: 'ALL',
    drawingNumber: '',
    drawingName: '',
    additionalConditions: [],
    selectedPath: '',
    infoNode: null,
  });
  const [advancedSearchResults, setAdvancedSearchResults] = useState([]);
  const [advancedSearchHighlight, setAdvancedSearchHighlight] = useState('');

  const [previewResultCount, setPreviewResultCount] = useState(0);
  const fittedDocsRef = useRef(new Set());

  const {
    user,
    loading,
    authError,
    limitedAuth: authLimited,
    setUser,
    setAuthError,
  } = useAuthState();
  const isAuthorized = !!user && !authError;
  const { documentTree, loading: documentsLoading, error: documentError } =
    useDocumentTree(isAuthorized);
  const { loadDocument } = useDocumentLoader();
  const {
    favoriteDocs,
    favoriteEquipments,
    refreshFavorites,
    toggleDocFavorite,
    isDocFavorite,
  } = useFavorites();
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    activeMenuItem,
    setActiveMenuItem,
    isPanelMaximized,
    setIsPanelMaximized,
    isPanelOpen,
    openPanel,
    closePanel,
  } = usePanelState({ onBookmarkOpen: refreshFavorites });

  const filteredTabItems = authLimited
    ? tabItems.filter(t => !t.requiresAuth)
    : tabItems;

  const activeFile = openFiles.find(f => f.DOCNO === activeFileId);   
  const isActiveDocFavorite = isDocFavorite(activeFile);
  const handleToggleFavorite = async () => {
    if (!activeFile) return;

    try {
      await toggleDocFavorite({
        docId: activeFile.DOCNO,
        docVer: activeFile.DOCVR,
        docName: activeFile.DOCNM,
        docNumber: activeFile.DOCNUMBER,
        plantCode: activeFile.PLANTCODE,
      });
    } catch (err) {
      console.error('즐겨찾기 토글 실패:', err);
      alert('즐겨찾기 처리 중 오류가 발생했습니다.');
    }
  };


  // 상세검색 탭에서 벗어날 때 자동 재검색 트리거를 초기화하여 재입장 시 불필요한 재검색을 막음
  useEffect(() => {
    if (activeMenuItem !== 'search' || activeSearchTab !== 'searchDrawing') {
      setSearchTrigger(0);
    }
  }, [activeMenuItem, activeSearchTab]);

  useEffect(() => {
    if (authLimited && filteredTabItems.every(t => t.id !== activeTab)) {
      setActiveTab(filteredTabItems[0]?.id || tabItems[0].id);
    }
  }, [authLimited, activeTab, filteredTabItems]);

  useEffect(() => {
    if (!documentError) return;
    if (documentError?.response?.status === 401) {
      setAuthError('세션이 만료되었습니다. Mockup-ECM에서 다시 로그인해주세요.');
      setUser(null);
      persistPlantContext(null);
    }
  }, [documentError, setAuthError, setUser]);

  const isFullscreen = () =>
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

  const requestFs = async () => {
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) await req.call(el);
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  const exitFs = async () => {
    try {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) await exit.call(document);
    } catch (e) {
      console.warn('Exit fullscreen failed:', e);
    }
  };

  const handleLogoClick = async () => {
    if (isFullscreen()) await exitFs();
    else await requestFs();
    closePanel();
  };

  const handleMainViewClick = (e) => {
    if (e.target.closest('.view-tab')) return;
    closePanel();
  };

  const handleViewStateChange = useCallback((docno, viewState) => {
    setViewStates(prev => ({ ...prev, [docno]: { ...viewState, timestamp: Date.now() } }));
  }, []);

  const handleFileSelect = useCallback(
    async (fileIdentifier, fromSearchBar = false) => {
      const loadedFile = await loadDocument(fileIdentifier);
      if (!loadedFile) return;

      setOpenFiles(prev => {
        const exists = prev.some(f => f.DOCNO === loadedFile.DOCNO);
        return exists ? [loadedFile, ...prev.filter(f => f.DOCNO !== loadedFile.DOCNO)] : [loadedFile, ...prev];
      });
      setActiveFileId(loadedFile.DOCNO);
      setIsFileLoaded(true);

      if (fromSearchBar) {
        closePanel();
        setIsPanelMaximized(false);
      }
    },
    [loadDocument]
  );

  const handleTabClick = useCallback((docno) => {
    if (docno !== activeFileId) setActiveFileId(docno);
  }, [activeFileId]);

  const handleTabClose = (docnoToClose) => {
    const next = openFiles.filter(f => f.DOCNO !== docnoToClose);
    fittedDocsRef.current.delete(docnoToClose);
    setOpenFiles(next);
    if (activeFileId === docnoToClose) {
      setActiveFileId(next.length ? next[0].DOCNO : null);
      if (!next.length) setIsFileLoaded(false);
    }
  };

  const handleCloseAllTabs = useCallback(() => {
    setOpenFiles([]);
    setActiveFileId(null);
    setIsFileLoaded(false);
    fittedDocsRef.current = new Set();
  }, []);

  const handleTabReorder = (newFiles, draggedFileId) => {
    setOpenFiles(newFiles);
    setActiveFileId(draggedFileId);
  };

  const handleViewerReady = useCallback((viewerInstance) => {
    currentViewerInstanceRef.current = viewerInstance;
    window.currentViewerInstance = viewerInstance;
  }, []);

  const handleNodeToggle = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const handleCollapseAll = useCallback(() => {
    if (documentTree && documentTree.length) {
      const defaults = collectIdsToLevel(documentTree, DEFAULT_EXPAND_LEVEL);
      setExpandedNodes(new Set(defaults));
    } else {
      setExpandedNodes(new Set());
    }
  }, [documentTree]);

  useEffect(() => {
    closePanel();
  }, [activeTab, closePanel]);

  useEffect(() => {
    if (documentTree.length && activeFileId) {
      const path = findPathToNode(documentTree, activeFileId);
      if (path.length) setExpandedNodes(new Set(path.slice(0, -1)));
    }
  }, [activeFileId, documentTree]);

  useEffect(() => {
    if (documentTree.length && !isDefaultExpandApplied) {
      const defaults = collectIdsToLevel(documentTree, DEFAULT_EXPAND_LEVEL);
      setExpandedNodes(new Set(defaults));
      setIsDefaultExpandApplied(true);
    }
  }, [documentTree, isDefaultExpandApplied]);

  // 패널(사이드 메뉴) 열림/닫힘 로그
  useEffect(() => {
  }, [isPanelOpen, activeMenuItem]);

  useEffect(() => {
    if (!isFileLoaded) return;

    const shouldFitForNewFile = activeFileId && !fittedDocsRef.current.has(activeFileId);
    if (shouldFitForNewFile) {
      fittedDocsRef.current.add(activeFileId);
    }

    const runUpdate = (doFit) => {
      triggerResize();
      const viewer = window.currentViewerInstance;
      if (!viewer) return;
      const viewerDocno = window.currentViewerDocno;
      if (!viewerDocno) return; // 활성 뷰어가 없으면 건너뜀
      if (doFit) viewer.zoomExtents?.();
      viewer.update?.();
    };

    runUpdate(shouldFitForNewFile);
  }, [isFileLoaded, activeFileId]);

  // ===============================
  //  새 창에서 docno + docvr 자동 로딩
  // ===============================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDocno = params.get('docno');
    const urlDocvr = params.get('docvr');
    if (!urlDocno || !urlDocvr) return;

    // 1) 우선 도면 자동 로딩
    (async () => {
      try {
        await handleFileSelect({ docId: urlDocno, docVr: urlDocvr });
      } catch (err) {
        console.error("URL 기반 도면 자동 로딩 실패:", err);
      }
    })();

    // 2) 주소창에서 ?docno=...&docvr=... 제거 (SPA 상태 유지)
    const cleanPath = window.location.pathname.replace(/\/$/, "");
    const cleanUrl = `${window.location.origin}${cleanPath}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, [handleFileSelect]);



  useEffect(() => {
    return () => tabSwitchTimeoutRef.current && clearTimeout(tabSwitchTimeoutRef.current);
  }, []);

  const searchTabs = useMemo(
    () => [
      {
        id: 'documentList',
        label: '전체 도면 목록',
        content: (filter) => (
          <DrawingList
            filter={filter}
            onFileSelect={(node) =>
              handleFileSelect({ docId: node.ID, docVr: node.DOCVR })
            }
            tree={documentTree}
            loading={documentsLoading}
            activeFileId={activeFileId}
            expandedNodes={expandedNodes}
            onNodeToggle={handleNodeToggle}
          />
        ),
      },
      {
        id: 'searchDrawing',
        label: '도면 상세검색',
        content: () => (
          <SearchResultList
            conditions={advancedSearchConditions}
            results={advancedSearchResults}
            highlightTerm={advancedSearchHighlight}
            onConditionsChange={setAdvancedSearchConditions}
            onResultsChange={setAdvancedSearchResults}
            onHighlightChange={setAdvancedSearchHighlight}
            onFileSelect={handleFileSelect}
            searchTrigger={searchTrigger}
          />
        ),
      },
      { id: 'searchEquipment', label: '설비 상세검색', content: () => <NotImplemented /> },
    ],
    [
      documentTree,
      documentsLoading,
      activeFileId,
      expandedNodes,
      handleNodeToggle,
      handleFileSelect,
      advancedSearchConditions,
      advancedSearchResults,
      advancedSearchHighlight,
      searchTrigger,
    ]
  );

  const PANEL_CONFIG = useMemo(
    () => ({
      search: {
        component: (
          <Panel
            tabs={searchTabs}
            activeTab={activeSearchTab}
            onTabChange={setActiveSearchTab}
            defaultTab="documentList"
            onCollapseAll={handleCollapseAll}
            showFilterTabs={['documentList']}
          />
        ),
        startsMaximized: true,
        isResizable: true,
      },
      equipments: {
        component: <Panel tabs={equipmentTabs} defaultTab="equipmentList" />,
        startsMaximized: true,
        isResizable: true,
      },
      bookmark: {
        component: (
          <Panel
            tabs={[
              {
                id: 'favoriteDocs',
                label: '즐겨찾기 목록',
                content: () => (
                  <FavoriteDocsPanel
                    documentItems={favoriteDocs}
                    equipmentItems={favoriteEquipments}
                    onFileSelect={(doc) =>
                      handleFileSelect({ docId: doc.docId || doc.docNO, docVr: doc.docVer })
                    }
                  />
                ),
              },
            ]}
            defaultTab="favoriteDocs"
          />
        ),
        startsMaximized: true,
        isResizable: true,
      },
      mydocs: { component: <NotImplemented />, startsMaximized: false, isResizable: true },
      recentdocs: { component: <NotImplemented />, startsMaximized: true, isResizable: true },
      pipeLayers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
      layers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
    }),
    [
      searchTabs,
      activeSearchTab,
      handleCollapseAll,
      favoriteDocs,
      favoriteEquipments,
      handleFileSelect,
      setActiveSearchTab,
    ]
  );

  const activePanelConfig = PANEL_CONFIG[activeMenuItem];

  const handleMenuClick = useCallback(
    (menuId) => {
      const config = PANEL_CONFIG[menuId];
      openPanel(menuId, config);
    },
    [openPanel, PANEL_CONFIG]
  );

  const handleViewAllSearch = useCallback(
    (searchTerm) => {
      const terms = searchTerm.trim().split(/\s+/).filter(Boolean);
      const conditions = terms.map((term, idx) => ({
        id: idx + 1,
        term,
        operator: 'AND',
      }));

      setAdvancedSearchConditions({
        leafNodeIds: 'ALL',
        drawingNumber: '',
        drawingName: '',
        additionalConditions: conditions,
        selectedPath: '전체',
        infoNode: null,
      });

      setIsSidebarOpen(true);
      openPanel('search', PANEL_CONFIG.search);
      setActiveSearchTab('searchDrawing');
      setSearchTrigger((n) => n + 1);
    },
    [
      PANEL_CONFIG,
      openPanel,
      setAdvancedSearchConditions,
      setIsSidebarOpen,
      setActiveSearchTab,
      setSearchTrigger,
    ]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>사용자 정보를 확인 중입니다...</p>
      </div>
    );
  }

  if (!user || authError) return null;

  return (
    <div className="tool-page-layout">
      <Header
        user={user}
        tabItems={filteredTabItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={handleLogoClick}
        onFileSelect={(node) => handleFileSelect({ docId: node.DOCNO, docVr: node.DOCVR }, true)}
        onViewAllSearch={handleViewAllSearch}
        previewResultCount={previewResultCount}
        onPreviewCountChange={setPreviewResultCount}
      />

      <div className="content-wrapper">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          menuItems={sidebarMenus[activeTab] || []}
          activeMenuItem={activeMenuItem}
          onMenuItemClick={handleMenuClick}
          user={user}
          isFileLoaded={isFileLoaded}
        />

        {isPanelOpen && activePanelConfig && (
          <ResizablePanel
            key={activeMenuItem}
            initialWidth={isPanelMaximized ? 800 : 300}
            minWidth={300}
            maxWidth={800}
            isResizable={activePanelConfig.isResizable}
          >
            {activePanelConfig.component}
          </ResizablePanel>
        )}

        <MainView
          openFiles={openFiles}
          activeFileId={activeFileId}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onCloseAllTabs={handleCloseAllTabs}
          onMainViewClick={handleMainViewClick}
          onViewerReady={handleViewerReady}
          onViewStateChange={handleViewStateChange}
        />
      </div>
    </div>
  );
}

export default EpnidSystemPage;
