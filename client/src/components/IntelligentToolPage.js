import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './IntelligentToolPage.css'
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText } from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from '../components/utils/Panel';
import DrawingList from './DrawingList';
import ResizablePanel from './ResizablePanel';

// Axios 기본 설정
axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.withCredentials = true;

// 사이드바 트리 기본 확장 레벨
const DEFAULT_EXPAND_LEVEL = 0;

// 배열 형태의 문서 데이터를 트리 구조로 변환
const buildTree = (items) => {
  const map = {};
  const roots = [];
  if (!items) return roots;
  items.forEach(item => {
    map[item.ID] = { ...item, CHILDREN: [] };
  });
  items.forEach(item => {
    if (item.PARENTID && map[item.PARENTID]) {
      map[item.PARENTID].CHILDREN.push(map[item.ID]);
    } else {
      roots.push(map[item.ID]);
    }
  });
  return roots;
};

// 특정 노드까지의 경로를 찾는 함수
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

// 지정한 레벨까지 폴더 ID 수집
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

// 뷰 상태 추출 유틸리티 (기존 유지)
const getCurrentViewState = (viewer) => {
  if (!viewer) return null;
  const view = viewer.activeView;
  if (!view) return null;

  try {
    if (view.position && view.target && view.upVector) {
      const viewParams = {
        position: view.position.toArray(),
        target: view.target.toArray(),
        upVector: view.upVector.toArray(),
        fieldWidth: view.fieldWidth,
        fieldHeight: view.fieldHeight,
        projection: view.projection,
      };
      view.delete();
      return viewParams;
    }
  } catch (error) {
    console.warn('뷰 상태 추출 실패:', error);
  }

  if (view.delete) view.delete();
  return null;
};

// 상단 탭 정의
const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'sample02', label: '지능화' },
  { id: 'sample03', label: '지능화 승계' },
  { id: 'pld', label: 'PLD' },
];

// 사이드바 메뉴 정의
const sidebarMenus = {
  drawing: [
    { id: 'search', icon: <Search size={20} />, label: '상세검색' },
    { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기' },
    { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서' },
    { id: 'equipments', icon: <Settings size={20} />, label: '설비목록' },
    { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '유체색' },
    { id: 'layers', icon: <Layers size={20} />, label: '레이어' },
  ],
  sample02: [{ id: 'sample02', icon: <FileText size={20} />, label: 'Sample Menu' }],
  sample03: [{ id: 'sample03', icon: <FileText size={20} />, label: 'Sample Menu' }],
  pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD Menu' }]
};

// 준비 중 컴포넌트 표시
const NotImplemented = () => <div style={{ padding: '20px', textAlign: 'center' }}>🚧 준비 중인 기능입니다.</div>;

// 설비 관련 패널 탭
const equipmentTabs = [
  { id: "equipmentList", label: "설비목록", content: () => <NotImplemented /> },
  { id: "searchEquipment", label: "설비상세검색", content: () => <NotImplemented /> },
];

// 브라우저 resize 이벤트 강제 트리거
const triggerResize = () => {
  const viewerContainer = document.getElementById("viewer-container");
  if (!viewerContainer) return;

  let resizeEvent;
  if (typeof Event === "function") {
    resizeEvent = new Event("resize");
  } else {
    resizeEvent = document.createEvent("Event");
    resizeEvent.initEvent("resize", true, true);
  }
  window.dispatchEvent(resizeEvent);
};

function IntelligentToolPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewStates, setViewStates] = useState({}); // 기존 뷰 상태 관리 유지
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [documentTree, setDocumentTree] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  
  // 🔹 탭 전환 최적화를 위한 상태 추가
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const tabSwitchTimeoutRef = useRef(null);
  const currentViewerInstanceRef = useRef(null);

  const handleLogoClick = () => {
    setIsSidebarOpen(false);
    setActiveMenuItem(null);
  };

  const handleMainViewClick = (e) => {
    if (e.target.closest('.view-tab')) return;
    setIsSidebarOpen(false);
    setActiveMenuItem(null);
  };

  // 🔹 뷰 상태 변경 핸들러 (기존 유지하되 최적화)
  const handleViewStateChange = useCallback((docno, viewState) => {
    setViewStates(prev => ({
      ...prev,
      [docno]: {
        ...viewState,
        timestamp: Date.now()
      }
    }));
  }, []);

  const handleFileSelect = (file) => {
    // 이미 열린 파일인지 확인
    const existingFileIndex = openFiles.findIndex(f => f.DOCNO === file.DOCNO);

    if (existingFileIndex !== -1) {
      // 이미 열린 파일이라면 맨 앞으로 이동
      const updatedFiles = [...openFiles];
      const [existingFile] = updatedFiles.splice(existingFileIndex, 1);
      updatedFiles.unshift(existingFile); // 맨 앞에 추가
      setOpenFiles(updatedFiles);
    } else {
      // 새 파일이라면 맨 앞에 추가
      setOpenFiles([file, ...openFiles]); // 맨 앞에 추가
    }

    setActiveFileId(file.DOCNO);
    setIsFileLoaded(true);
  };

  // 🔹 개선된 탭 클릭 핸들러 (기존 기능 유지하되 최적화)
  const handleTabClick = useCallback((docno) => {
    if (docno === activeFileId || isTabSwitching) return;

    setIsTabSwitching(true);
    
    // 이전 탭 전환 타이머 정리
    if (tabSwitchTimeoutRef.current) {
      clearTimeout(tabSwitchTimeoutRef.current);
    }

    // 현재 활성 뷰어의 상태를 즉시 저장 (기존 로직 유지)
    if (currentViewerInstanceRef.current && activeFileId) {
      try {
        const currentState = getCurrentViewState(currentViewerInstanceRef.current);
        if (currentState) {
          handleViewStateChange(activeFileId, currentState);
        }
      } catch (error) {
        console.warn('뷰 상태 저장 실패:', error);
      }
    }

    setActiveFileId(docno);
    
    // 탭 전환 완료 표시 (뷰어 로딩 시간 고려)
    tabSwitchTimeoutRef.current = setTimeout(() => {
      setIsTabSwitching(false);
    }, 300);

  }, [activeFileId, handleViewStateChange, isTabSwitching]);

  // 🔹 탭 닫기 (기존 로직 유지하되 최적화)
  const handleTabClose = (docnoToClose) => {
    const newOpenFiles = openFiles.filter(file => file.DOCNO !== docnoToClose);
    setOpenFiles(newOpenFiles);

    // 해당 도면의 뷰 상태 정리
    setViewStates(prev => {
      const newStates = { ...prev };
      delete newStates[docnoToClose];
      return newStates;
    });

    if (activeFileId === docnoToClose) {
      if (newOpenFiles.length > 0) {
        setActiveFileId(newOpenFiles[newOpenFiles.length - 1].DOCNO);
      } else {
        setActiveFileId(null);
        setIsFileLoaded(false);
      }
    }
  };

  // 🔹 탭 순서 변경 (기존 유지)
  const handleTabReorder = (newFiles, draggedFileId) => {
    setOpenFiles(newFiles);
    setActiveFileId(draggedFileId);
  };

  // 🔹 뷰어 준비 완료 콜백 추가
  const handleViewerReady = useCallback((viewerInstance) => {
    currentViewerInstanceRef.current = viewerInstance;
    // 전역 window 객체에도 설정 (기존 호환성 유지)
    window.currentViewerInstance = viewerInstance;
  }, []);

  const handleNodeToggle = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return newSet;
    });
  };

  const searchTabs = [
    {
      id: "documentList",
      label: "도면목록",
      content: (filter) => <DrawingList
        filter={filter}
        onFileSelect={handleFileSelect}
        tree={documentTree}
        loading={documentsLoading}
        activeFileId={activeFileId}
        expandedNodes={expandedNodes}
        onNodeToggle={handleNodeToggle}
      />,
    },
    { id: "searchDrawing", label: "도면상세검색", content: () => <NotImplemented /> },
    { id: "searchEquipment", label: "설비상세검색", content: () => <NotImplemented /> },
  ];

  const setInitialExpand = (tree) => {
    if (tree && tree.length > 0) {
      const idsToExpand = collectIdsToLevel(tree, DEFAULT_EXPAND_LEVEL);
      setExpandedNodes(new Set(idsToExpand));
    } else {
      setExpandedNodes(new Set());
    }
  };

  useEffect(() => {
    setActiveMenuItem(null);
  }, [activeTab]);

  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const response = await axios.get('/api/users/profile');
        setUser(response.data);
      } catch (err) {
        const errorMessage = err.response?.data?.message || '접근 권한이 없습니다.';
        alert(errorMessage);
        window.close();
      } finally {
        setLoading(false);
      }
    };
    checkUserAccess();
  }, []);

  useEffect(() => {
    const fetchDocumentTree = async () => {
      setDocumentsLoading(true);
      try {
        const response = await fetch("http://localhost:4000/folders");
        const data = await response.json();
        const treeData = buildTree(data);
        setDocumentTree(treeData);
        setInitialExpand(treeData);
      } catch (err) {
        console.error("Fetch error:", err);
        setDocumentTree([]);
      } finally {
        setDocumentsLoading(false);
      }
    };
    fetchDocumentTree();
  }, []);

  useEffect(() => {
    if (!activeFileId) {
      setInitialExpand(documentTree);
      return;
    }
    if (documentTree.length > 0) {
      const path = findPathToNode(documentTree, activeFileId);
      if (path.length > 0) {
        const pathToExpand = new Set(path.slice(0, -1));
        setExpandedNodes(pathToExpand);
      }
    }
  }, [activeFileId, documentTree]);

  useEffect(() => {
    if (!isFileLoaded) return;
    const timer = setTimeout(() => {
      triggerResize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, activeMenuItem, isFileLoaded]);

  // 🔹 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (tabSwitchTimeoutRef.current) {
        clearTimeout(tabSwitchTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>사용자 권한을 확인 중입니다...</p>
      </div>
    );
  }

  const showSearchPanel = activeMenuItem === 'search';
  const showEquipmentsPanel = activeMenuItem === 'equipments';
  const showBookmarkPanel = activeMenuItem === 'bookmark';
  const showMyDocsPanel = activeMenuItem === 'mydocs';
  const isPanelOpen = showSearchPanel || showEquipmentsPanel || showBookmarkPanel || showMyDocsPanel;

  return (
    <div className="tool-page-layout">
      <Header
        user={user}
        tabItems={tabItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={handleLogoClick}
      />
      <div className="content-wrapper">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          menuItems={sidebarMenus[activeTab] || []}
          activeMenuItem={activeMenuItem}
          onMenuItemClick={setActiveMenuItem}
          user={user}
          isFileLoaded={isFileLoaded}
        />

        {isPanelOpen && (
          <ResizablePanel
            key={activeMenuItem}
            initialWidth={300}
            minWidth={300}
            maxWidth={800}
          >
            {showSearchPanel && <Panel tabs={searchTabs} defaultTab="documentList" showFilterTabs={["documentList"]} />}
            {showEquipmentsPanel && <Panel tabs={equipmentTabs} defaultTab="equipmentList" />}
            {(showBookmarkPanel || showMyDocsPanel) && <Panel />}
          </ResizablePanel>
        )}

        <MainView
          currentTab={tabItems.find(tab => tab.id === activeTab)}
          openFiles={openFiles}
          activeFileId={activeFileId}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onMainViewClick={handleMainViewClick}
          viewStates={viewStates} // 기존 뷰 상태 관리 유지
          onViewStateChange={handleViewStateChange} // 기존 뷰 상태 변경 핸들러 유지
          onViewerReady={handleViewerReady} // 뷰어 준비 완료 콜백 추가
          isTabSwitching={isTabSwitching} // 탭 전환 상태 전달
        />
      </div>
    </div>
  );
}

export default IntelligentToolPage;