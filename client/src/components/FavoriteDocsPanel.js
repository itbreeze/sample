// client/src/components/FavoriteDocsPanel.js

import React, { useState } from 'react';
import { FileText, FileCog, ChevronRight, ChevronDown, X } from 'lucide-react';
import './DocPanels.css';
import './FavoriteDocsPanel.css';


export default function FavoriteDocsPanel({
  items,
  documentItems = [],
  equipmentItems = [],
  onFileSelect,
  favoriteDocMeta = {},
  onRemoveDocFavorite,
  onRemoveEquipmentFavorite,
}) {
  const docs =
    documentItems && documentItems.length > 0 ? documentItems : items || [];
  const equips = equipmentItems || [];

  const hasDocs = docs.length > 0;
  const hasEquips = equips.length > 0;

  const [docsOpen, setDocsOpen] = useState(true);
  const [equipsOpen, setEquipsOpen] = useState(true);
  const [hoveredKey, setHoveredKey] = useState(null);
  const handleMouseEnter = (key) => setHoveredKey(key);
  const handleMouseLeave = () => setHoveredKey(null);
  const handleRemoveClick = (event, type, item) => {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'doc') {
      onRemoveDocFavorite?.(item);
    } else {
      onRemoveEquipmentFavorite?.(item);
    }
  };

  if (!hasDocs && !hasEquips) {
    return <div style={{ padding: 20 }}>즐겨찾기된 도면/설비가 없습니다.</div>;
  }

  const handleClick = (item, type = 'doc') => {
    const docId = item.docId || item.DOCNO || item.docNO || item.docno || '';
    if (!docId) return;
    const docVr = item.docVer || item.DOCVR || item.docVr || '001';
    const payload = {
      docId,
      docVr,
    };
    if (type === 'equipment') {
      payload.favoriteEquipment = {
        ...item,
        tagId:
          item.tagId ||
          item.TAGNO ||
          item.tagNo ||
          item.tagNO ||
          item.tagno ||
          '',
        function: item.function || item.func || item.functionName || '',
      };
    }
    onFileSelect?.(payload);
  };

  const docMetaMap = favoriteDocMeta || {};

  const buildDocMetaKey = (doc = {}) => {
    const docId = doc.docId || doc.DOCNO || doc.docNo || '';
    if (!docId) return null;
    const docVer = doc.docVer || doc.DOCVR || doc.docVr || '';
    return `${docId}-${docVer}`;
  };

  const buildHoverKey = (prefix, doc = {}, fallback = '', uniqueSuffix = null) => {
    const docId = doc.docId || doc.DOCNO || doc.docNo || '';
    const docVer = doc.docVer || doc.DOCVR || doc.docVr || '';
    if (docId) {
      const base = `${prefix}:${docId}:${docVer}`;
      return uniqueSuffix ? `${base}:${uniqueSuffix}` : base;
    }
    if (fallback) {
      const base = `${prefix}:${fallback}`;
      return uniqueSuffix ? `${base}:${uniqueSuffix}` : base;
    }
    return null;
  };

  const buildDocDisplayInfo = (doc = {}, meta = {}, options = {}) => {
    const includeDocIdentifierInInfo = !!options.includeDocIdentifierInInfo;
    const plant =
      doc.PLANTNM ||
      doc.plantName ||
      meta.plantName ||
      meta.PLANTNM ||
      '';
    const system =
      doc.SYSTEMNM ||
      doc.systemName ||
      meta.systemName ||
      meta.SYSTEMNM ||
      '';
    const unit =
      doc.UNIT || doc.unit || meta.unit || meta.HOGI_LABEL || '';

    const number =
      doc.DOCNUMBER ||
      doc.docNumber ||
      doc.DOCNUM ||
      meta.docNumber ||
      '';
    const name =
      doc.DOCNM ||
      doc.docName ||
      doc.DOCNAME ||
      meta.docName ||
      '';

    const identifier = number ? `[${number}]` : '';
    const titleParts = [identifier, name].filter(Boolean);
    const title = titleParts.join(' ') || '도면';

    const infoParts = [plant, system, unit].filter(Boolean);
    if (includeDocIdentifierInInfo && titleParts.length) {
      infoParts.push(titleParts.join(' '));
    }
    const infoLabel = options.infoLabel || '도면분류';
    const infoLine = infoParts.length ? `${infoLabel}: ${infoParts.join(' / ')}` : '';

    return {
      title,
      infoLine,
      debug: {
        docId: doc.docId || doc.DOCNO || doc.docNO,
        docNumber: number,
        docName: name,
        plant,
        system,
        unit,
        infoLine,
      },
    };
  };

  return (
    <div className="favorite-doc-panel doc-panel">
      <div className="favorite-doc-inner doc-panel-inner">
        <ul className="tree-list favorite-tree-list" data-scroll-container>

        {/* ================================
            ▪ 도면 섹션
        ================================= */}
        {hasDocs && (
          <>
            <li className="tree-node" style={{ padding: '4px 0' }}>
              <div
                className="tree-node-header doc-section-heading"
                onClick={() => setDocsOpen((v) => !v)}
              >
                {docsOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}

                <span className="tree-typography tree-typography--parent">
                  도면 ({docs.length})
                </span>
              </div>
            </li>

            {docsOpen && (
              <ul className="favorite-tree-node-items">
                {docs.map((doc, idx) => {
                  const metaKey = buildDocMetaKey(doc);
                  const docMeta = metaKey ? docMetaMap[metaKey] : {};
                  const docDisplay = buildDocDisplayInfo(doc, docMeta);
                  const docHoverKey = buildHoverKey('doc', doc, `doc-${idx}`, idx);
                  const docHovered = hoveredKey === docHoverKey;
                  return (
                    <li
                      key={`fav-doc-${doc.docId || doc.DOCNO}-${doc.docVer || doc.DOCVR}`}
                      className={`tree-node favorite-tree-node doc-node${docHovered ? ' hovered' : ''}`}
                      style={{ position: 'relative' }}
                      onMouseEnter={() => docHoverKey && handleMouseEnter(docHoverKey)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div
                        className="tree-node-header doc-node-header"
                        onClick={() => handleClick(doc, 'doc')}
                        title={docDisplay.title}
                        style={{ fontSize: '15px', minWidth: 0 }} // 일반 목록은 적당히 유지
                      >
                        <FileText style={{ width: 18, height: 18 }} />
                        <div className="doc-node-text">
                          <span className="doc-node-title tree-typography tree-typography--leaf">
                            {docDisplay.title}
                          </span>
                          {docDisplay.infoLine && (
                            <span className="doc-node-info">
                              {docDisplay.infoLine}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="favorite-tree-node-remove"
                        onClick={(event) => handleRemoveClick(event, 'doc', doc)}
                        title="즐겨찾기에서 제거"
                        aria-label="즐겨찾기에서 제거"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        {hasDocs && hasEquips && (
          <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #ddd' }} />
        )}

        {/* ================================
            ▪ 설비 섹션
        ================================= */}
        {hasEquips && (
          <>
            <li
              className="tree-node"
              style={{ padding: '8px 0 4px', marginTop: hasDocs ? 3 : 0 }}
            >
              <div
                className="tree-node-header doc-section-heading"
                onClick={() => setEquipsOpen((v) => !v)}
              >
                {equipsOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}

                <span className="tree-typography tree-typography--parent">
                  설비 ({equips.length})
                </span>
              </div>
            </li>

            {equipsOpen && (
              <ul className="favorite-tree-node-items">
                {equips.map((eq, idx) => {
                  const metaKey = buildDocMetaKey(eq);
                  const eqMeta = metaKey ? docMetaMap[metaKey] : {};
                  const eqDisplay = buildDocDisplayInfo(eq, eqMeta, {
                    includeDocIdentifierInInfo: true,
                    infoLabel: '도면정보',
                  });
                  const eqHoverKey = buildHoverKey('equip', eq, `equip-${idx}`, idx);
                  const eqHovered = hoveredKey === eqHoverKey;
                  return (
                    <li
                      key={`fav-eq-${eq.docId}-${eq.docVer}-${eq.function}`}
                      className={`tree-node favorite-tree-node doc-node${eqHovered ? ' hovered' : ''}`}
                      style={{ position: 'relative' }}
                      onMouseEnter={() => eqHoverKey && handleMouseEnter(eqHoverKey)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div
                        className="tree-node-header doc-node-header"
                        onClick={() => handleClick(eq, 'equipment')}
                        title={eqDisplay.title}
                        style={{
                          fontSize: '15px',
                        }} // 목록 표시는 유지
                      >
                        <FileCog
                          style={{
                            width: 18,
                            height: 18,
                          }}
                        />
                        <div className="doc-node-text">
                          <span className="doc-node-title tree-typography tree-typography--leaf">
                            설비명: {eq.function}
                          </span>
                          {eqDisplay.infoLine && (
                            <span className="doc-node-info">
                              {eqDisplay.infoLine}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="favorite-tree-node-remove"
                        onClick={(event) => handleRemoveClick(event, 'equipment', eq)}
                        title="즐겨찾기에서 제거"
                        aria-label="즐겨찾기에서 제거"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        </ul>
      </div>
    </div>
  );
}
