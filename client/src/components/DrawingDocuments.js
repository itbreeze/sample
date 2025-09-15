import React, { useEffect, useState } from "react";
import { FolderOpen, FolderClosed, FileText } from "lucide-react";
import "./DrawingDocuments.css";

// ----------------- 트리 빌드 -----------------
const buildTree = (items) => {
  const map = {};
  const roots = [];
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

// ----------------- DOC 카운트 -----------------
const countDocs = (node) => {
  let count = node.TYPE === "DOC" ? 1 : 0;
  if (node.CHILDREN && node.CHILDREN.length > 0) {
    count += node.CHILDREN.reduce((acc, child) => acc + countDocs(child), 0);
  }
  return count;
};

// ----------------- 트리 노드 -----------------
const TreeNode = ({ node, filter, onFileSelect = () => { } }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.CHILDREN && node.CHILDREN.length > 0;
  const docCount = countDocs(node);

  let displayName = "";
  if (node.TYPE === "DOC") {
    if (filter === "All") displayName = `[${node.DOCNUM}] ${node.DOCNAME}`;
    else if (filter === "DrawingName") displayName = node.DOCNAME || "(No Name)";
    else if (filter === "DrawingNumber") displayName = node.DOCNUM || "(No Number)";
  } else {
    displayName = node.NAME || "(No Name)";
  }

  const handleClick = () => {
    if (node.TYPE === "DOC") {
      fetch("http://localhost:4000/folders/selectDocument", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: node.ID, docVr: node.DOCVR })
      })
        .then(res => res.json())
        .then(data => {
          console.log("서버 전송 성공:", data);
          onFileSelect(data);
        })
        .catch(err => console.error("서버 전송 실패:", err));
    } else if (hasChildren) {
      setExpanded(!expanded);
    }
  };


  return (
    <li className="tree-node">
      <div className="tree-node-header" onClick={handleClick}>
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
            <TreeNode key={child.ID} node={child} filter={filter} onFileSelect={onFileSelect} />
          ))}
        </ul>
      )}
    </li>
  );
};

// ----------------- 필터링 -----------------
const filterTree = (tree, filter) => {
  if (filter === "All") return tree;

  const filtered = tree.map(node => {
    const children = node.CHILDREN ? filterTree(node.CHILDREN, filter) : [];
    let match = false;

    if (node.TYPE === "DOC") {
      if (filter === "DrawingName" && node.DOCNAME) match = true;
      if (filter === "DrawingNumber" && node.DOCNUM) match = true;
    }

    if (match || children.length > 0 || node.TYPE !== "DOC") {
      return { ...node, CHILDREN: children };
    }
    return null;
  }).filter(Boolean);

  return filtered;
};

// ----------------- 메인 컴포넌트 -----------------
const DrawingDocuments = ({ filter, onFileSelect }) => {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh"
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!tree || tree.length === 0) return <div>No folders available</div>;

  const filteredTree = filterTree(tree, filter);

  return (

    <ul className="tree-list">
      {filteredTree.map(node => (
        <TreeNode key={node.ID} node={node} filter={filter} onFileSelect={onFileSelect} />
      ))}

    </ul>
  );
};

export default DrawingDocuments;
