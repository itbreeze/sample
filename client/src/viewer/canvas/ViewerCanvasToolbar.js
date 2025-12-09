// client/src/components/viewer/ViewerCanvasToolbar.js

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Sun, Moon, Info, Star, Fullscreen, Palette } from 'lucide-react';
import './ViewerCanvasToolbar.css';

const ViewerCanvasToolbar = ({
  onToggleInvert,
  isInverted,
  onOpenPanel,
  isInfoActive = false,
  onZoomExtents,
  // ⭐ 즐겨찾기 관련 추가 props
  isFavorite = false,
  onToggleFavorite,
  showEntityInfoButton = true,
  isColorfulMode = false,
  onToggleColorMode,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const ToggleIcon = collapsed ? ChevronUp : ChevronDown;
  const toolbarRadius = 6;

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
            borderRadius: `${toolbarRadius}px ${toolbarRadius}px 0 0`,
            border: '1px solid var(--border-color-dark)',
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
          <ToggleIcon size={18} color="#0e121b" strokeWidth={2} />
        </button>

        {/* 펼쳐진 본체 */}
        {!collapsed && (
          <div
            style={{
              minWidth: 260, // ⭐ 버튼 하나 늘어서 약간 넓게
              maxWidth: '90vw',
              height: 50,
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid var(--border-color-dark)',
              borderTop: 'none',
              borderRadius: `0 0 ${toolbarRadius}px ${toolbarRadius}px`,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 16px',
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.18)',
            }}
          >
            {/* 전체 보기 */}
            <button
              type="button"
              className="viewer-canvas-toolbar__button"
              onClick={(e) => {
                e.stopPropagation();
                onZoomExtents?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title="전체 보기 (Zoom Extents)"
            >
              <Fullscreen size={28} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="viewer-canvas-toolbar__button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleColorMode?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title={isColorfulMode ? '색상 끔' : '색상 켬'}
            >
              <Palette size={28} strokeWidth={2.2} color={isColorfulMode ? '#facc15' : '#9ca3af'} />
            </button>
            {/* 반전 */}
            <button
              type="button"
              className="viewer-canvas-toolbar__button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleInvert?.();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title={isInverted ? '반전 끄기' : '반전 켜기'}
            >
              {isInverted ? (
                <Sun size={30} strokeWidth={2.2} />
              ) : (
                <Moon size={30} strokeWidth={2.2} />
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
            {showEntityInfoButton && (
              <button
                type="button"
                className="viewer-canvas-toolbar__button viewer-canvas-toolbar__button--info"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPanel?.();
                }}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                title="객체 정보 패널 열기"
              >
                <Info
                  size={30}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewerCanvasToolbar;
