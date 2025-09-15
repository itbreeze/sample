import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './IntelligentTool.css';
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText } from 'lucide-react';

import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from '../components/utils/Panel'; // Panel 컴포넌트 임포트

// Axios 기본 설정
axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.withCredentials = true;

// 탭 데이터 정의
const tabItems = [
  { id: 'drawing', label: 'P&ID' },
  { id: 'pld', label: 'PLD' },
  { id: 'sample02', label: '지능화' },
  { id: 'sample03', label: '지능화 승계' },
];

// 탭별 사이드바 메뉴 데이터 정의
const sidebarMenus = {
  drawing: [
    { id: 'search', icon: <Search size={20} />, label: '상세검색' },
    { id: 'equipments', icon: <Settings size={20} />, label: '설비목록' },
    { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '유체색' },
    { id: 'layers', icon: <Layers size={20} />, label: '레이어' },
    { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기' },
    { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서' },
  ],
  pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD Menu' }],
  sample02: [{ id: 'sample02', icon: <FileText size={20} />, label: 'Sample Menu' }],
  sample03: [{ id: 'sample03', icon: <FileText size={20} />, label: 'Sample Menu' }],
};

function IntelligentTool() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(tabItems[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(null);


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
      />
      <div className="content-wrapper">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          menuItems={sidebarMenus[activeTab] || []}
          activeMenuItem={activeMenuItem}
          onMenuItemClick={setActiveMenuItem}
        />

        <div className={`sidebar-panel-container ${activeMenuItem === 'search' ? 'open' : ''}`}>
          {activeMenuItem === 'search' && <Panel />}
        </div>

        <MainView currentTab={tabItems.find(tab => tab.id === activeTab)} />
      </div>
    </div>
  );
}

export default IntelligentTool;