// client/src/components/viewer/FloatingToolbar.js

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Sun, Moon, Info, Star } from 'lucide-react';

const FloatingToolbar = ({
  onToggleInvert,
  isInverted,
  onOpenPanel,
  isInfoActive = false,
  // ⭐ 즐겨찾기 관련 추가 props
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const ToggleIcon = collapsed ? ChevronUp : ChevronDown;
  const iconColor = '#0e121b';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* 토글 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((prev) => !prev);
          }}
          style={{
            width: 80,
            height: 28,
            borderRadius: '6px 6px 0 0',
            border: '1px solid #e8ecf5',
            borderBottom: '1px solid #e8ecf5',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            marginBottom: collapsed ? 0 : -1,
            boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          }}
          title={collapsed ? '툴바 펼치기' : '툴바 숨기기'}
        >
          <ToggleIcon size={18} color={iconColor} strokeWidth={2} />
        </button>

        {/* 펼쳐진 본체 */}
        {!collapsed && (
          <div
            style={{
              minWidth: 260, // ⭐ 버튼 하나 늘어서 약간 넓게
              maxWidth: '90vw',
              height: 50,
              background: '#ffffff',
              border: '1px solid #e8ecf5',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* 반전 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleInvert?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: iconColor,
                cursor: 'pointer',
              }}
              title={isInverted ? '반전 끄기' : '반전 켜기'}
            >
              {isInverted ? (
                <Sun size={30} color={iconColor} strokeWidth={2.2} />
              ) : (
                <Moon size={30} color={iconColor} strokeWidth={2.2} />
              )}
            </button>

            {/* ⭐ 즐겨찾기 토글 버튼 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
            >
              <Star
                size={30}
                strokeWidth={2.2}
                // 꽉 찬 별 vs 빈 별
                color={isFavorite ? '#facc15' : '#9ca3af'}   // 노란색 vs 회색
                fill={isFavorite ? '#facc15' : 'none'}       // 채우기
                style={{
                  filter: isFavorite
                    ? 'drop-shadow(0 0 3px rgba(250, 204, 21, 0.7))'
                    : 'none',
                }}
              />
            </button>

            {/* 객체정보 패널 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPanel?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: iconColor,
                cursor: 'pointer',
              }}
              title="객체 정보 패널 열기"
            >
              <Info
                size={30}
                color={iconColor}
                strokeWidth={2.2}
                style={{
                  transform: 'translateY(1px)',
                  opacity: isInfoActive ? 1 : 0.3,
                  filter: isInfoActive
                    ? 'drop-shadow(0 0 2px rgba(0,0,0,0.2))'
                    : 'none',
                }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingToolbar;
