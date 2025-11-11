import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Minus, X } from 'lucide-react';

const POS_KEY = 'testmodule_pos';
const MIN_KEY = 'testmodule_min';



// 선택 엔티티에서 타입/핸들/레이어/색상 정보를 안전하게 추출
const extractInfo = (entityId) => {
  try {
    const t = entityId.getType?.();
    let type = 'UNKNOWN';
    let obj = null;
    if (t === 1) { type = 'ENTITY'; obj = entityId.openObject?.(); }
    else if (t === 2) { type = 'INSERT'; obj = entityId.openObjectAsInsert?.(); }
    else { type = String(t ?? 'UNKNOWN'); obj = entityId.openObject?.(); }
    const handle = obj?.getNativeDatabaseHandle?.() ?? null;
    // 레이어/색상은 라이브러리 제공 여부에 따라 방어적으로 접근
    let layer = null;
    try { layer = obj?.getLayer?.()?.openObject?.()?.getName?.() ?? null; } catch {}
    let color = null;
    return { type, handle, layer, color };
  } catch {
    return { type: 'UNKNOWN', handle: null, layer: null, color: null };
  }
};

const TestModule = ({ pollMs = 300, style }) => {
  const [count, setCount] = useState(0);
  // { TYPE: Array<{ handle, layer, color }> }
  const [typeMap, setTypeMap] = useState({});
  const [selectedType, setSelectedType] = useState('ALL');
  const [pos, setPos] = useState({ x: 1200, y: 600 });
  const [useRightBottom, setUseRightBottom] = useState(true); // 초기엔 우하단 앵커
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  // 처음에는 선택정보창을 숨김; 선택 발생 시 자동 표시
  const [hidden, setHidden] = useState(true);
  // 사용자가 닫기 버튼으로 명시적으로 닫았는지 여부
  const [userClosed, setUserClosed] = useState(false);
  const dragStartRef = useRef({ dx: 0, dy: 0 });

  // 저장된 위치/최소화 상태 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') setPos(p);
        setUseRightBottom(false);
      }
      const smin = localStorage.getItem(MIN_KEY);
      if (smin != null) setMinimized(smin === '1');
    } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }, [pos]);
  useEffect(() => { try { localStorage.setItem(MIN_KEY, minimized ? '1' : '0'); } catch {} }, [minimized]);

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
            if (!map[info.type]) map[info.type] = [];
            if (!seen[info.type]) seen[info.type] = new Set();
            const hk = String(info.handle);
            if (!seen[info.type].has(hk)) {
              map[info.type].push({ handle: hk, layer: info.layer ?? '-', color: info.color ?? '-' });
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
        const onlyType = Object.keys(map)[0];
        if (onlyType) setSelectedType(onlyType);
      } else if (selectedType !== 'ALL' && !map[selectedType]) {
        setSelectedType('ALL');
      }
    } catch {
      setCount(0);
      setTypeMap({});
    }
  }, [selectedType]);

  useEffect(() => {
    const t = setInterval(readSelection, pollMs);
    readSelection();
    return () => clearInterval(t);
  }, [pollMs, readSelection]);

  // 선택이 존재하면(>0) 자동으로 패널을 보여주되,
  // 사용자가 닫기를 누른 이후에는 다시 자동으로 열지 않음
  useEffect(() => {
    if (!userClosed && hidden && count > 0) {
      setHidden(false);
    }
  }, [userClosed, hidden, count]);

  // 선택이 모두 해제되면(userClosed 리셋) 다음 선택 시 다시 자동 표시 허용
  useEffect(() => {
    if (count === 0 && userClosed) {
      setUserClosed(false);
    }
  }, [count, userClosed]);

  // 닫힘 상태에서 선택 생기면 자동 표시
  // 기존 자동 열림 효과 제거됨: userClosed를 고려하는 위 효과만 사용

  // 드래그 이동
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    setUseRightBottom(false);
    dragStartRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setPos({ x: Math.max(0, e.clientX - dragStartRef.current.dx), y: Math.max(0, e.clientY - dragStartRef.current.dy) });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // 스타일 (초록 계열, 폭 300 고정)
  const containerStyle = {
    position: 'absolute',
    ...(useRightBottom ? { right: 12, bottom: 12 } : { left: pos.x, top: pos.y }),
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
    width: 300,
    ...style,
  };
  const headerStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: dragging ? 'grabbing' : 'grab' };
  const selectStyle = { background: 'rgba(5,150,105,0.25)', color: '#ecfdf5', border: '1px solid rgba(16,185,129,0.8)', borderRadius: 6, padding: '4px 6px', fontSize: 12 };
  const tableHeaderCell = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.6)', fontSize: 12 };
  const tableCell = { padding: '6px 8px', borderBottom: '1px solid rgba(16,185,129,0.3)', fontSize: 12 };
  const listBoxStyle = { maxHeight: 140, overflow: 'auto', background: 'rgba(5,150,105,0.35)', borderRadius: 6, padding: 6 };

  // 헤더: 좌측 타이틀, 우측 버튼(최소화 → 닫기 순서)
  const Header = () => (
    <div style={headerStyle} onMouseDown={onDragStart} title="드래그로 이동">
      선택정보
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onMouseDown={(e)=>{e.stopPropagation(); e.preventDefault();}} onClick={(e)=>{e.stopPropagation(); setMinimized(m=>!m);}} style={{ background:'transparent', color:'#fff', border:'none', cursor:'pointer', padding: 2, lineHeight: 0 }} aria-label={minimized ? '펼치기' : '최소화'} title={minimized ? '펼치기' : '최소화'}>
          <Minus size={14} />
        </button>
        <button type="button" onMouseDown={(e)=>{e.stopPropagation(); e.preventDefault();}} onClick={(e)=>{e.stopPropagation(); setHidden(true); setUserClosed(true);}} style={{ background:'transparent', color:'#fff', border:'none', cursor:'pointer', padding: 2, lineHeight: 0 }} aria-label="닫기" title="닫기">
          <X size={14} />
        </button>
      </div>
    </div>
  );

  // 콤보박스: 전체(N) + 타입별 항목
  let comboOptions = [];
  const total = count;
  if (total === 0) {
    comboOptions = [{ value: 'ALL', label: '전체 (0)' }];
    if (selectedType !== 'ALL') setSelectedType('ALL');
  } else if (total === 1) {
    const t = Object.keys(typeMap)[0];
    comboOptions = [{ value: 'ALL', label: '전체 (1)' }, { value: t, label: t }];
    if (!['ALL', t].includes(selectedType)) setSelectedType('ALL');
  } else {
    const types = Object.keys(typeMap).map(t => ({ value: t, label: `${t} (${typeMap[t].length})` }));
    comboOptions = [{ value: 'ALL', label: `전체 (${total})` }, ...types];
    if (!comboOptions.find(o => o.value === selectedType)) setSelectedType('ALL');
  }

  const containerRef = useRef(null);

  const currentItems = selectedType === 'ALL' ? [] : (typeMap[selectedType] || []);

  // 사용자가 닫았다면 선택이 남아 있어도 보이지 않게 처리
  if (hidden) return null;

  return (
    <div ref={containerRef} style={containerStyle} aria-live="polite">
      <Header />
      {!minimized && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
          <select
            value={comboOptions.find(o => o.value === selectedType) ? selectedType : (comboOptions[0]?.value || 'ALL')}
            onChange={e => setSelectedType(e.target.value)}
            style={selectStyle}
          >
            {comboOptions.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
            ))}
          </select>

          {selectedType !== 'ALL' && currentItems.length > 0 && (
            <div style={listBoxStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderCell}>Handle</th>
                    <th style={tableHeaderCell}>Layer</th>
                    <th style={tableHeaderCell}>Color</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((it) => (
                    <tr key={it.handle}>
                      <td style={{ ...tableCell, fontFamily: 'monospace' }}>{it.handle}</td>
                      <td style={tableCell}>{it.layer}</td>
                      <td style={tableCell}>{it.color}</td>
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
