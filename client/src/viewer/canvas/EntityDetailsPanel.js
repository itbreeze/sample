/* eslint-env browser */
// client/src/components/viewer/EntityDetailsPanel.js

import React, { useEffect, useRef, useState } from 'react';
import { Minus, X } from 'lucide-react';
import { formatLayerName } from '../utils/layerName';

export const MIN_WIDTH = 700;
export const MIN_HEIGHT = 400;
const MAX_WIDTH_MARGIN = 40;
const MAX_HEIGHT_MARGIN = 80;
const INDICATOR_SIZE = 12;

const computeBottomRightPos = (width, height) => {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  return {
    x: Math.max(8, vw - width - 24),
    y: Math.max(8, vh - height - 40),
  };
};

const EntityDetailsPanel = ({
  entities,
  onClose,
  initialPosition,
  onPositionChange,
  initialSize,
  onSizeChange,
  onZoomToEntity,
  onColorOverride,
  onRestoreOriginal,
}) => {
  const panelRef = useRef(null);

  const [pos, setPos] = useState(initialPosition || computeBottomRightPos(MIN_WIDTH, MIN_HEIGHT));
  const [size, setSize] = useState(initialSize || { width: MIN_WIDTH, height: MIN_HEIGHT });
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedColorMap, setSelectedColorMap] = useState({});

  const draggingRef = useRef(null);
  const resizingRef = useRef(null); // { startX, startY, origW, origH, direction: 'right' | 'bottom' | 'corner' }

  const hasEntities = entities && entities.length > 0;

  //////////////////////////////////
  // 타입 카운트 / 필터 관련 계산
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

  // 현재 선택된 타입에 따라 필터링된 목록
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

  const renderColorSwatch = (color, label, meta = {}) => {
    const { colorType = null, indexColor = null, layerColor = null, trueColor = null } = meta;
    const isRgb =
      color &&
      typeof color === 'object' &&
      typeof color.r === 'number' &&
      typeof color.g === 'number' &&
      typeof color.b === 'number';
    const stringColor = typeof color === 'string' && color.trim().length > 0 ? color.trim() : null;
    const numericColor = Number.isFinite(indexColor)
      ? indexColor
      : Number.isFinite(color)
      ? color
      : null;

    const resolveIndexedColor = (idx) => {
      const palette = {
        0: '#000000',
        1: '#ff0000',
        2: '#ffff00',
        3: '#00ff00',
        4: '#00ffff',
        5: '#0000ff',
        6: '#ff00ff',
        7: '#ffffff',
      };
      if (idx in palette) return palette[idx];
      return '#e2e8f0';
    };

    const resolveLayerColor = () => {
      if (!layerColor) return null;
      if (
        typeof layerColor.r === 'number' &&
        typeof layerColor.g === 'number' &&
        typeof layerColor.b === 'number'
      ) {
        return `rgb(${layerColor.r},${layerColor.g},${layerColor.b})`;
      }
      return null;
    };

    const hasTrueColor =
      trueColor &&
      typeof trueColor.r === 'number' &&
      typeof trueColor.g === 'number' &&
      typeof trueColor.b === 'number';

    const rgbToUse = isRgb
      ? color
      : hasTrueColor
      ? trueColor
      : null;

    let labelText = '정보 없음';
    if (colorType === 'kColor' && rgbToUse) {
      labelText = `RGB Color (${rgbToUse.r}, ${rgbToUse.g}, ${rgbToUse.b})`;
    } else if (colorType === 'kIndexed' && numericColor !== null) {
      labelText = `Index Color (${numericColor})`;
    } else if (rgbToUse) {
      labelText = `RGB Color (${rgbToUse.r}, ${rgbToUse.g}, ${rgbToUse.b})`;
    } else if (numericColor !== null) {
      labelText = `Index Color (${numericColor})`;
    }

    const title = label ? `${label} ${labelText}` : labelText;

    return {
      swatchColor: null,
      labelText,
      title,
      borderColor: null,
    };
  };

  const renderColorCell = (
    color,
    label,
    { borderRight = null, colorType = null, indexColor = null } = {}
  ) => {
    const { swatchColor, labelText, title, borderColor } = renderColorSwatch(color, label, {
      colorType,
      indexColor,
    });

    return (
      <td
        style={{
          padding: '5px 8px',
          textAlign: 'left',
          verticalAlign: 'middle',
          borderRight: borderRight || undefined,
        }}
        title={title}
      >
        <span style={{ fontSize: 12, color: '#0f172a' }}>{labelText}</span>
      </td>
    );
  };

  const aciNames = {
    1: 'Red',
    2: 'Yellow',
    3: 'Green',
    4: 'Cyan',
    5: 'Blue',
    6: 'Magenta',
    7: 'White',
  };

  const baseColorOptions = [
    { value: 'rgb:0,0,0', label: 'Black' },
    ...Array.from({ length: 7 }, (_, i) => {
      const idx = i + 1; // 1~7
      const name = aciNames[idx] || `Index ${idx}`;
      return {
        value: `index:${idx}`,
        label: name,
        swatch:
          idx === 1 ? '#ff0000' :
          idx === 2 ? '#ffff00' :
          idx === 3 ? '#00ff00' :
          idx === 4 ? '#00ffff' :
          idx === 5 ? '#0000ff' :
          idx === 6 ? '#ff00ff' :
          idx === 7 ? '#ffffff' : '#e2e8f0',
      };
    }),
  ];

  const hasAnyRestorable = React.useMemo(
    () => Array.isArray(entities) && entities.some((ent) => ent?.hasColorChanged),
    [entities]
  );

  const renderLayerIndicator = (layerColor) => {
    let swatchColor = '#e2e8f0';
    let labelText = 'RGB Color 정보 없음';

    if (layerColor && typeof layerColor.r === 'number') {
      swatchColor = `rgb(${layerColor.r},${layerColor.g},${layerColor.b})`;
      labelText = `RGB Color (${layerColor.r}, ${layerColor.g}, ${layerColor.b})`;
    }

    const title = labelText;
    const borderColor = 'rgba(148, 163, 184, 0.5)';
    return (
      <div
        title={title}
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          minWidth: INDICATOR_SIZE,
          minHeight: INDICATOR_SIZE,
          boxSizing: 'border-box',
          borderRadius: 2,
          border: `1px solid ${borderColor}`,
          background: swatchColor,
          flexShrink: 0,
        }}
      />
    );
  };

  // 엔티티 목록이 바뀔 때 selectedType 보정
  useEffect(() => {
    if (!hasEntities) {
      setSelectedType('ALL');
      return;
    }

    if (selectedType === 'ALL') return;

    if (!typeMap[selectedType]) {
      // 현재 타입이 더 이상 없으면 ALL로 되돌림
      setSelectedType('ALL');
    }
  }, [hasEntities, selectedType, typeMap]);

  useEffect(() => {
    if (!entities) return;
    // 선택된 색상 상태를 현재 엔티티 목록 기준으로 정리 (마지막 선택 옵션 유지)
    setSelectedColorMap((prev) => {
      const next = {};
      for (const ent of entities) {
        const key = ent?.handle;
        if (key === undefined || key === null) continue;
        const lastOpt = ent.lastColorOption;
        if (key in prev) {
          // 이전 선택이 복구 옵션이면 기본값으로 리셋
          if (prev[key] === 'restore-initial') continue;
          next[key] = prev[key];
        } else if (lastOpt && lastOpt !== 'restore-initial') {
          next[key] = lastOpt;
        }
      }
      return next;
    });
  }, [entities]);

  // 기본 위치: 화면 오른쪽 하단
  useEffect(() => {
    if (initialPosition) {
      setPos(initialPosition);
    }
  }, [initialPosition]);

  useEffect(() => {
    if (initialSize) {
      setSize(initialSize);
    }
  }, [initialSize]);

  ////////////////////////////////
  // 드래그 이동(헤더)
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

    const next = { x: nextX, y: nextY };
    setPos(next);
    onPositionChange?.(next);
  };

  const onDragMouseUp = () => {
    draggingRef.current = null;
    window.removeEventListener('mousemove', onDragMouseMove);
    window.removeEventListener('mouseup', onDragMouseUp);
  };

  ////////////////////////////////
  // 크기 조절 (가로 & 세로 리사이즈)
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

    // 가로 리사이즈
    if (rs.direction === 'corner' || rs.direction === 'right') {
      nextW = Math.min(
        Math.max(MIN_WIDTH, rs.origW + dx),
        Math.max(MIN_WIDTH, maxW)
      );
    }

    // 세로 리사이즈
    if (rs.direction === 'corner' || rs.direction === 'bottom') {
      nextH = Math.min(
        Math.max(MIN_HEIGHT, rs.origH + dy),
        Math.max(MIN_HEIGHT, maxH)
      );
    }

    const nextSize = { width: nextW, height: nextH };
    setSize(nextSize);
    onSizeChange?.(nextSize);
  };

  const onResizeMouseUp = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onResizeMouseMove);
    window.removeEventListener('mouseup', onResizeMouseUp);
  };

  // 우측/하단/코너 공통 리사이즈 핸들 생성 함수
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
          background:
            'linear-gradient(90deg, rgba(96, 165, 250, 0.75), rgba(59, 130, 246, 0.75))',
          backdropFilter: 'blur(4px)',
          color: '#ffffff',
          cursor: 'move',
          userSelect: 'none',
          borderBottom: '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            객체 정보 ({totalCount})
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* 반전 버튼 제거 (툴바에서 제어) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasAnyRestorable) {
              onRestoreOriginal?.();
            }
          }}
          style={{
            border: `1px solid ${hasAnyRestorable ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.15)'}`,
            background: hasAnyRestorable ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            color: hasAnyRestorable ? '#ffffff' : 'rgba(255,255,255,0.5)',
            padding: '4px 10px',
            cursor: hasAnyRestorable ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: -0.2,
            marginLeft: 6,
          }}
          onMouseEnter={(e) => {
            if (!hasAnyRestorable) return;
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            if (!hasAnyRestorable) return;
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          title={hasAnyRestorable ? '변경된 색상을 원본으로 복구' : '복구할 색상 변경 없음'}
        >
          복구
        </button>

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
            marginLeft: 6,
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
            minHeight: 0, // flex 컨테이너 안에서 스크롤 영역 확보
          }}
        >
          {!hasEntities ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#64748b',
              }}
            >
              선택된 엔티티가 없습니다.
            </div>
          ) : (
            <>
              {/* 타입 필터 셀렉트 */}
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
                    fontSize: 14,
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
                  minHeight: 0,
                }}
              >
                {/* 스크롤 테이블 영역 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    padding: '8px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      fontSize: 13,
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
                            verticalAlign: 'middle',
                            width: 30,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          번호
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 60,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          요소명
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 60,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          핸들
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 80,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          도면층
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 100,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          색상
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 110,
                            fontWeight: 600,
                            color: '#475569',
                            borderRight: '1px solid rgba(203, 213, 225, 0.6)',
                          }}
                        >
                          복구/설정
                        </th>
                        <th
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            width: 50,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          줌
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEntities.map((ent, idx) => {
                        const typeLabel =
                          ent.type === 'INSERT'
                            ? 'INSERT'
                            : ent.type === 'ENTITY'
                            ? 'ENTITY'
                            : ent.type || 'UNKNOWN';

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
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                                verticalAlign: 'middle',
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
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                                verticalAlign: 'middle',
                              }}
                              title={typeLabel}
                            >
                              {typeLabel}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                color: '#0f172a',
                                fontWeight: 500,
                                wordBreak: 'break-all',
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                                verticalAlign: 'middle',
                              }}
                              title={String(ent.handle || '')}
                            >
                              {ent.handle}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                color: '#1e293b',
                                verticalAlign: 'middle',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                              }}
                              title={formatLayerName(ent.layer)}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {renderLayerIndicator(ent.layerColor)}
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatLayerName(ent.layer)}
                                </span>
                              </div>
                            </td>
                            {renderColorCell(ent.objectColor, '색상', {
                              borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                              colorType: ent.colorType,
                              indexColor: ent.indexColor,
                              layerColor: ent.layerColor,
                              trueColor: ent.trueColor,
                            })}
                            <td
                              style={{
                                padding: '5px 8px',
                                verticalAlign: 'middle',
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)',
                              }}
                            >
                              <select
                                value={selectedColorMap[ent.handle] ?? ent.lastColorOption ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedColorMap((prev) => ({
                                    ...prev,
                                    [ent.handle]: val === 'restore-initial' ? '' : val,
                                  }));
                                  if (val && onColorOverride) onColorOverride(ent.handle, val);
                                }}
                                style={{
                                  width: '100%',
                                  background: 'rgba(255, 255, 255, 0.85)',
                                  color: '#0f172a',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  borderRadius: 4,
                                  padding: '4px 6px',
                                  fontSize: 12,
                                  outline: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="" disabled hidden>
                                  색상 선택
                                </option>
                                {(() => {
                                  const opts = [];
                                  if (ent.hasColorChanged) {
                                    opts.push({ value: 'restore-initial', label: '원본 복구' });
                                  }
                                  opts.push(...baseColorOptions);
                                  return opts;
                                })().map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onZoomToEntity?.(ent.entityId);
                                }}
                                style={{
                                  border: '1px solid rgba(15, 23, 42, 0.2)',
                                  borderRadius: 4,
                                  background: '#2563eb',
                                  color: '#fff',
                                  padding: '3px 8px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                                title="확대"
                              >
                                확대
                              </button>
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

      {/* 크기 조절 바 (가로 핸들) */}
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

      {/* 크기 조절 바 (세로 핸들) */}
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

      {/* 크기 조절 코너 (우하단 핸들) */}
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

export default EntityDetailsPanel;
