import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useViewer } from '../viewer/context/ViewerContext';
import { getDocumentEquipment } from '../services/documentsApi';
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
    const all = new Set();
    node.tags?.forEach((tag) => tag.handles.forEach((handle) => all.add(handle)));
    node.children?.forEach((child) => {
      annotate(child).forEach((handle) => all.add(handle));
    });
    node.totalHandles = Array.from(all);
    node.totalCount = all.size;
    node.children = node.children.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    return all;
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
  } = useViewer();
  const activeFile = useMemo(
    () => openFiles.find((file) => file.DOCNO === activeFileId),
    [openFiles, activeFileId]
  );
  const activePlantCode = useMemo(
    () => activeFile?.PLANTCODE || activeFile?.PLANTCD || null,
    [activeFile]
  );

  const [equipmentTree, setEquipmentTree] = useState([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentError, setEquipmentError] = useState(null);
  const [highlightedHandles, setHighlightedHandles] = useState(() => new Set());
  const [globalHighlight, setGlobalHighlight] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(() => new Set());

  const allHandles = useMemo(() => {
    const collector = new Set();
    const gather = (node) => {
      node.tags?.forEach((tag) => tag.handles.forEach((handle) => collector.add(handle)));
      node.children?.forEach((child) => gather(child));
    };
    equipmentTree.forEach((node) => gather(node));
    return Array.from(collector);
  }, [equipmentTree]);

  const applyHighlightSet = useCallback(
    (nextSet) => {
      if (activeFile?.DOCNO) {
        setDocHighlight(activeFile.DOCNO, Array.from(nextSet));
      }
    },
    [activeFile?.DOCNO, setDocHighlight]
  );

  useEffect(() => {
    setHighlightedHandles(new Set());
    setGlobalHighlight(false);
    applyHighlightSet(new Set());
  }, [activeFile?.DOCNO, applyHighlightSet]);

  useEffect(() => {
    if (!activeFile?.DOCNO || !activePlantCode) {
      setEquipmentTree([]);
      setEquipmentLoading(false);
      setEquipmentError(null);
      return;
    }

    let cancelled = false;
    setEquipmentLoading(true);
    setEquipmentError(null);

    getDocumentEquipment({
      docId: activeFile.DOCNO,
      docVr: activeFile.DOCVR,
      plantCode: activePlantCode,
    })
      .then((data) => {
        if (cancelled) return;
        setEquipmentTree(buildEquipmentTree(data));
      })
      .catch((err) => {
        if (cancelled) return;
        setEquipmentError(err.message || '설비 정보를 불러오는 중 오류가 발생했습니다.');
        setEquipmentTree([]);
      })
      .finally(() => {
        if (!cancelled) setEquipmentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFile?.DOCNO, activeFile?.DOCVR, activePlantCode]);

  const renderEyeIcon = useCallback(
    (active) =>
      active ? <Eye size={16} /> : <EyeOff size={16} />,
    []
  );

  const toggleHandles = useCallback(
    (handles = []) => {
      const normalized = normalizeHandles(handles);
      if (!normalized.length) return;
      setHighlightedHandles((prev) => {
        const next = new Set(prev);
        normalized.forEach((handle) => {
          if (next.has(handle)) next.delete(handle);
          else next.add(handle);
        });
        applyHighlightSet(next);
        return next;
      });
      setGlobalHighlight(false);
    },
    [applyHighlightSet]
  );

  const selectHandles = useCallback(
    (handles = [], zoom = false) => {
      const normalized = normalizeHandles(handles);
      if (!normalized.length) return;
      const next = new Set(normalized);
      setHighlightedHandles(next);
      applyHighlightSet(next);
      setGlobalHighlight(false);
      if (zoom) {
        highlightActions?.zoomToHandle?.(normalized[0]);
      }
    },
    [applyHighlightSet, highlightActions]
  );

  const handleGlobalToggle = () => {
    setGlobalHighlight((prev) => {
      const next = !prev;
      if (next) {
        const allSet = new Set(allHandles);
        setHighlightedHandles(allSet);
        applyHighlightSet(allSet);
      } else {
        const empty = new Set();
        setHighlightedHandles(empty);
        applyHighlightSet(empty);
      }
      return next;
    });
  };

  const isHandleSetActive = useCallback(
    (handles = []) => handles.length > 0 && handles.every((handle) => highlightedHandles.has(handle)),
    [highlightedHandles]
  );

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [equipmentTree]);

  const renderTag = (tag) => {
    const isActive = isHandleSetActive(tag.handles);
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
          <span className="equipment-tree-tag__label">{tag.label}</span>
        </button>
      </div>
    );
  };

  const renderNode = (node, depth = 0) => {
    const nodeHandles = node.totalHandles || [];
    const isNodeActive = isHandleSetActive(nodeHandles);
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
              {`(${node.totalCount || 0})`}
            </span>
          </div>
          <div className="equipment-tree-node__actions">
            <button
              type="button"
              className={`equipment-card__chip ${isNodeActive ? 'active' : ''}`}
              onClick={() => toggleHandles(nodeHandles)}
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
            {node.tags.map((tag) => renderTag(tag))}
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
              <span className="equipment-panel__global-toggle-count">{`(${allHandles.length})`}</span>
            </div>
            <span className="equipment-panel__global-toggle-icon">
              {renderEyeIcon(globalHighlight)}
            </span>
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
