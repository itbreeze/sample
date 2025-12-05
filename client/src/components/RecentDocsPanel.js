import React, { useMemo, useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import './RecentDocsPanel.css';

const formatRecentDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatGroupDate = (value) => {
  if (!value || value === 'unknown') return '기록 없음';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const buildDocTitle = (doc = {}) => {
  const docNumber = doc.docNumber || doc.docNUMBER || doc.DOCNUMBER || '';
  const docName = doc.docName || doc.docNM || doc.DOCNM || '';
  const id = doc.docId || doc.docNO || doc.DOCNO || '';
  const identifier = docNumber ? `[${docNumber}]` : '';
  if (docName) {
    return `${identifier} ${docName}`.trim();
  }
  return identifier || id || '도면';
};

const buildInfoLine = (doc = {}, options = {}) => {
  const parts = [];
  if (doc.plantName) parts.push(doc.plantName);
  else if (doc.PLANTNM) parts.push(doc.PLANTNM);
  else if (doc.plantCode) parts.push(doc.plantCode);
  else if (doc.PLANTCODE) parts.push(doc.PLANTCODE);
  if (doc.systemName) parts.push(doc.systemName);
  else if (doc.SYSTEMNM) parts.push(doc.SYSTEMNM);
  else if (doc.systemCode) parts.push(doc.systemCode);
  if (doc.unitLabel) parts.push(doc.unitLabel);
  else if (doc.UNITLABEL) parts.push(doc.UNITLABEL);
  else if (doc.UNIT) parts.push(doc.UNIT);
  if (doc.docName || doc.DOCNM || doc.DOCNAME || doc.name) {
    if (options.includeDocName !== false) {
      parts.push(doc.docName || doc.DOCNM || doc.DOCNAME || doc.name);
    }
  }
  if (!parts.length) return '';
  return `도면분류: ${parts.join(' / ')}`;
};

const MAX_DISPLAY_GROUPS = 10;

const getDocIdentity = (doc = {}) => {
  const docId = doc.docId || doc.DOCID || doc.docNO || doc.DOCNO || '';
  if (!docId) return null;
  const docVr = doc.docVr || doc.docVer || doc.DOCVR || '001';
  return `${docId}-${docVr}`;
};


const RecentDocsPanel = ({
  items = [],
  onFileSelect,
  loading = false,
}) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const visibleDocs = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items;
  }, [items]);

  const buildDocKey = (doc = {}, index = 0) => {
    const docId = String(doc.docId || doc.DOCNO || doc.docNO || '').trim() || 'unknown';
    const docVr = doc.docVr || doc.docVer || doc.DOCVR || '001';
    const timestamp = String(doc.lastOpen || doc.lastOpenDate || doc.openDate || doc.documented || index);
    return `${docId}-${docVr}-${timestamp}`;
  };

  const groupedDocs = useMemo(() => {
    if (!Array.isArray(visibleDocs) || visibleDocs.length === 0) return [];
    const normalized = [...visibleDocs].sort((a, b) => {
      const dateA = a.lastOpen || a.lastOpenDate || '';
      const dateB = b.lastOpen || b.lastOpenDate || '';
      return dateB.localeCompare(dateA);
    });
    const collator = new Map();
    normalized.forEach((doc) => {
      const lastOpen = doc.lastOpen || doc.lastOpenDate || '';
      const key = lastOpen ? lastOpen.slice(0, 10) : 'unknown';
      if (!collator.has(key)) collator.set(key, []);
      collator.get(key).push(doc);
    });
    const groups = Array.from(collator.entries()).map(([key, docs]) => {
      const seen = new Set();
      const uniqueDocs = [];
      docs.forEach((doc) => {
        const docId = String(doc.docId || doc.DOCNO || doc.docNO || '').trim();
        if (!docId || seen.has(docId)) return;
        seen.add(docId);
        uniqueDocs.push(doc);
      });
      return {
        key,
        docs: uniqueDocs,
        total: uniqueDocs.length,
        label: formatGroupDate(key),
      };
    });
    return groups.sort((a, b) => {
      if (a.key === 'unknown' && b.key !== 'unknown') return 1;
      if (b.key === 'unknown' && a.key !== 'unknown') return -1;
      if (a.key === b.key) return 0;
      return b.key.localeCompare(a.key);
    });
  }, [visibleDocs]);

  const displayGroups = useMemo(
    () => groupedDocs.slice(0, MAX_DISPLAY_GROUPS),
    [groupedDocs]
  );

  useEffect(() => {
    if (!displayGroups.length) {
      setExpandedGroups(new Set());
      return;
    }

    setExpandedGroups((prev) => {
      if (!prev || prev.size === 0) {
        return new Set([displayGroups[0].key]);
      }
      const groupKeys = new Set(displayGroups.map((group) => group.key));
      const next = new Set(
        Array.from(prev).filter((key) => groupKeys.has(key))
      );
      if (!next.size) {
        next.add(displayGroups[0].key);
      }
      return next;
    });
  }, [displayGroups]);

  const handleGroupToggle = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderGroupHeader = (group, isExpanded) => (
    <div
      className="recent-doc-group-header"
      onClick={() => handleGroupToggle(group.key)}
    >
      <div className="recent-doc-group-title">
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <span>{group.label}</span>
        <span className="recent-doc-group-count">
          ({group.total})
        </span>
      </div>
    </div>
  );

  const renderDocItem = (doc, globalIndex) => {
    const docId = doc.docId || doc.docNO;
    const docVr = doc.docVr || doc.docVer || doc.DOCVR;
    const infoLine = buildInfoLine(doc, { includeDocName: false });
    const dateLabel = doc.lastOpen ? formatRecentDate(doc.lastOpen) : '';
    const title = buildDocTitle(doc);

    return (
      <li
        key={buildDocKey(doc, globalIndex)}
        className="tree-node recent-doc-item"
      >
        <div
          className="tree-node-header"
          onClick={() => {
            onFileSelect?.(doc);
          }}
          title={title}
        >
          <div className="recent-doc-icon-wrapper">
            <FileText className="recent-doc-icon" />
          </div>
          <div className="recent-doc-text">
            <span className="recent-doc-title">{title}</span>
            {infoLine && (
              <span className="recent-doc-info">
                {infoLine}
              </span>
            )}
                    {dateLabel && (
                      <span className="recent-doc-date">
                        열람일자: {dateLabel}
                      </span>
                    )}

          </div>
        </div>
      </li>
    );
  };

  const hasDocs = displayGroups.length > 0;
  const totalDocs = groupedDocs.reduce(
    (sum, group) => sum + (group.total || 0),
    0
  );
  const counterLabel = hasDocs ? `(${totalDocs})` : '';

  return (
    <div className="recent-doc-panel">
      <div className="recent-doc-header">
        <span className="recent-doc-heading">
          최근 본 도면 <span className="recent-doc-count">{counterLabel}</span>
        </span>
      </div>

      {loading && (
        <div className="recent-doc-empty">
          <div className="spinner" />
          <span>최근 도면을 불러오는 중입니다...</span>
        </div>
      )}

      {!loading && !hasDocs && (
        <div className="recent-doc-empty">최근 본 도면이 없습니다.</div>
      )}

      {!loading && hasDocs && (
        <div className="recent-doc-groups" data-scroll-container>
          {(() => {
            let globalIndex = 0;
            return displayGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div className="recent-doc-group" key={group.key}>
                  {renderGroupHeader(group, isExpanded)}
                  {isExpanded && (
                    <ul className="recent-doc-group-items">
                      {group.docs.map((doc) => {
                        const keyIndex = globalIndex;
                        globalIndex += 1;
                        return renderDocItem(doc, keyIndex);
                      })}
                    </ul>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default RecentDocsPanel;
