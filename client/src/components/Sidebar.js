import React, { useState } from 'react';
import UserProfile from './UserProfile';
import './Sidebar.css';
import { Menu, PanelLeftClose, PanelRightClose } from 'lucide-react';

function Sidebar({ user, isOpen, setIsOpen, menuItems, activeMenuItem, onMenuItemClick }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMenuClick = (id) => {
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
    } else {
      if (!activeMenuItem && menuItems.length > 0) {
        onMenuItemClick(menuItems[0].id);
      }
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
        {menuItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-menu-item ${activeMenuItem === item.id ? 'active' : ''}`}
            onClick={() => handleMenuClick(item.id)}
            title={!isOpen ? item.label : ''}
          >
            <div className="item-icon">{item.icon}</div>
            <span className="menu-label">{item.label}</span>
          </div>
        ))}
      </nav>

    <UserProfile user={user} isOpen={isOpen} />

    </aside>
  );
}

export default Sidebar;