import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './CanvasLoadingOverlay.css';

/**
 * 전체 화면 로딩 오버레이 (전역)
 * @param {boolean} visible - true면 표시
 * @param {number} percent - 진행률 (0~100)
 * @param {string} text - 기본 문구
 */
const CanvasLoadingOverlay = ({ visible, percent = 0, text = '도면을 불러오는 중입니다...' }) => {
  const [displayPercent, setDisplayPercent] = useState(percent);

  // Hook은 항상 호출해야 하므로 조건문 밖에서 선언
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  // 퍼센트 표시를 부드럽게 보간
  useEffect(() => {
    if (!visible) {
      setDisplayPercent(0);
      return;
    }

    // 새 로딩이 시작되어 퍼센트가 초기화된 경우 즉시 낮춰줌
    setDisplayPercent((prev) => (percent < prev ? percent : prev));

    let rafId;
    const animate = () => {
      setDisplayPercent((prev) => {
        const target = Math.min(100, percent);
        if (target <= prev) return target;

        const delta = Math.max(0.5, (target - prev) * 0.15);
        const next = Math.min(prev + delta, target);
        if (next < target) {
          rafId = requestAnimationFrame(animate);
        }
        return next;
      });
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [percent, visible]);

  if (!visible || typeof document === 'undefined') return null;

  const safePercent = Math.min(100, displayPercent);

  return createPortal(
    <div className="global-loading-overlay" role="status" aria-live="polite">
      <div className="global-loading-content">
        <div className="loading-text">
          {text} {Math.floor(safePercent)}%
        </div>
        <div className="progress-wrap" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${safePercent}%` }} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CanvasLoadingOverlay;
