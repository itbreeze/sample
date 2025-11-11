import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './IntelligentToolPage.css';
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText, History } from 'lucide-react';

import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from './utils/Panel';
import DrawingList from './DrawingList';
import ResizablePanel from './ResizablePanel';
import { useDocumentTree } from './hooks/useDocumentTree';
import { useDocumentLoader } from './hooks/useDocumentLoader';
import SearchResultList from './Search/SearchResultList';

axios.defaults.baseURL = 'http://localhost:4001';
axios.defaults.withCredentials = true;

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
  const viewerContainer = document.getElementById('viewer-container');
  if (!viewerContainer) return;
  window.dispatchEvent(new Event('resize'));
};

const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'pld', label: 'PLD' },
  { id: 'intelligent', label: '지능화' },
  { id: 'inherit', label: '지능화 승계' },
];

const sidebarMenus = {
  drawing: [
    { id: 'search', icon: <Search size={20} />, label: '상세검색' },
    { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기' },
    { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서' },
    { id: 'recentdocs', icon: <History size={20} />, label: '최근 본 도면' },
    { id: 'equipments', icon: <Settings size={20} />, label: '설비목록' },
    { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '유체색목록' },
    { id: 'layers', icon: <Layers size={20} />, label: '레이어목록' },
  ],
  pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD Menu' }],
  intelligent: [{ id: 'intelligent', icon: <FileText size={20} />, label: 'Sample Menu' }],
  inherit: [{ id: 'inherit', icon: <FileText size={20} />, label: 'Sample Menu' }],
};

const NotImplemented = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>준비 중인 기능입니다.</div>
);

const equipmentTabs = [
  { id: 'equipmentList', label: '설비목록', content: () => <NotImplemented /> },
  { id: 'searchEquipment', label: '설비상세검색', content: () => <NotImplemented /> },
];

function IntelligentToolPage() {
  const { documentTree, loading: documentsLoading } = useDocumentTree();
  const { isLoading: isDocumentLoading, loadDocument } = useDocumentLoader();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(null);
  const [isPanelMaximized, setIsPanelMaximized] = useState(true);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewStates, setViewStates] = useState({});
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const tabSwitchTimeoutRef = useRef(null);
  const currentViewerInstanceRef = useRef(null);
  const [activeSearchTab, setActiveSearchTab] = useState('documentList');
  const [isDefaultExpandApplied, setIsDefaultExpandApplied] = useState(false);

  const [searchInfo, setSearchInfo] = useState(null);

  const mapSearchTypeToTab = (searchType) => {
    switch (searchType) {
      case '도면': return 'searchDrawing';
      case '설비번호': return 'searchEquipment';
      default: return 'searchDrawing';
    }
  };

  const handleViewDetailSearch = (searchType, searchTerm) => {
    setSearchInfo({ type: searchType, term: searchTerm, timestamp: Date.now() });
    setIsSidebarOpen(true);
    setActiveMenuItem('search');
    setActiveSearchTab(mapSearchTypeToTab(searchType));
    setIsPanelMaximized(true);
  };

  const handleMenuClick = (menuId) => {
    setActiveMenuItem(menuId);
    const config = PANEL_CONFIG[menuId];
    if (config) setIsPanelMaximized(config.startsMaximized);
  };

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
    setActiveMenuItem(null);
    setSearchInfo(null);
  };

  const handleMainViewClick = (e) => {
    if (e.target.closest('.view-tab')) return;
    setActiveMenuItem(null);
    setIsSidebarOpen(false);
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
        setIsSidebarOpen(false);
        setActiveMenuItem(null);
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
    setOpenFiles(next);
    if (activeFileId === docnoToClose) {
      setActiveFileId(next.length ? next[0].DOCNO : null);
      if (!next.length) setIsFileLoaded(false);
    }
  };

  const handleTabReorder = (newFiles, draggedFileId) => {
    setOpenFiles(newFiles);
    setActiveFileId(draggedFileId);
  };

  const handleViewerReady = useCallback((viewerInstance) => {
    currentViewerInstanceRef.current = viewerInstance;
    window.currentViewerInstance = viewerInstance;
  }, []);

  const handleNodeToggle = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  // 트리 모두 접기 → 기본 확장 레벨로 복원
  const handleCollapseAll = useCallback(() => {
    if (documentTree && documentTree.length) {
      const defaults = collectIdsToLevel(documentTree, DEFAULT_EXPAND_LEVEL);
      setExpandedNodes(new Set(defaults));
    } else {
      setExpandedNodes(new Set());
    }
  }, [documentTree]);

  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const res = await axios.get('/api/users/profile');
        setUser(res.data);
      } catch (err) {
        alert(err.response?.data?.message || '접근 권한이 없습니다.');
        window.close();
      } finally {
        setLoading(false);
      }
    };
    checkUserAccess();
  }, []);

  useEffect(() => {
    setActiveMenuItem(null);
  }, [activeTab]);

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
      console.log(`기본 확장 레벨 ${DEFAULT_EXPAND_LEVEL} 적용: ${defaults.length}개 노드`);
    }
  }, [documentTree, isDefaultExpandApplied]);

  useEffect(() => {
    if (!isFileLoaded) return;
    const t = setTimeout(triggerResize, 150);
    return () => clearTimeout(t);
  }, [activeMenuItem, isFileLoaded]);

  useEffect(() => {
    return () => tabSwitchTimeoutRef.current && clearTimeout(tabSwitchTimeoutRef.current);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>사용자 권한을 확인 중입니다...</p>
      </div>
    );
  }

  const searchTabs = [
    {
      id: 'documentList',
      label: '전체도면목록',
      content: (filter) => (
        <DrawingList
          filter={filter}
          onFileSelect={(node) => handleFileSelect({ docId: node.ID, docVr: node.DOCVR })}
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
      label: '도면상세검색',
      content: () => <SearchResultList searchInfo={searchInfo} onFileSelect={handleFileSelect} />,
    },
    { id: 'searchEquipment', label: '설비상세검색', content: () => <NotImplemented /> },
  ];

  const PANEL_CONFIG = {
    search: {
      component: (
        <Panel
          tabs={searchTabs}
          // 컨트롤드로 변경: 부모가 현재 탭을 관리
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
    equipments: { component: <Panel tabs={equipmentTabs} defaultTab="equipmentList" />, startsMaximized: true, isResizable: true },
    bookmark: { component: <NotImplemented />, startsMaximized: false, isResizable: true },
    mydocs: { component: <NotImplemented />, startsMaximized: false, isResizable: true },
    recentdocs: { component: <NotImplemented />, startsMaximized: true, isResizable: true },
    pipeLayers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
    layers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
  };

  const activePanelConfig = PANEL_CONFIG[activeMenuItem];
  const isPanelOpen = activeMenuItem !== null;

  return (
    <div className="tool-page-layout">
      <Header
        user={user}
        tabItems={tabItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={handleLogoClick}
        onFileSelect={(node) => handleFileSelect({ docNo: node.DOCNO, docVr: node.DOCVR }, true)}
        onViewDetailSearch={handleViewDetailSearch}
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

            {/* TreeControls는 Panel 내부에서 탭 기준으로 관리 */}
          </ResizablePanel>
        )}

        <MainView
          openFiles={openFiles}
          activeFileId={activeFileId}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onMainViewClick={handleMainViewClick}
          onViewerReady={handleViewerReady}
          onViewStateChange={handleViewStateChange}
        />
      </div>
    </div>
  );
}

export default IntelligentToolPage;
