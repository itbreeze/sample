import React, { useState } from 'react';
import UserProfile from './UserProfile';
import './Sidebar.css';
import { Menu, PanelLeftClose, PanelRightClose } from 'lucide-react';

function Sidebar({
  user,
  isOpen,
  setIsOpen,
  menuItems,
  activeMenuItem,
  onMenuItemClick,
  isFileLoaded // isFileLoaded prop 추가
}) {
  const [isHovered, setIsHovered] = useState(false);

  // 비활성화할 메뉴 아이템 ID 목록
  const disabledMenuItems = ['equipments', 'pipeLayers', 'layers'];

  const handleMenuClick = (id) => {
    // 비활성화된 메뉴는 클릭 무시
    if (!isFileLoaded && disabledMenuItems.includes(id)) {
      return;
    }

    if (activeMenuItem === id) {
      setIsOpen(false);
      onMenuItemClick(null);
    } else {
      if (!isOpen) setIsOpen(true);
      onMenuItemClick(id);
    }
  };

  const handleToggle = () => {
    const newIsOpenState = !isOpen;
    setIsOpen(newIsOpenState);

    if (!newIsOpenState) {
      onMenuItemClick(null);
    }
    setIsHovered(false);
  };

  const getToggleIcon = () => {
    if (isOpen) {
      return <PanelLeftClose size={24} />;
    }
    return isHovered ? <PanelRightClose size={24} /> : <Menu size={24} />;
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* 상단 토글 버튼 */}
      <div
        className="sidebar-toggle"
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={isOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        {getToggleIcon()}
      </div>

      {/* 메뉴 아이템 내비게이션 */}
      <nav className="sidebar-nav">
        {menuItems.map(item => {
          // 파일 로드 상태와 메뉴 ID에 따라 비활성화 여부 결정
          const isDisabled = !isFileLoaded && disabledMenuItems.includes(item.id);
          return (
            <div
              key={item.id}
              className={`sidebar-menu-item ${activeMenuItem === item.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleMenuClick(item.id)}
              title={!isOpen ? item.label : ''}
            >
              <div className="item-icon">{item.icon}</div>
              <span className="menu-label">{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* 하단 사용자 프로필 */}
      <UserProfile user={user} isOpen={isOpen} />
    </aside>
  );
}

export default Sidebar;