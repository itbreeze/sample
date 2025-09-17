import React, { useEffect, useState } from "react";
import { FolderOpen, FolderClosed, FileText } from "lucide-react";
import "./DrawingDocuments.css";

// --- Helper Functions (컴포넌트 외부에 정의) ---

/**
 * 평탄한 아이템 목록으로 트리 구조를 만듭니다.
 * @param {Array} items - DB에서 가져온 폴더 및 문서 목록
 * @returns {Array} - 트리 구조화된 데이터
 */
const buildTree = (items) => {
  const map = {};
  const roots = [];
  if (!items) return roots; // 데이터가 없으면 빈 배열 반환

  items.forEach(item => {
    map[item.ID] = { ...item, CHILDREN: [] };
  });

  items.forEach(item => {
    if (item.PARENTID && map[item.PARENTID]) {
      map[item.PARENTID].CHILDREN.push(map[item.ID]);
    } else {
      roots.push(map[item.ID]);
    }
  });
  return roots;
};

/**
 * 특정 노드 하위의 모든 문서(DOC) 개수를 재귀적으로 계산합니다.
 * @param {object} node - 트리 노드
 * @returns {number} - 문서 개수
 */
const countDocs = (node) => {
  let count = node.TYPE === "DOC" ? 1 : 0;
  if (node.CHILDREN && node.CHILDREN.length > 0) {
    count += node.CHILDREN.reduce((acc, child) => acc + countDocs(child), 0);
  }
  return count;
};

/**
 * 트리를 필터링하고 빈 폴더를 제거하는 재귀 함수
 * @param {Array} nodes - 필터링할 노드 배열
 * @param {string} filter - 필터 종류 ('All', 'DrawingName', 'DrawingNumber')
 * @returns {Array} - 필터링된 트리 데이터
 */
const filterTree = (nodes, filter) => {
  if (filter === 'All' || !nodes) return nodes;

  return nodes.reduce((acc, node) => {
    const filteredChildren = node.CHILDREN ? filterTree(node.CHILDREN, filter) : [];
    let isMatch = false;
    
    if (node.TYPE === 'DOC') {
      if (filter === 'DrawingName' && node.DOCNAME) isMatch = true;
      if (filter === 'DrawingNumber' && node.DOCNUM) isMatch = true;
    }

    if (isMatch || (node.TYPE === 'FOLDER' && filteredChildren.length > 0)) {
      acc.push({ ...node, CHILDREN: filteredChildren });
    }

    return acc;
  }, []);
};


// --- TreeNode Component ---

const TreeNode = ({ node, filter, onFileSelect, selectedId, setSelectedId, depth, initialExpandDepth }) => {
  const [expanded, setExpanded] = useState(depth < initialExpandDepth);
  const hasChildren = node.CHILDREN && node.CHILDREN.length > 0;
  const docCount = countDocs(node);

  let displayName = "";
  if (node.TYPE === "DOC") {
    if (filter === "DrawingName") displayName = node.DOCNAME || "(No Name)";
    else if (filter === "DrawingNumber") displayName = node.DOCNUM || "(No Number)";
    else displayName = `[${node.DOCNUM}] ${node.DOCNAME}`;
  } else {
    displayName = node.NAME || "(No Name)";
  }

  const handleClick = () => {
    setSelectedId(node.ID);
    if (node.TYPE === "DOC") {
      fetch("http://localhost:4000/folders/selectDocument", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: node.ID, docVr: node.DOCVR })
      })
        .then(res => res.json())
        .then(data => onFileSelect(data))
        .catch(err => console.error("서버 전송 실패:", err));
    } else if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <li className="tree-node">
      <div 
        className={`tree-node-header ${node.ID === selectedId ? 'active' : ''}`} 
        onClick={handleClick}
        title={displayName}
      >
        {node.TYPE === "DOC" ? (
          <FileText style={{ flexShrink: 0, width: "16px", height: "16px" }} />
        ) : hasChildren ? (
          expanded ? <FolderOpen style={{ flexShrink: 0, width: "16px", height: "16px" }} />
            : <FolderClosed style={{ flexShrink: 0, width: "16px", height: "16px" }} />
        ) : (
          <FolderClosed style={{ flexShrink: 0, width: "16px", height: "16px" }} />
        )}
        <span style={{
          marginLeft: "5px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}>
          {displayName}
        </span>
        {node.TYPE !== "DOC" && docCount > 0 && <span> ({docCount})</span>}
      </div>

      {expanded && hasChildren && (
        <ul className="tree-children">
          {node.CHILDREN.map(child => (
            <TreeNode 
              key={child.ID} 
              node={child} 
              filter={filter} 
              onFileSelect={onFileSelect} 
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              depth={depth + 1}
              initialExpandDepth={initialExpandDepth}
            />
          ))}
        </ul>
      )}
    </li>
  );
};


// --- Main Component ---

const DrawingDocuments = ({ filter, onFileSelect, initialExpandDepth = 1 }) => {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch("http://localhost:4000/folders")
      .then(res => res.json())
      .then(data => {
        setTree(buildTree(data));
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setTree([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return <div>도면 목록을 불러올 수 없습니다.</div>;
  }

  const filteredTree = filterTree(tree, filter) || [];

  return (
    <ul className="tree-list">
      {filteredTree.map(node => (
        <TreeNode 
          key={node.ID} 
          node={node} 
          filter={filter} 
          onFileSelect={onFileSelect}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          depth={0}
          initialExpandDepth={initialExpandDepth}
        />
      ))}
    </ul>
  );
};

export default DrawingDocuments;