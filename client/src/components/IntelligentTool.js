import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './IntelligentTool.css';
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText } from 'lucide-react';

import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from '../components/utils/Panel';
import DrawingDocuments from './DrawingDocuments';

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

function IntelligentTool() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 초기값을 false로 변경
  const [activeMenuItem, setActiveMenuItem] = useState(null); // 초기값을 null로 변경
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isFileLoaded, setIsFileLoaded] = useState(false);

  // 로고 클릭 시 사이드바를 최소화하는 함수
  const handleLogoClick = () => {
    setIsSidebarOpen(false);
    setActiveMenuItem(null); // 사이드바 패널도 닫기
  };

  // 파일 선택 또는 추가
  const handleFileSelect = (file) => {
    // 이미 열려있는 파일인지 확인
    if (!openFiles.some(f => f.DOCNO === file.DOCNO)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFileId(file.DOCNO);
    setIsFileLoaded(true);
  };
  
  // 탭 클릭
  const handleTabClick = (docno) => {
    setActiveFileId(docno);
  };

  // 탭 닫기
  const handleTabClose = (docnoToClose) => {
    const newOpenFiles = openFiles.filter(file => file.DOCNO !== docnoToClose);
    setOpenFiles(newOpenFiles);

    // 닫힌 탭이 현재 활성 탭이었다면, 다른 탭을 활성화
    if (activeFileId === docnoToClose) {
      if (newOpenFiles.length > 0) {
        setActiveFileId(newOpenFiles[newOpenFiles.length - 1].DOCNO);
      } else {
        setActiveFileId(null);
        setIsFileLoaded(false);
      }
    }
  };

  // 탭 순서 변경 핸들러
  const handleTabReorder = (newFiles, draggedFileId) => {
    setOpenFiles(newFiles);
    setActiveFileId(draggedFileId); // 드래그한 탭을 활성화
  };

  const searchTabs = [
    {
      id: "documentList",
      label: "도면목록",
      content: (filter) => <DrawingDocuments filter={filter} onFileSelect={handleFileSelect} />,
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>사용자 권한을 확인 중입니다...</p>
      </div>
    );
  }

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

        <div className={`sidebar-panel-container ${activeMenuItem === 'search' ? 'open' : ''}`}>
          {activeMenuItem === 'search' && (
            <Panel
              tabs={searchTabs}
              defaultTab="documentList"
              showFilterTabs={["documentList"]}
            />
          )}
        </div>

        <div className={`sidebar-panel-container ${activeMenuItem === 'equipments' ? 'open' : ''}`}>
          {activeMenuItem === 'equipments' && <Panel />}
        </div>

        <MainView
          currentTab={tabItems.find(tab => tab.id === activeTab)}
          openFiles={openFiles}
          activeFileId={activeFileId}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
        />
      </div>
    </div>
  );
}

export default IntelligentTool;