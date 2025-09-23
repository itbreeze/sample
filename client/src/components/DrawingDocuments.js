import React, { useEffect, useRef } from "react";
import { FolderOpen, FolderClosed, FileText } from "lucide-react";
import "./DrawingDocuments.css";

const countDocs = (node) => {
  let count = node.TYPE === "DOC" ? 1 : 0;
  if (node.CHILDREN && node.CHILDREN.length > 0) {
    count += node.CHILDREN.reduce((acc, child) => acc + countDocs(child), 0);
  }
  return count;
};

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

const TreeNode = ({ node, filter, onFileSelect, activeFileId, depth, expandedNodes, onNodeToggle }) => {
  const nodeRef = useRef(null);
  const isExpanded = expandedNodes.has(node.ID);
  const hasChildren = node.CHILDREN && node.CHILDREN.length > 0;
  const docCount = countDocs(node);
  const isActive = node.ID === activeFileId;

  let displayName = "";
  if (node.TYPE === "DOC") {
    if (filter === "DrawingName") displayName = node.DOCNAME || "(No Name)";
    else if (filter === "DrawingNumber") displayName = node.DOCNUM || "(No Number)";
    else displayName = `[${node.DOCNUM}] ${node.DOCNAME}`;
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
        .then(data => onFileSelect(data))
        .catch(err => console.error("서버 전송 실패:", err));
    } else if (hasChildren) {
        onNodeToggle(node.ID);
    }
  };

  const headerClasses = [
    'tree-node-header',
    isActive ? 'active' : '',
  ].filter(Boolean).join(' ');

  return (
    <li className="tree-node">
      <div 
        ref={nodeRef}
        className={headerClasses}
        onClick={handleClick}
        title={displayName}
      >
        {node.TYPE === "DOC" ? (
          <FileText style={{ flexShrink: 0, width: "16px", height: "16px" }} />
        ) : hasChildren ? (
          isExpanded ? <FolderOpen style={{ flexShrink: 0, width: "16px", height: "16px" }} />
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

      {isExpanded && hasChildren && (
        <ul className="tree-children">
          {node.CHILDREN.map(child => (
            <TreeNode 
              key={child.ID} 
              node={child} 
              filter={filter} 
              onFileSelect={onFileSelect} 
              activeFileId={activeFileId}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onNodeToggle={onNodeToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const DrawingDocuments = ({ filter, onFileSelect, tree, loading, activeFileId, expandedNodes, onNodeToggle }) => {

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
          activeFileId={activeFileId}
          depth={0}
          expandedNodes={expandedNodes}
          onNodeToggle={onNodeToggle}
        />
      ))}
    </ul>
  );
};

export default DrawingDocuments;