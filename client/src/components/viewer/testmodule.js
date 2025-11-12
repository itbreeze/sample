import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Minus, X } from 'lucide-react';
import './testmodule.css';

const POS_KEY = 'testmodule_pos';
const MIN_KEY = 'testmodule_min';

// 선택 엔티티에서 타입/핸들/레이어 정보를 안전하게 추출
const extractInfo = (entityId) => {
  try {
    const t = entityId.getType?.();
    let type = 'UNKNOWN';
    let obj = null;
    if (t === 1) { type = 'ENTITY'; obj = entityId.openObject?.(); }
    else if (t === 2) { type = 'INSERT'; obj = entityId.openObjectAsInsert?.(); }
    else { type = String(t ?? 'UNKNOWN'); obj = entityId.openObject?.(); }
    
    const handle = obj?.getNativeDatabaseHandle?.() ?? null;
    let layer = null;
    try { layer = obj?.getLayer?.()?.openObject?.()?.getName?.() ?? null; } catch { }
    
    return { type, handle, layer };
  } catch {
    return { type: 'UNKNOWN', handle: null, layer: null };
  }
};

const TestModule = ({ pollMs = 300, style, lastMouse }) => {
  const [count, setCount] = useState(0);
  const [typeMap, setTypeMap] = useState({});
  const [selectedType, setSelectedType] = useState('ALL');
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [userClosed, setUserClosed] = useState(false);
  
  const dragStartRef = useRef({ dx: 0, dy: 0 });
  const hasPositionedRef = useRef(false);
  const containerRef = useRef(null);

  // 저장된 위치/최소화 상태 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        // 유효한 위치인지 확인
        if (p?.x > 0 && p?.y > 0 && 
            p.x < window.innerWidth - 100 && p.y < window.innerHeight - 100) {
          setPos(p);
          hasPositionedRef.current = true;
        } else {
          localStorage.removeItem(POS_KEY);
        }
      }
      const smin = localStorage.getItem(MIN_KEY);
      if (smin != null) setMinimized(smin === '1');
    } catch { }
  }, []);

  // 위치 저장 (드래그가 끝났을 때만)
  useEffect(() => { 
    if (pos && hasPositionedRef.current && !dragging) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { } 
    }
  }, [pos, dragging]);
  
  useEffect(() => { 
    try { localStorage.setItem(MIN_KEY, minimized ? '1' : '0'); } catch { } 
  }, [minimized]);

  // 선택 집계
  const readSelection = useCallback(() => {
    try {
      const viewer = window.currentViewerInstance;
      if (!viewer) { setCount(0); setTypeMap({}); return; }
      
      const pSelected = viewer.getSelected?.();
      if (!pSelected || pSelected.isNull?.()) { setCount(0); setTypeMap({}); return; }
      
      const it = pSelected.getIterator?.();
      const map = {};
      const seen = {};
      
      while (it && !it.done()) {
        const entityId = it.getEntity?.();
        if (entityId && !entityId.isNull?.()) {
          const info = extractInfo(entityId);
          if (info.handle != null) {
            if (!map[info.type]) {
              map[info.type] = [];
              seen[info.type] = new Set();
            }
            const hk = String(info.handle);
            if (!seen[info.type].has(hk)) {
              map[info.type].push({ handle: hk, layer: info.layer ?? '-' });
              seen[info.type].add(hk);
            }
          }
        }
        it.step?.();
      }
      
      const total = Object.values(map).reduce((a, arr) => a + arr.length, 0);
      setTypeMap(map);
      setCount(total);
      
      if (total === 1) {
        setSelectedType(Object.keys(map)[0]);
      } else if (selectedType !== 'ALL' && !map[selectedType]) {
        setSelectedType('ALL');
      }
    } catch {
      setCount(0);
      setTypeMap({});
    }
  }, [selectedType]);

  useEffect(() => {
    const timer = setInterval(readSelection, pollMs);
    readSelection();
    return () => clearInterval(timer);
  }, [pollMs, readSelection]);

  // 선택 시 자동 표시
  useEffect(() => {
    if (!userClosed && hidden && count > 0) {
      setHidden(false);
    }
  }, [userClosed, hidden, count]);

  // 선택 해제 시 userClosed 리셋
  useEffect(() => {
    if (count === 0 && userClosed) {
      setUserClosed(false);
    }
  }, [count, userClosed]);

  // 마우스 근처 위치 계산
  useEffect(() => {
    if (hidden || hasPositionedRef.current) return;

    const timer = setTimeout(() => {
      const OFFSET = 15;
      const mx = lastMouse?.x ?? window.innerWidth / 2;
      const my = lastMouse?.y ?? window.innerHeight / 2;
      const node = containerRef.current;
      
      if (!node) return;

      requestAnimationFrame(() => {
        const { width: w = 500, height: h = 220 } = node.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let nx = mx + OFFSET;
        let ny = my + OFFSET;

        // 경계 체크
        if (nx + w > vw - 8) nx = mx - w - OFFSET;
        if (nx < 8) nx = 8;
        if (ny + h > vh - 8) ny = my - h - OFFSET;
        if (ny < 8) ny = 8;

        setPos({ x: nx, y: ny });
        hasPositionedRef.current = true;
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [hidden, lastMouse]);

  // 드래그
  const onDragStart = useCallback((e) => {
    if (!pos) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    
    const onMove = (e) => setPos({
      x: Math.max(0, e.clientX - dragStartRef.current.dx),
      y: Math.max(0, e.clientY - dragStartRef.current.dy)
    });
    const onUp = () => setDragging(false);
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // 선택 해제
  const handleRemoveItem = useCallback((handle) => {
    const viewer = window.currentViewerInstance;
    const pSelected = viewer?.getSelected?.();
    if (!viewer || !pSelected || pSelected.isNull?.()) return;
    
    const itr = pSelected.getIterator?.();
    while (itr && !itr.done?.()) {
      const entityId = itr.getEntity?.();
      if (!entityId || entityId.isNull?.()) { itr.step?.(); continue; }
      
      const info = extractInfo(entityId);
      if (info.handle === handle) {
        const obj = entityId.openObject?.() ?? entityId;
        const methods = ['setIsSelected', 'setSelectionState', 'setActive', 'setHighlighted', 'setIsHighlighted'];
        for (const method of methods) {
          try { obj?.[method]?.(false); } catch { }
        }
        viewer.update?.();
        readSelection();
        return;
      }
      itr.step?.();
    }
  }, [readSelection]);

  // 콤보박스 옵션 생성
  const comboOptions = count === 0 
    ? [{ value: 'ALL', label: '전체 (0)' }]
    : count === 1
    ? [{ value: 'ALL', label: '전체 (1)' }, { value: Object.keys(typeMap)[0], label: Object.keys(typeMap)[0] }]
    : [
        { value: 'ALL', label: `전체 (${count})` },
        ...Object.keys(typeMap).map(t => ({ value: t, label: `${t} (${typeMap[t].length})` }))
      ];

  const currentItems = selectedType === 'ALL' ? [] : (typeMap[selectedType] || []);

  if (hidden) return null;

  return (
    <div ref={containerRef} style={{
      position: 'absolute',
      left: pos?.x ?? 0,
      top: pos?.y ?? 0,
      opacity: pos ? 1 : 0,
      zIndex: 50,
      background: 'rgba(16,185,129,0.92)',
      color: '#ffffff',
      border: '1px solid rgba(5,150,105,0.9)',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(5,150,105,0.45)',
      pointerEvents: 'auto',
      userSelect: 'none',
      width: 500,
      ...style,
    }} aria-live="polite">
      
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        cursor: dragging ? 'grabbing' : 'grab'
      }} onMouseDown={onDragStart} title="드래그로 이동">
        선택정보
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized(m => !m)}
            style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
            aria-label={minimized ? '펼치기' : '최소화'}
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { setHidden(true); setUserClosed(true); }}
            style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      {!minimized && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{
              background: 'rgba(5,150,105,0.25)',
              color: '#ecfdf5',
              border: '1px solid rgba(16,185,129,0.8)',
              borderRadius: 6,
              padding: '4px 6px',
              fontSize: 12
            }}
            className="testmodule-dropdown"
          >
            {comboOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {selectedType !== 'ALL' && currentItems.length > 0 && (
            <div style={{
              maxHeight: 140,
              overflow: 'auto',
              background: 'rgba(5,150,105,0.35)',
              borderRadius: 6,
              padding: 6
            }}>
              <div style={{ marginBottom: 6, fontSize: 12, fontWeight: '500', borderBottom: '1px solid yellow', paddingBottom: 5 }}>
                객체정보
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.6)', fontSize: 12 }}>Handle</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.6)', fontSize: 12 }}>Layer</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.6)', fontSize: 12 }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((it) => (
                    <tr key={it.handle}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.3)', fontSize: 12, fontFamily: 'monospace' }}>{it.handle}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.3)', fontSize: 12 }}>{it.layer}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.3)', fontSize: 12 }}>
                        <button 
                          type="button" 
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239,68,68,0.8)',
                            color: '#fee2e2',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 11,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleRemoveItem(it.handle)}
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {count === 0 && (
            <div style={{ opacity: 0.95, fontSize: 12 }}>선택요소가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestModule;