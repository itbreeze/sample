import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, ChevronRight, ChevronLeft } from 'lucide-react';
import { useViewer } from '../context/ViewerContext';
import './EquipmentInfoPanel.css';

const PANEL_WIDTH = 220;
const CONTEXT_MENU_WIDTH = 180;
const MENU_SECTIONS = [
  {
    id: 'group-1',
    items: [
      {
        id: 'equipment-info',
        label: '설비정보 조회',
        children: [{ id: 'equipment-info-null', label: 'NULL' }],
      },
      {
        id: 'bom-info',
        label: 'BOM 조회',
        children: [{ id: 'bom-info-null', label: 'NULL' }],
      },
    ],
  },
  {
    id: 'group-2',
    items: [
      {
        id: 'notice',
        label: '통지',
        children: [
          {
            id: 'notice-issue',
            label: '통지발행',
            children: [{ id: 'notice-issue-null', label: 'NULL' }],
          },
          {
            id: 'notice-history',
            label: '통지이력조회',
            children: [{ id: 'notice-history-null', label: 'NULL' }],
          },
        ],
      },
      {
        id: 'order',
        label: '오더',
        children: [
          {
            id: 'order-issue',
            label: '오더발행',
            children: [{ id: 'order-issue-null', label: 'NULL' }],
          },
          {
            id: 'order-history',
            label: '오더이력조회',
            children: [{ id: 'order-history-null', label: 'NULL' }],
          },
        ],
      },
    ],
  },
  {
    id: 'group-3',
    items: [
      {
        id: 'related-docs',
        label: '관련문서',
        children: [{ id: 'related-null', label: 'NULL' }],
      },
      {
        id: 'other-docs',
        label: '기타자료',
        children: [{ id: 'other-null', label: 'NULL' }],
      },
    ],
  },
];

const EquipmentInfoPanel = ({
  entries = [],
  visible = false,
  position = { x: 0, y: 0 },
  onClose = () => {},
}) => {
  const [submenuDirection, setSubmenuDirection] = useState('right');
  const [hoveredFunction, setHoveredFunction] = useState(null);
  const [submenuHoverPath, setSubmenuHoverPath] = useState([]);
  const panelRef = useRef(null);
  const { toggleEquipmentFavorite, isEquipmentFavorite } = useViewer();

  const functions = useMemo(() => {
    const seen = new Map();
    entries.forEach((entry) => {
      const func = entry.func || entry.FUNCTION || '기능 미정';
      if (!seen.has(func)) {
        seen.set(func, {
          func,
          tagType: entry.tagType || entry.TAG_TYPE || '',
          docId: entry.docId,
          docVer: entry.docVer,
          docName: entry.docName,
          docNumber: entry.docNumber,
          plantCode: entry.plantCode,
          tagId: entry.tagId || entry.tagNo,
          functionName: entry.functionName || func,
        });
      }
    });
    return Array.from(seen.values());
  }, [entries]);

  const infoMenuLabel = useMemo(() => {
    const tagType = entries[0]?.tagType || entries[0]?.TAG_TYPE || '';
    if (tagType === '003') return '배관정보 조회';
    return '설비정보 조회';
  }, [entries]);

  useEffect(() => {
    if (!visible) {
      setSubmenuDirection('right');
      return;
    }
    const updateDirection = () => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const margin = 12;
      const availableRight = vw - (position?.x || 0) - PANEL_WIDTH - margin;
      const availableLeft = (position?.x || 0) - margin;
      if (availableRight >= CONTEXT_MENU_WIDTH) {
        setSubmenuDirection('right');
      } else if (availableLeft >= CONTEXT_MENU_WIDTH) {
        setSubmenuDirection('left');
      } else {
        setSubmenuDirection('right');
      }
    };
    updateDirection();
  }, [position?.x, visible]);

  useEffect(() => {
    if (!visible) {
      setHoveredFunction(null);
      setSubmenuHoverPath([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const handleOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [visible, onClose]);

  const handleFavoriteClick = useCallback(
    async (funcEntry, event) => {
      event?.stopPropagation();
      if (
        !toggleEquipmentFavorite ||
        !funcEntry?.docId ||
        !funcEntry?.tagId
      ) {
        return;
      }
      try {
        await toggleEquipmentFavorite({
          docId: funcEntry.docId,
          docVer: funcEntry.docVer || '001',
          docName: funcEntry.docName,
          docNumber: funcEntry.docNumber,
          plantCode: funcEntry.plantCode,
          tagId: funcEntry.tagId,
          function: funcEntry.functionName || funcEntry.func || '',
        });
      } catch (err) {
        console.error('[EquipmentInfoPanel] 즐겨찾기 변경 실패', err);
      }
    },
    [toggleEquipmentFavorite]
  );

  if (!visible) return null;

  const handleRowEnter = (func) => {
    setHoveredFunction(func);
    setSubmenuHoverPath([]);
  };

  const handleMenuItemHover = (itemId, depth) => {
    setSubmenuHoverPath((prev) => {
      const updated = prev.slice(0, depth);
      updated[depth] = itemId;
      return updated;
    });
  };

  const renderArrow = () => (
    <span className={`equipment-info-context-arrow equipment-info-context-arrow--${submenuDirection}`}>
      {submenuDirection === 'right' ? (
        <ChevronRight size={12} />
      ) : (
        <ChevronLeft size={12} />
      )}
    </span>
  );

  const renderChildPanel = (items, depth = 1) => {
    if (!items?.length) return null;
    const childrenWithDividers = items.flatMap((item, index) => {
      const element = (
        <div
          key={item.id}
          className="equipment-info-context-item"
          onMouseEnter={() => handleMenuItemHover(item.id, depth)}
        >
          <span className="equipment-info-context-label">{item.label}</span>
          {item.children && renderArrow()}
          {item.children && submenuHoverPath[depth] === item.id && renderChildPanel(item.children, depth + 1)}
        </div>
      );
      if (index < items.length - 1) {
        return [
          element,
          <div
            key={`divider-${depth}-${item.id}`}
            className="equipment-info-context-divider"
          />,
        ];
      }
      return [element];
    });
    return (
      <div
        className={`equipment-info-context-children-panel equipment-info-context-children-panel--${submenuDirection}`}
      >
        {childrenWithDividers}
      </div>
    );
  };

  const renderMenu = (func) => (
    <div
      className={`equipment-info-context-menu equipment-info-context-menu--${submenuDirection}`}
      onMouseEnter={() => handleRowEnter(func)}
    >
      {MENU_SECTIONS.map((section, sectionIndex) => (
        <React.Fragment key={section.id}>
          {section.items.map((item) => (
            <div
              key={item.id}
              className="equipment-info-context-item"
              onMouseEnter={() => item.children && handleMenuItemHover(item.id, 0)}
            >
              <span className="equipment-info-context-label">
                {item.id === 'equipment-info' ? infoMenuLabel : item.label}
              </span>
              {item.children && renderArrow()}
              {item.children && submenuHoverPath[0] === item.id && renderChildPanel(item.children, 1)}
            </div>
          ))}
          {sectionIndex < MENU_SECTIONS.length - 1 && (
            <div className="equipment-info-context-divider" />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div
      className="equipment-info-panel"
      style={{ left: position.x, top: position.y }}
      ref={panelRef}
    >
      <div className="equipment-info-panel__body">
        {functions.map((funcEntry) => {
          const isFavorited =
            typeof isEquipmentFavorite === 'function'
              ? isEquipmentFavorite(funcEntry)
              : false;
          return (
            <div
              key={funcEntry.func}
              className="equipment-info-function-row-wrapper"
              onMouseEnter={() => handleRowEnter(funcEntry.func)}
            >
              <div
                className="equipment-info-function-row"
                onMouseEnter={() => handleRowEnter(funcEntry.func)}
              >
            <button
              type="button"
              className={`equipment-info-function-row__favorite ${isFavorited ? 'active' : ''}`}
              aria-label="즐겨찾기"
              aria-pressed={isFavorited}
              onClick={(event) => handleFavoriteClick(funcEntry, event)}
            >
              <Star
                size={20}
                strokeWidth={isFavorited ? 2.2 : 1.8}
                color={isFavorited ? '#facc15' : '#9ca3af'}
                fill={isFavorited ? '#facc15' : 'none'}
                style={{
                  filter: isFavorited
                    ? 'drop-shadow(0 0 3px rgba(250, 204, 21, 0.7))'
                    : 'none',
                }}
              />
            </button>
                <span className="equipment-info-function-row__label">{funcEntry.func}</span>
                <div className="equipment-info-function-row__arrow">
                  {submenuDirection === 'right' ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronLeft size={14} />
                  )}
                </div>
              </div>
              {hoveredFunction === funcEntry.func && renderMenu(funcEntry.func)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EquipmentInfoPanel;
