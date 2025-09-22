import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './IntelligentTool.css';
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText } from 'lucide-react';

import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from '../components/utils/Panel';
import DrawingDocuments from './DrawingDocuments';
import ResizablePanel from './ResizablePanel';

// Axios 기본 설정
axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.withCredentials = true;

// 탭 데이터 정의
const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'sample02', label: '지능화' },
  { id: 'sample03', label: '지능화 승계' },
  { id: 'pld', label: 'PLD' },
];

// 탭별 사이드바 메뉴 데이터 정의
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

// 상세검색 패널 탭 및 컨텐츠 정의
const NotImplemented = () => <div style={{ padding: '20px', textAlign: 'center' }}>🚧 준비 중인 기능입니다.</div>;

// 설비목록 패널 탭 및 컨텐츠 정의 (예시)
const equipmentTabs = [
  {
    id: "equipmentList",
    label: "설비목록",
    content: () => <NotImplemented />,
  },
  {
    id: "searchEquipment",
    label: "설비상세검색",
    content: () => <NotImplemented />,
  },
];

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

const findPathToNode = (nodes, nodeId, path = []) => {
    for (const node of nodes) {
        const newPath = [...path, node.ID];
        if (node.ID === nodeId) {
            return newPath;
        }
        if (node.CHILDREN) {
            const result = findPathToNode(node.CHILDREN, nodeId, newPath);
            if (result.length) {
                return result;
            }
        }
    }
    return [];
};

function IntelligentTool() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [documentTree, setDocumentTree] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const handleLogoClick = () => {
    setIsSidebarOpen(false);
    setActiveMenuItem(null);
  };
  
  const handleMainViewClick = (e) => {
    // .view-tab 클래스 또는 그 자식 요소를 클릭한 경우 사이드바를 닫지 않음
    if (e.target.closest('.view-tab')) {
      return;
    }
    setIsSidebarOpen(false);
    setActiveMenuItem(null);
  };

  const handleFileSelect = (file) => {
    if (!openFiles.some(f => f.DOCNO === file.DOCNO)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFileId(file.DOCNO);
    setIsFileLoaded(true);
  };

  const handleTabClick = (docno) => {
    setActiveFileId(docno);
  };

  const handleTabClose = (docnoToClose) => {
    const newOpenFiles = openFiles.filter(file => file.DOCNO !== docnoToClose);
    setOpenFiles(newOpenFiles);

    if (activeFileId === docnoToClose) {
      if (newOpenFiles.length > 0) {
        setActiveFileId(newOpenFiles[newOpenFiles.length - 1].DOCNO);
      } else {
        setActiveFileId(null);
        setIsFileLoaded(false);
      }
    }
  };

  const handleTabReorder = (newFiles, draggedFileId) => {
    setOpenFiles(newFiles);
    setActiveFileId(draggedFileId);
  };
  
  const handleNodeToggle = (nodeId) => {
    setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        return newSet;
    });
  };

  const searchTabs = [
    {
      id: "documentList",
      label: "도면목록",
      content: (filter) => <DrawingDocuments 
                                filter={filter} 
                                onFileSelect={handleFileSelect}
                                tree={documentTree}
                                loading={documentsLoading}
                                activeFileId={activeFileId}
                                expandedNodes={expandedNodes}
                                onNodeToggle={handleNodeToggle}
                             />,
    },
    {
      id: "searchDrawing",
      label: "도면상세검색",
      content: () => <NotImplemented />,
    },
    {
      id: "searchEquipment",
      label: "설비상세검색",
      content: () => <NotImplemented />,
    },
  ];

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
            setDocumentTree(buildTree(data));
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
    if (!activeFileId || documentTree.length === 0) return;

    const path = findPathToNode(documentTree, activeFileId);
    if (path.length > 0) {
      // Set a new Set with only the path to the current active file
      const newExpanded = new Set(path.slice(0, -1));
      setExpandedNodes(newExpanded);
    }
  }, [activeFileId, documentTree]);

  // 열려있는 파일이 없으면 도면 목록 상태를 초기화합니다.
  useEffect(() => {
    if (openFiles.length === 0) {
      setExpandedNodes(new Set());
    }
  }, [openFiles]);

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
            {showSearchPanel && (
              <Panel
                tabs={searchTabs}
                defaultTab="documentList"
                showFilterTabs={["documentList"]}
              />
            )}
            {showEquipmentsPanel && (
              <Panel
                tabs={equipmentTabs}
                defaultTab="equipmentList"
              />
            )}
             {(showBookmarkPanel || showMyDocsPanel) && (
              <Panel />
            )}
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
        />
      </div>
    </div>
  );
}

export default IntelligentTool;