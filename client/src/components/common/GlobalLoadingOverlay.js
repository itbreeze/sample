import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * 전체 화면 로딩 오버레이 (전역)
 * @param {boolean} visible - true면 표시
 * @param {number} percent - 진행률 (0~100)
 * @param {string} text - 기본 문구
 */
const GlobalLoadingOverlay = ({ visible, percent = 0, text = '도면을 불러오는 중입니다...' }) => {
  // Hook은 항상 호출해야 하므로 조건문 밖에서 선언
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="global-loading-overlay" role="status" aria-live="polite">
      <div className="global-loading-content">
        <div className="spinner" />
        <div className="loading-text">
          {text} {Math.floor(percent)}%
        </div>
        <div className="progress-wrap" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalLoadingOverlay;
