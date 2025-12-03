// client/src/components/FavoriteDocsPanel.js

import React, { useState } from 'react';
import { FileText, FileCog, ChevronRight, ChevronDown } from 'lucide-react';
import './FavoriteDocsPanel.css';


export default function FavoriteDocsPanel({
  items,
  documentItems = [],
  equipmentItems = [],
  onFileSelect,
  favoriteDocMeta = {},
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

  if (!hasDocs && !hasEquips) {
    return <div style={{ padding: 20 }}>즐겨찾기된 도면/설비가 없습니다.</div>;
  }

  const handleClick = (item) => {    
    onFileSelect({
      docId: item.docId || item.DOCNO || item.docNO,
      docVr: item.docVer || item.DOCVR,
    });
  };

  const docMetaMap = favoriteDocMeta || {};

  const buildDocMetaKey = (doc = {}) => {
    const docId = doc.docId || doc.DOCNO || doc.docNo || '';
    if (!docId) return null;
    const docVer = doc.docVer || doc.DOCVR || doc.docVr || '';
    return `${docId}-${docVer}`;
  };

  const buildHoverKey = (prefix, doc = {}, fallback = '') => {
    const docId = doc.docId || doc.DOCNO || doc.docNo || '';
    const docVer = doc.docVer || doc.DOCVR || doc.docVr || '';
    if (docId) {
      return `${prefix}:${docId}:${docVer}`;
    }
    if (fallback) {
      return `${prefix}:${fallback}`;
    }
    return null;
  };

  console.log('즐겨찾기 도면/설비 목록:', { docs, equips });

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
    const infoLine = infoParts.length ? `도면정보: ${infoParts.join(' / ')}` : '';

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
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <ul className="tree-list" data-scroll-container>

        {/* ================================
            ▪ 도면 섹션
        ================================= */}
        {hasDocs && (
          <>
            <li className="tree-node" style={{ padding: '4px 0' }}>
              <div
                className="tree-node-header"
                onClick={() => setDocsOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 700,                  // ★ 굵게
                  fontSize: '15px',                 // ★ 기존보다 2배 크게
                  color: '#111',                    // 더 진하게
                  padding: '4px 0',
                }}
              >
                {docsOpen ? (
                  <ChevronDown style={{ width: 20, height: 20 }} />
                ) : (
                  <ChevronRight style={{ width: 20, height: 20 }} />
                )}

                <span style={{ marginLeft: 8 }}>
                  도면 ({docs.length})
                </span>
              </div>
            </li>

            {docsOpen &&
              docs.map((doc, idx) => {
                const metaKey = buildDocMetaKey(doc);
                const docMeta = metaKey ? docMetaMap[metaKey] : {};
                const docDisplay = buildDocDisplayInfo(doc, docMeta);
                const docHoverKey = buildHoverKey('doc', doc, `doc-${idx}`);
                const docHovered = hoveredKey === docHoverKey;
                console.log('즐겨찾기 도면 정보 확인:', docDisplay.debug);
                return (
                  <li
                    key={`fav-doc-${doc.docId || doc.DOCNO}-${doc.docVer || doc.DOCVR}`}
                    className={`tree-node favorite-tree-node${docHovered ? ' hovered' : ''}`}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => docHoverKey && handleMouseEnter(docHoverKey)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className="tree-node-header"
                      onClick={() => handleClick(doc)}
                      title={doc.docName}
                      style={{ fontSize: '15px', minWidth: 0 }} // 일반 목록은 적당히 유지
                    >
                      <FileText style={{ width: 18, height: 18 }} />
                      <div className="favorite-tree-node__text">
                        <span className="favorite-tree-node__title">
                          {docDisplay.title}
                        </span>
                        {docDisplay.infoLine && (
                          <span className="favorite-tree-node__info">
                            {docDisplay.infoLine}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
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
                className="tree-node-header"
                onClick={() => setEquipsOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#111',
                  padding: '4px 0',
                }}
              >
                {equipsOpen ? (
                  <ChevronDown style={{ width: 20, height: 20 }} />
                ) : (
                  <ChevronRight style={{ width: 20, height: 20 }} />
                )}

                <span style={{ marginLeft: 8 }}>
                  설비 ({equips.length})
                </span>
              </div>
            </li>

            {equipsOpen &&
              equips.map((eq, idx) => {
                const metaKey = buildDocMetaKey(eq);
                const eqMeta = metaKey ? docMetaMap[metaKey] : {};
                const eqDisplay = buildDocDisplayInfo(eq, eqMeta, {
                  includeDocIdentifierInInfo: true,
                });
                const eqHoverKey = buildHoverKey('equip', eq, `equip-${idx}`);
                const eqHovered = hoveredKey === eqHoverKey;
                console.log('즐겨찾기 설비 정보 확인:', eqDisplay.debug);
                return (
                    <li
                      key={`fav-eq-${eq.docId}-${eq.docVer}-${eq.function}`}
                      className={`tree-node favorite-tree-node${eqHovered ? ' hovered' : ''}`}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => eqHoverKey && handleMouseEnter(eqHoverKey)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className="tree-node-header"
                      onClick={() => handleClick(eq)}
                      title={eq.docName}
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
                      <div className="favorite-tree-node__text">
                        <span className="favorite-tree-node__title">
                          설비명: {eq.function}
                        </span>
                        {eqDisplay.infoLine && (
                          <span className="favorite-tree-node__info">
                            {eqDisplay.infoLine}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
              );
            })}
          </>
        )}
      </ul>
    </div>
  );
}
