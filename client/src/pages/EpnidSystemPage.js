import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './EpnidSystemPage.css';
import { FolderOpen, Star, Search, Waypoints, Layers, MonitorCog, FileText, History } from 'lucide-react';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { TabbedPanel } from '../components/panels/TabbedPanel/TabbedPanel';
import DrawingList from '../components/DrawingList';
import ResizablePanel from '../components/ResizablePanel';
import { useDocumentTree } from '../components/hooks/useDocumentTree';
import SearchResultList from '../components/Search/SearchResultList';
import { persistPlantContext } from '../services/api';
import FavoriteDocsPanel from '../components/FavoriteDocsPanel';
import RecentDocsPanel from '../components/RecentDocsPanel';
import LayerMenu from '../components/LayerMenu';
import { useAuthState } from '../hooks/useAuthState';
import { usePanelState } from '../hooks/usePanelState';
import { ViewerProvider, useViewer, ViewerShell } from '../viewer';
import EquipmentMenu from '../components/EquipmentMenu';






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

const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'pld', label: 'PLD' },
  { id: 'intelligent', label: '지능화', requiresAuth: true },
  { id: 'inherit', label: '지능화 승계', requiresAuth: true },
];

const TAB_VIEWER_MODES = {
  drawing: 'ViewerMode',
  pld: 'PLDMode',
  intelligent: 'IntelligentMode',
  inherit: 'InheritMode',
};

const VIEWER_MODE_LOGS = {
  ViewerMode: '[Viewer Mode]',
  PLDMode: '[PLD Mode]',
  IntelligentMode: '[Intelligent Mode]',
  InheritMode: '[Inherit Mode]'
};

const sidebarMenus = {
  drawing: [
    { id: 'search', icon: <Search size={20} />, label: '도면검색' },
    { id: 'recentdocs', icon: <History size={20} />, label: '최근 본 도면' },
    { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기 목록' },
    { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서함' },
    { id: 'equipments', icon: <MonitorCog size={20} />, label: '설비 목록' },
    { id: 'layers', icon: <Layers size={20} />, label: '레이어 목록' },
    { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '배관 목록' },    
  ],
  pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD 메뉴' }],
  intelligent: [{ id: 'intelligent', icon: <FileText size={20} />, label: '샘플 메뉴' }],
  inherit: [{ id: 'inherit', icon: <FileText size={20} />, label: '샘플 메뉴' }],
};

const NotImplemented = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>🚧 해당 기능은 아직 준비되지 않았습니다.</div>
);

const equipmentTabs = [
  {
    id: 'equipmentHighlight',
    label: '설비 목록',
    content: () => <EquipmentMenu />,
  },
  {
    id: 'searchEquipment',
    label: '도면 내 설비 검색',
    shortLabel: '설비 검색',
    content: () => <NotImplemented />,
  },
];

function EpnidSystemPageContent() {
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
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
  const {
    handleFileSelect,
    activeFileId,
    isFileLoaded,
    favoriteDocs,
    favoriteEquipments,
    favoriteDocMeta,
    recentDocs,
    recentDocsLoading,
    refreshRecentDocs,
    logRecentDoc,
    flagManualRecentLog,
    consumeManualRecentLog,
    openFiles,
  } = useViewer();
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
  } = usePanelState();

  const handleDocumentSelect = useCallback(
    async (fileIdentifier, options = {}) => {
      const loaded = await handleFileSelect(fileIdentifier);
      if (loaded && options.collapsePanel) {
        setIsPanelMaximized(false);
      }
      return loaded;
    },
    [handleFileSelect, setIsPanelMaximized]
  );

  const handleRecentDocSelect = useCallback(
    async (doc) => {
      const docId = doc.docId || doc.docIdFormatted || doc.docNO || doc.DOCNO;
      const docVr = doc.docVr || doc.docVer || doc.DOCVR || '001';
      if (!docId) return null;
      const docNumber = doc.docNumber || doc.DOCNUMBER || doc.DOCNUM || '';
      const alreadyOpen = openFiles.some(
        (file) =>
          file.DOCNO === docId &&
          (docVr ? file.DOCVR === docVr : true)
      );
      flagManualRecentLog(docId, docVr);
      logRecentDoc({
        docId,
        docVr,
        docNumber,
      }).catch((err) => {
        consumeManualRecentLog(docId, docVr);
      });
      const loaded = await handleDocumentSelect({ docId, docVr });
      if (!loaded) {
        consumeManualRecentLog(docId, docVr);
        return loaded;
      }
      if (alreadyOpen) {
        consumeManualRecentLog(docId, docVr);
      }
      return loaded;
    },
    [
      consumeManualRecentLog,
      flagManualRecentLog,
      handleDocumentSelect,
      logRecentDoc,
      openFiles,
    ]
  );

  const handleDocumentSelectRef = useRef(handleDocumentSelect);
  useEffect(() => {
    handleDocumentSelectRef.current = handleDocumentSelect;
  }, [handleDocumentSelect]);

  useEffect(() => {
    if (activeMenuItem !== 'recentdocs' || !isPanelOpen) return;
    refreshRecentDocs({ limit: 40 }).catch(() => {});
  }, [activeMenuItem, isPanelOpen, refreshRecentDocs]);

  const filteredTabItems = authLimited
    ? tabItems.filter(t => !t.requiresAuth)
    : tabItems;

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

  // ===============================
  //  새 창에서 docno + docvr 자동 로딩
  // ===============================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDocno = params.get('docno');
    const urlDocvr = params.get('docvr');
    if (!urlDocno || !urlDocvr) return;

    const loadFromUrl = async () => {
      try {
        await handleDocumentSelectRef.current?.({ docId: urlDocno, docVr: urlDocvr });
      } catch (err) {
        console.error("URL 기반 도면 자동 로딩 실패:", err);
      }
    };

    loadFromUrl();

    const cleanPath = window.location.pathname.replace(/\/$/, "");
    const cleanUrl = `${window.location.origin}${cleanPath}`;
    window.history.replaceState({}, document.title, cleanUrl);
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
              handleDocumentSelect({ docId: node.ID, docVr: node.DOCVR })
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
            onFileSelect={(file) => handleDocumentSelect(file)}
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
      handleDocumentSelect,
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
          <TabbedPanel
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
        component: <TabbedPanel tabs={equipmentTabs} defaultTab="equipmentHighlight" />,
        startsMaximized: false,
        isResizable: true,
      },
      bookmark: {
        component: (
          <TabbedPanel
            tabs={[
              {
                id: 'favoriteDocs',
                label: '즐겨찾기 목록',
                content: () => (
                  <FavoriteDocsPanel
                    documentItems={favoriteDocs}
                    equipmentItems={favoriteEquipments}
                    onFileSelect={(doc) =>
                      handleDocumentSelect({
                        docId: doc.docId || doc.docNO,
                        docVr: doc.docVer,
                      })
                    }
                    favoriteDocMeta={favoriteDocMeta}
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
      recentdocs: {
        component: (
          <TabbedPanel
            tabs={[
              {
                id: 'recentDocs',
                label: '최근 본 도면',
                content: () => (
                  <RecentDocsPanel
                    items={recentDocs}
                    loading={recentDocsLoading}
                    onFileSelect={handleRecentDocSelect}
                  />
                ),
              },
            ]}
            defaultTab="recentDocs"
          />
        ),
        startsMaximized: true,
        isResizable: true,
      },
      pipeLayers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
      layers: {
        component: (
          <TabbedPanel
            tabs={[
              {
                id: 'layerList',
                label: '레이어 목록',
                content: () => <LayerMenu />,
              },
            ]}
            defaultTab="layerList"
          />
        ),
        startsMaximized: false,
        isResizable: true,
      },
    }),
    [
      searchTabs,
      activeSearchTab,
      handleCollapseAll,
      favoriteDocs,
      favoriteEquipments,
      handleDocumentSelect,
      handleRecentDocSelect,
      refreshRecentDocs,
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

  const handleCloseAllTabsMenu = useCallback(() => {
    closePanel();
    setIsSidebarOpen(false);
  }, [closePanel, setIsSidebarOpen]);

  const viewerMode = TAB_VIEWER_MODES[activeTab] || TAB_VIEWER_MODES.drawing;

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
        onFileSelect={(node) =>
          handleDocumentSelect({ docId: node.DOCNO, docVr: node.DOCVR })
        }
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

        <ViewerShell
          onMainViewClick={handleMainViewClick}
          viewerMode={viewerMode}
          allowEntityPanel={activeTab === 'intelligent'}
          allowEquipmentInfoPanel={activeTab === 'drawing'}
          onCloseAllTabsMenu={handleCloseAllTabsMenu}
        />
      </div>
    </div>
  );
}

function EpnidSystemPage() {
  return (
    <ViewerProvider>
      <EpnidSystemPageContent />
    </ViewerProvider>
  );
}

export default EpnidSystemPage;
