import React from 'react';
import { User } from 'lucide-react';
import './UserProfile.css';

/**
 * 사용자 프로필 정보를 표시하는 컴포넌트
 * @param {object} user - 사용자 정보 객체
 * @param {boolean} isOpen - 사이드바 확장 여부
 */
const UserProfile = ({ user, isOpen }) => {
  // 사용자 정보가 없으면 아무것도 렌더링하지 않음
  if (!user) {
    return null;
  }

  return (
    <div className={`user-profile-container ${isOpen ? 'open' : ''}`}>
      {/* 사용자 아이콘 */}
      <div className="user-icon-wrapper">
        <User size={24} />
      </div>

      {/* 사용자 상세 정보 (확장 시 표시) */}
      <div className="user-info">
        <span className="user-name">안녕하세요. {user.userName}님</span>
        <span className="user-position">{user.department}/{user.positionName}</span>
      </div>
    </div>
  );
};

export default UserProfile;
