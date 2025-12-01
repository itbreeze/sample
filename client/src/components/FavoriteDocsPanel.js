// client/src/components/FavoriteDocsPanel.js

import React, { useState } from 'react';
import { FileText, FileCog, ChevronRight, ChevronDown } from 'lucide-react';


export default function FavoriteDocsPanel({
  items,
  documentItems = [],
  equipmentItems = [],
  onFileSelect,
}) {
  const docs =
    documentItems && documentItems.length > 0 ? documentItems : items || [];
  const equips = equipmentItems || [];

  const hasDocs = docs.length > 0;
  const hasEquips = equips.length > 0;

  const [docsOpen, setDocsOpen] = useState(true);
  const [equipsOpen, setEquipsOpen] = useState(true);

  if (!hasDocs && !hasEquips) {
    return <div style={{ padding: 20 }}>즐겨찾기된 도면/설비가 없습니다.</div>;
  }

  const handleClick = (item) => {    
    onFileSelect({
      docId: item.docId || item.DOCNO || item.docNO,
      docVr: item.docVer || item.DOCVR,
    });
  };


  console.log('즐겨찾기 도면/설비 목록:', { docs, equips });

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
              docs.map((doc) => (
                <li
                  key={`fav-doc-${doc.docId || doc.DOCNO}-${doc.docVer || doc.DOCVR}`}
                  className="tree-node"
                >
                  <div
                    className="tree-node-header"
                    onClick={() => handleClick(doc)}
                    title={doc.docName}
                    style={{ fontSize: '15px' }} // 일반 목록은 적당히 유지
                  >
                    <FileText style={{ width: 18, height: 18 }} />
                    <span
                      style={{
                        marginLeft: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {`[${doc.docNumber || ''}] ${doc.docName || ''}`}
                    </span>
                  </div>
                </li>
              ))}
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
              equips.map((eq) => (
                <li
                  key={`fav-eq-${eq.docId}-${eq.docVer}-${eq.function}`}
                  className="tree-node"
                >
                  <div
                    className="tree-node-header"
                    onClick={() => handleClick(eq)}
                    title={eq.docName}
                    style={{ fontSize: '15px' }} // 목록 표시는 유지
                  >
                    <FileCog style={{ width: 18, height: 18 }} />
                    <span
                      style={{
                        marginLeft: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#555' }}>
                        {`설비명: ${eq.function}`}
                      </div>
                      <div style={{ fontSize: '13px', color: '#555' }}>
                        {`도면정보: [${eq.docNumber}] ${eq.docName}`}

                      </div>


                    </span>
                  </div>
                </li>
              ))}
          </>
        )}
      </ul>
    </div>
  );
}
