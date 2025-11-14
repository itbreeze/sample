/* eslint-env browser */
// client/src/components/viewer/EntityPanel.js

import React, { useEffect, useRef, useState } from 'react';
import { Minus, X } from 'lucide-react';

const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;
const MAX_WIDTH_MARGIN = 40;
const MAX_HEIGHT_MARGIN = 80;

const EntityPanel = ({ entities, onClose }) => {
  const panelRef = useRef(null);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: MIN_WIDTH, height: MIN_HEIGHT });
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedType, setSelectedType] = useState('ALL');

  const draggingRef = useRef(null);
  const resizingRef = useRef(null); // { startX, startY, origW, origH, direction: 'right' | 'bottom' | 'corner' }

  const hasEntities = entities && entities.length > 0;

  //////////////////////////////////
  // 타입별 집계 및 필터 옵션
  //////////////////////////////////
  const typeMap = React.useMemo(() => {
    const map = {};
    if (!entities) return map;

    for (const ent of entities) {
      const t =
        ent?.type === 'INSERT'
          ? 'INSERT'
          : ent?.type === 'ENTITY'
          ? 'ENTITY'
          : ent?.type || 'UNKNOWN';

      if (!map[t]) map[t] = { count: 0 };
      map[t].count += 1;
    }
    return map;
  }, [entities]);

  const totalCount = entities?.length || 0;
  const typeKeys = Object.keys(typeMap);

  const comboOptions =
    totalCount === 0
      ? [{ value: 'ALL', label: '전체 (0)' }]
      : [
          { value: 'ALL', label: `전체 (${totalCount})` },
          ...typeKeys.map((t) => ({
            value: t,
            label: `${t} (${typeMap[t].count})`,
          })),
        ];

  // 현재 선택된 타입에 따른 표시 목록
  const visibleEntities =
    selectedType === 'ALL'
      ? entities || []
      : (entities || []).filter((ent) => {
          const t =
            ent?.type === 'INSERT'
              ? 'INSERT'
              : ent?.type === 'ENTITY'
              ? 'ENTITY'
              : ent?.type || 'UNKNOWN';
          return t === selectedType;
        });

  // 엔티티 집합이 바뀌었을 때, selectedType 보정
  useEffect(() => {
    if (!hasEntities) {
      setSelectedType('ALL');
      return;
    }

    if (selectedType === 'ALL') return;

    if (!typeMap[selectedType]) {
      // 현재 타입이 사라졌으면 ALL로
      setSelectedType('ALL');
    }
  }, [hasEntities, selectedType, typeMap]);

  // 최초 위치: 화면 우측 하단
  useEffect(() => {
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    setPos({
      x: vw - size.width - 24,
      y: vh - size.height - 40,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  ////////////////////////////////
  // 드래그 (헤더)
  ////////////////////////////////
  const onHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    window.addEventListener('mousemove', onDragMouseMove);
    window.addEventListener('mouseup', onDragMouseUp);
  };

  const onDragMouseMove = (e) => {
    const drag = draggingRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;

    const nextX = Math.min(Math.max(8, drag.origX + dx), vw - 100);
    const nextY = Math.min(Math.max(8, drag.origY + dy), vh - 60);

    setPos({ x: nextX, y: nextY });
  };

  const onDragMouseUp = () => {
    draggingRef.current = null;
    window.removeEventListener('mousemove', onDragMouseMove);
    window.removeEventListener('mouseup', onDragMouseUp);
  };

  ////////////////////////////////
  // 크기 조절 (우측 & 하단 가장자리)
  ////////////////////////////////
  const onResizeMouseMove = (e) => {
    const rs = resizingRef.current;
    if (!rs) return;

    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;

    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;

    const maxW = vw - pos.x - MAX_WIDTH_MARGIN;
    const maxH = vh - pos.y - MAX_HEIGHT_MARGIN;

    let nextW = rs.origW;
    let nextH = rs.origH;

    // 가로 조절
    if (rs.direction === 'corner' || rs.direction === 'right') {
      nextW = Math.min(
        Math.max(MIN_WIDTH, rs.origW + dx),
        Math.max(MIN_WIDTH, maxW)
      );
    }

    // 세로 조절
    if (rs.direction === 'corner' || rs.direction === 'bottom') {
      nextH = Math.min(
        Math.max(MIN_HEIGHT, rs.origH + dy),
        Math.max(MIN_HEIGHT, maxH)
      );
    }

    setSize({ width: nextW, height: nextH });
  };

  const onResizeMouseUp = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onResizeMouseMove);
    window.removeEventListener('mouseup', onResizeMouseUp);
  };

  // 방향별 마우스 다운 핸들러 생성 함수
  const createResizeHandler = (direction) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.width,
      origH: size.height,
      direction: direction,
    };
    window.addEventListener('mousemove', onResizeMouseMove);
    window.addEventListener('mouseup', onResizeMouseUp);
  };

  const onResizeRightMouseDown = createResizeHandler('right');
  const onResizeBottomMouseDown = createResizeHandler('bottom');
  const onResizeCornerMouseDown = createResizeHandler('corner');

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onDragMouseMove);
      window.removeEventListener('mouseup', onDragMouseUp);
      window.removeEventListener('mousemove', onResizeMouseMove);
      window.removeEventListener('mouseup', onResizeMouseUp);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: isMinimized ? 'auto' : size.height,
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
        borderRadius: 8,
        border: '1px solid rgba(96, 165, 250, 0.4)',
        background: 'rgba(239, 246, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 (드래그 영역) */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'linear-gradient(90deg, rgba(96, 165, 250, 0.75), rgba(59, 130, 246, 0.75))',
          backdropFilter: 'blur(4px)',
          color: '#ffffff',
          cursor: 'move',
          userSelect: 'none',
          borderBottom: '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            객체 정보 ({totalCount})
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized((v) => !v);
          }}
          style={{
            border: 'none',
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            padding: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          title={isMinimized ? '펼치기' : '최소화'}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
          }}
          style={{
            border: 'none',
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            padding: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            marginLeft: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          title="닫기"
        >
          <X size={14} />
        </button>
      </div>

      {/* 내용 영역 */}
      {!isMinimized && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 12px',
            background: 'transparent',
            minHeight: 0, // flex 자식이 스크롤되도록 허용
          }}
        >
          {!hasEntities ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#64748b',
              }}
            >
              선택된 엔티티가 없습니다.
            </div>
          ) : (
            <>
              {/* 타입 필터 드롭다운 */}
              <div style={{ marginBottom: 8 }}>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.7)',
                    color: '#0f172a',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 12,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {comboOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  flex: 1,
                  borderRadius: 6,
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  background: 'rgba(255, 255, 255, 0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 0, // flex 자식이 스크롤되도록 허용
                }}
              >
                {/* 스크롤 영역 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'scroll', // 항상 스크롤바 표시
                    overflowX: 'hidden',
                    padding: '8px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      fontSize: 11,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: 'rgba(241, 245, 249, 0.9)',
                          borderBottom: '1px solid rgba(203, 213, 225, 0.6)',
                        }}
                      >
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            width: 50,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          번호
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            width: 90,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          요소명
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          핸들
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            width: 100,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          레이어
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'center',
                            width: 70,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          컬러
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEntities.map((ent, idx) => {
                        const color = ent.color;
                        const isRgb =
                          color &&
                          typeof color === 'object' &&
                          typeof color.r === 'number' &&
                          typeof color.g === 'number' &&
                          typeof color.b === 'number';

                        const colorSwatch = isRgb
                          ? `rgb(${color.r},${color.g},${color.b})`
                          : '#ef4444';

                        const typeLabel =
                          ent.type === 'INSERT'
                            ? 'INSERT'
                            : ent.type === 'ENTITY'
                            ? 'ENTITY'
                            : ent.type || 'UNKNOWN';

                        const colorTitle = isRgb
                          ? `RGB(${color.r}, ${color.g}, ${color.b})`
                          : '색상 정보 없음';

                        return (
                          <tr
                            key={`${ent.handle}-${idx}`}
                            style={{
                              borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
                            }}
                          >
                            <td
                              style={{
                                padding: '5px 8px',
                                color: '#64748b',
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                color: '#0f172a',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={typeLabel}
                            >
                              {typeLabel}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                color: '#111827',
                                fontSize: 10,
                              }}
                              title={String(ent.handle || '')}
                            >
                              {ent.handle}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                color: '#1e293b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={ent.layer || ''}
                            >
                              {ent.layer || ''}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  margin: '0 auto',
                                  background: colorSwatch,
                                  border: '1px solid rgba(15, 23, 42, 0.3)',
                                  borderRadius: 3,
                                  boxSizing: 'border-box',
                                }}
                                title={colorTitle}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 크기 조절 영역 (우측 가장자리) */}
      {!isMinimized && (
        <div
          onMouseDown={onResizeRightMouseDown}
          style={{
            position: 'absolute',
            right: 0,
            top: 32,
            bottom: 0,
            width: 8,
            cursor: 'ew-resize',
            background: 'transparent',
          }}
          title="가로 크기 조절"
        />
      )}

      {/* 크기 조절 영역 (하단 가장자리) */}
      {!isMinimized && (
        <div
          onMouseDown={onResizeBottomMouseDown}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 8,
            cursor: 'ns-resize',
            background: 'transparent',
          }}
          title="세로 크기 조절"
        />
      )}

      {/* 크기 조절 영역 (우측 하단 모서리) */}
      {!isMinimized && (
        <div
          onMouseDown={onResizeCornerMouseDown}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            background: 'transparent',
          }}
          title="크기 조절"
        />
      )}
    </div>
  );
};

export default EntityPanel;