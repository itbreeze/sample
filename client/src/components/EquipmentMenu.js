import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useViewer } from '../viewer/context/ViewerContext';
import { EQUIPMENT_SELECTION_COLOR } from '../viewer/canvas/ViewerCanvasUtils';
import { Eye, EyeOff, ChevronDown, ChevronRight, FileCog } from 'lucide-react';
import './EquipmentMenu.css';

const parseHandles = (value) => {
  if (!value) return [];
  return value
    .split('/')
    .map((h) => (typeof h === 'string' ? h.trim() : ''))
    .filter(Boolean);
};

const normalizeHandles = (handles = []) => {
  return handles
    .map((handle) => (handle ? String(handle) : ''))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);
};

const buildEquipmentTree = (rows = []) => {
  const nodes = new Map();

  rows.forEach((row) => {
    if (!row?.libId) return;
    if (!nodes.has(row.libId)) {
      nodes.set(row.libId, {
        id: row.libId,
        label: row.libDesc || row.libName || `LIB-${row.libId}`,
        description: row.libDesc || null,
        parent: row.parent || null,
        level: row.libLv || null,
        tagsMap: new Map(),
        tags: [],
        children: [],
        metadata: {
          docId: row.docno || null,
          docVer: row.docVer || null,
          intelligent: row.intelligent || null,
          connection: row.connection || null,
        },
      });
    }

    const node = nodes.get(row.libId);

    if (row.tagId) {
      const tagId = row.tagId;
      const existing = node.tagsMap.get(tagId);
      const handles = parseHandles(row.handle);

      if (existing) {
        handles.forEach((handle) => {
          if (!existing.handles.includes(handle)) {
            existing.handles.push(handle);
          }
        });
      } else {
        node.tagsMap.set(tagId, {
          id: tagId,
          label: row.function || row.intelligent || tagId || '기타',
          tagType: row.tagType || 'UNKNOWN',
          handles,
        });
      }
    }
  });

  nodes.forEach((node) => {
    node.tags = Array.from(node.tagsMap.values());
    node.tagsMap = undefined;
  });

  const roots = [];
  nodes.forEach((node) => {
    if (node.parent && nodes.has(node.parent)) {
      nodes.get(node.parent).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const annotate = (node) => {
    const handles = new Set();
    let tagCount = node.tags?.length ?? 0;
    node.tags?.forEach((tag) => tag.handles.forEach((handle) => handles.add(handle)));
    node.children?.forEach((child) => {
      const childInfo = annotate(child);
      childInfo.handles.forEach((handle) => handles.add(handle));
      tagCount += childInfo.tagCount;
    });
    node.totalHandles = Array.from(handles);
    node.tagGroupCount = tagCount;
    node.children = node.children.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    return { handles, tagCount };
  };

  roots.forEach((root) => annotate(root));
  return roots.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
};

const EquipmentMenu = () => {
  const {
    openFiles,
    activeFileId,
    setDocHighlight,
    highlightActions,
    equipmentHandleModel,
    equipmentData,
    equipmentLoading,
    equipmentError,
    refreshEquipmentData,
    persistEquipmentHighlight,
    readEquipmentHighlightCache,
  } = useViewer();
  const activeFile = useMemo(
    () => openFiles.find((file) => file.DOCNO === activeFileId),
    [openFiles, activeFileId]
  );
  const [equipmentTree, setEquipmentTree] = useState([]);
  const [highlightedHandles, setHighlightedHandles] = useState(() => new Set());
  const [globalHighlight, setGlobalHighlight] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(() => new Set());
  const [activeNodeIds, setActiveNodeIds] = useState(() => new Set());
  const [groupHandles, setGroupHandles] = useState(() => new Set());
  const manualSelectionRef = useRef(new Set());
  const persistSelection = useCallback(
    (manual, group) => {
      persistEquipmentHighlight(
        Array.from(manual || []),
        Array.from(group || [])
      );
    },
    [persistEquipmentHighlight]
  );
  const lastHighlightedGroupRef = useRef(null);
  const totalTagGroups = useMemo(() => {
    const tags = new Set();
    equipmentData.forEach((row) => {
      const tagId = row?.tagId || row?.TAGNO || row?.TAGNO_CD || null;
      if (tagId) tags.add(tagId);
    });
    return tags.size;
  }, [equipmentData]);

  const allHandles = useMemo(() => {
    const collector = new Set();
    const gather = (node) => {
      node.tags?.forEach((tag) => tag.handles.forEach((handle) => collector.add(handle)));
      node.children?.forEach((child) => gather(child));
    };
    equipmentTree.forEach((node) => gather(node));
    return Array.from(collector);
  }, [equipmentTree]);

  const highlightTimeoutRef = useRef(null);
  const unionWithManualSelection = useCallback((baseSet) => {
    if (!manualSelectionRef.current || !manualSelectionRef.current.size) return baseSet;
    const combined = new Set(baseSet);
    manualSelectionRef.current.forEach((handle) => combined.add(handle));
    return combined;
  }, []);
  const applyHighlightSet = useCallback(
    (nextSet) => {
      if (!activeFile?.DOCNO) return;
      const key = `${activeFile.DOCNO}:${Array.from(nextSet).join(',')}`;
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setDocHighlight(activeFile.DOCNO, Array.from(nextSet), {
          highlightColor: EQUIPMENT_SELECTION_COLOR,
        });
        highlightTimeoutRef.current = null;
      }, 0);
    },
    [activeFile?.DOCNO, setDocHighlight]
  );

  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      persistSelection(manualSelectionRef.current, groupHandles);
    };
  }, [persistSelection, groupHandles]);

  const preparerHandlesRef = useRef('');
  useEffect(() => {
    if (!equipmentHandleModel?.allHandles?.length) return;
    const prepareHandlesAction = highlightActions?.prepareHandles;
    if (typeof prepareHandlesAction !== 'function') return;
    const normalized = normalizeHandles(equipmentHandleModel.allHandles);
    if (!normalized.length) return;
    const key = normalized.join('|');
    if (preparerHandlesRef.current === key) return;
    preparerHandlesRef.current = key;
    prepareHandlesAction(normalized, { chunkSize: 32 }).catch(() => {});
  }, [equipmentHandleModel, highlightActions]);

  useEffect(() => {
    const cached = readEquipmentHighlightCache();
    const hasCached = cached.manual.size || cached.group.size;
    if (hasCached) {
      manualSelectionRef.current = new Set(cached.manual);
      const groupSet = new Set(cached.group);
      setGroupHandles(groupSet);
      const combined = unionWithManualSelection(groupSet);
      setHighlightedHandles(combined);
      setGlobalHighlight(false);
      setActiveNodeIds(new Set());
      applyHighlightSet(combined);
      return;
    }
    manualSelectionRef.current?.clear();
    setGroupHandles(new Set());
    setHighlightedHandles(new Set());
    setGlobalHighlight(false);
    setActiveNodeIds(new Set());
    applyHighlightSet(new Set());
  }, [activeFile?.DOCNO, applyHighlightSet, readEquipmentHighlightCache, unionWithManualSelection]);

  useEffect(() => {
    if (!Array.isArray(equipmentData) || !equipmentData.length) {
      setEquipmentTree([]);
      return;
    }
    setEquipmentTree(buildEquipmentTree(equipmentData));
  }, [equipmentData]);

  const renderEyeIcon = useCallback(
    (active) =>
      active ? <Eye size={16} /> : <EyeOff size={16} />,
    []
  );

  const nodeHandlesMap = useMemo(() => {
    const map = new Map();
    const collect = (node) => {
      if (!node) return;
      map.set(node.id, new Set(node.totalHandles || []));
      node.children?.forEach((child) => collect(child));
    };
    equipmentTree.forEach((node) => collect(node));
    return map;
  }, [equipmentTree]);

  const handleNodeToggle = useCallback(
    (node) => {
      if (!node) return;
      const nextNodeIds = new Set(activeNodeIds);
      if (nextNodeIds.has(node.id)) {
        nextNodeIds.delete(node.id);
      } else {
        nextNodeIds.add(node.id);
      }
      const union = new Set();
      nextNodeIds.forEach((id) => {
        const handles = nodeHandlesMap.get(id);
        handles?.forEach((handle) => union.add(handle));
      });
      setGroupHandles(union);
      const combined = unionWithManualSelection(union);
      setHighlightedHandles(combined);
      applyHighlightSet(combined);
      setActiveNodeIds(nextNodeIds);
      setGlobalHighlight(false);
      persistSelection(manualSelectionRef.current, union);
      if (nextNodeIds.has(node.id)) {
        lastHighlightedGroupRef.current = node.id;
      } else if (lastHighlightedGroupRef.current === node.id) {
        const manualHandles = Array.from(manualSelectionRef.current || []);
        const nodeHandles = nodeHandlesMap.get(node.id) || new Set();
        const isSubset = manualHandles.length && manualHandles.every((handle) => nodeHandles.has(handle));
        if (isSubset) {
          manualSelectionRef.current.clear();
          const recalculated = unionWithManualSelection(union);
          setHighlightedHandles(recalculated);
          applyHighlightSet(recalculated);
        }
        lastHighlightedGroupRef.current = null;
      }
    },
    [activeNodeIds, applyHighlightSet, nodeHandlesMap, unionWithManualSelection]
  );

  const [pendingZoomHandles, setPendingZoomHandles] = useState(null);

  useEffect(() => {
    if (
      pendingZoomHandles &&
      Array.isArray(pendingZoomHandles) &&
      pendingZoomHandles.length &&
      typeof highlightActions?.zoomToHandles === 'function'
    ) {
      highlightActions.zoomToHandles(pendingZoomHandles);
      setPendingZoomHandles(null);
    }
  }, [pendingZoomHandles, highlightActions]);

  const selectHandles = useCallback(
    async (handles = [], zoom = false) => {
      const normalized = normalizeHandles(handles);
      if (!normalized.length) return;
      const currentlyHighlighted = normalized.every((handle) =>
        highlightedHandles.has(handle)
      );
      const isManualSubset = normalized.every((handle) =>
        manualSelectionRef.current.has(handle)
      );
      if (currentlyHighlighted && isManualSubset) {
        manualSelectionRef.current.clear();
        const combined = unionWithManualSelection(groupHandles);
        setHighlightedHandles(combined);
        applyHighlightSet(combined);
        setGlobalHighlight(false);
        setActiveNodeIds(new Set());
        persistSelection(manualSelectionRef.current, groupHandles);
        return;
      }
      manualSelectionRef.current = new Set(normalized);
      const combined = unionWithManualSelection(groupHandles);
      setHighlightedHandles(combined);
      applyHighlightSet(combined);
      setGlobalHighlight(false);
      setActiveNodeIds(new Set());
      persistSelection(manualSelectionRef.current, groupHandles);
      try {
        await highlightActions?.prepareHandles?.(normalized, { chunkSize: 32 });
      } catch (_) {}
      highlightActions?.selectHandles?.(normalized, {
        highlightColor: EQUIPMENT_SELECTION_COLOR,
        openPanel: false,
      });
      if (zoom) {
        const performZoom = () => {
          if (typeof highlightActions?.zoomToHandle === 'function') {
            highlightActions.zoomToHandle(normalized[0]);
          } else if (typeof highlightActions?.zoomToHandles === 'function') {
            highlightActions.zoomToHandles(normalized);
          } else {
            setPendingZoomHandles(normalized);
          }
        };
        if (typeof window !== 'undefined' && typeof window.queueMicrotask === 'function') {
          window.queueMicrotask(performZoom);
        } else {
          Promise.resolve().then(performZoom);
        }
      }
    },
    [applyHighlightSet, highlightActions, highlightedHandles, groupHandles, unionWithManualSelection]
  );

  const handleGlobalToggle = () => {
    setGlobalHighlight((prev) => {
      const next = !prev;
      manualSelectionRef.current.clear();
      if (next) {
        const allSet = new Set(allHandles);
        setGroupHandles(allSet);
        setHighlightedHandles(allSet);
        applyHighlightSet(allSet);
        persistSelection(manualSelectionRef.current, allSet);
        const allIds = new Set();
        const collectIds = (node) => {
          allIds.add(node.id);
          node.children?.forEach((child) => collectIds(child));
        };
        equipmentTree.forEach((node) => collectIds(node));
        setActiveNodeIds(allIds);
      } else {
        const empty = new Set();
        setGroupHandles(new Set());
        setHighlightedHandles(empty);
        applyHighlightSet(empty);
        persistSelection(manualSelectionRef.current, empty);
        setActiveNodeIds(new Set());
      }
      return next;
    });
  };

  const isHandleSetActive = useCallback(
    (nodeId) => activeNodeIds.has(nodeId),
    [activeNodeIds]
  );

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [equipmentTree]);

  const renderTag = (tag, nodeActive) => {
    const handles = Array.isArray(tag.handles) ? tag.handles : [];
    const tagHasHighlight = handles.some((handle) => highlightedHandles.has(handle));
    const isActive = nodeActive || tagHasHighlight;
    return (
      <div className="equipment-tree-tag" key={tag.id}>
        <button
          type="button"
          className={`equipment-tree-tag__select ${isActive ? 'active' : ''}`}
          onClick={() => selectHandles(tag.handles, true)}
          disabled={!tag.handles.length}
          aria-pressed={isActive}
          aria-label={`${tag.label} 선택하여 하이라이트 및 줌`}
        >
          <FileCog size={14} />
          <span className={`equipment-tree-tag__label ${tagHasHighlight ? 'active' : ''}`}>{tag.label}</span>
        </button>
      </div>
    );
  };

  const renderNode = (node, depth = 0) => {
    const nodeHandles = node.totalHandles || [];
    const isNodeActive = isHandleSetActive(node.id);
    const isExpanded = expandedNodes.has(node.id);
    return (
      <div className="equipment-tree-node" key={node.id} style={{ '--equipment-depth': depth }}>
        <div className="equipment-tree-node__header">
          <button
            type="button"
            className="equipment-tree-node__toggle"
            onClick={() => {
              setExpandedNodes((prev) => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? '그룹 접기' : '그룹 펼치기'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="equipment-tree-node__label">
            <strong>{node.label}</strong>
            <span className="equipment-tree-node__count">
              {`(${node.tagGroupCount || 0})`}
            </span>
          </div>
          <div className="equipment-tree-node__actions">
            <button
              type="button"
              className={`equipment-card__chip ${isNodeActive ? 'active' : ''}`}
              onClick={() => handleNodeToggle(node)}
              disabled={!nodeHandles.length}
              aria-pressed={isNodeActive}
              aria-label={`노드 하이라이트 ${isNodeActive ? '끄기' : '켜기'}`}
            >
              {renderEyeIcon(isNodeActive)}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div
            className="equipment-tree-node__tags"
            style={{ '--equipment-tag-depth': depth + 1 }}
          >
          {node.tags.map((tag) => renderTag(tag, isNodeActive))}
            {node.children.length ? (
              <div className="equipment-tree-node__children">
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="equipment-panel">
        <header className="equipment-panel__header">
            <button
              type="button"
              className={`equipment-panel__global-toggle ${globalHighlight ? 'active' : ''}`}
              onClick={handleGlobalToggle}
              disabled={!allHandles.length}
              aria-pressed={globalHighlight}
            >
              <div className="equipment-panel__global-toggle-text">
                <span>전체</span>
                <span className="equipment-panel__global-toggle-count">{`(${totalTagGroups})`}</span>
              </div>
            <span className="equipment-panel__global-toggle-icon">
              {renderEyeIcon(globalHighlight)}
            </span>
          </button>
          <button
            type="button"
            className="equipment-panel__refresh"
            onClick={refreshEquipmentData}
            disabled={equipmentLoading || !activeFile?.DOCNO}
          >
            새로고침
          </button>
      </header>
      <div className="equipment-panel__body">
        {equipmentLoading && <div className="equipment-panel__message">설비 목록을 불러오는 중입니다...</div>}
        {equipmentError && <div className="equipment-panel__message">{equipmentError}</div>}
        {!equipmentLoading && !equipmentError && !equipmentTree.length && (
          <div className="equipment-panel__empty">설비 데이터를 찾을 수 없습니다.</div>
        )}
        {!equipmentLoading && equipmentTree.length > 0 && (
          <div className="equipment-tree">
            {equipmentTree.map((node) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentMenu;
