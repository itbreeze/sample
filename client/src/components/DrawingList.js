// client/src/components/DrawingList.js

import React, { useEffect, useRef } from "react";
import { FolderOpen, FolderClosed, FileText } from "lucide-react";
import "./DrawingList.css";


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

  // 🔹 활성 노드로 스크롤 효과 (세로만, 가로는 왼쪽 고정)
  useEffect(() => {

    if (isActive && nodeRef.current) {
      // 약간의 지연을 두어 DOM 업데이트 완료 후 스크롤
      const scrollTimeout = setTimeout(() => {
        // 🔹 부모 스크롤 컨테이너 찾기
        const scrollContainer = nodeRef.current.closest('.panel.bottom') ||
          nodeRef.current.closest('[data-scroll-container]') ||
          nodeRef.current.parentElement;

        if (scrollContainer) {
          const elementRect = nodeRef.current.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();

          // 🔹 세로 스크롤만 계산
          const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
          const containerHeight = containerRect.height;
          const elementHeight = elementRect.height;

          // 화면 중앙에 배치하도록 계산
          const targetScrollTop = elementTop - (containerHeight - elementHeight) / 2;

          // 즉시 스크롤 (애니메이션 없음)
          scrollContainer.scrollTop = Math.max(0, targetScrollTop);
          scrollContainer.scrollLeft = 0; // 🔹 항상 제일 왼쪽으로 고정
        }
      }, 100);

      return () => clearTimeout(scrollTimeout);
    }
  }, [isActive]);

  let displayName = "";
  if (node.TYPE === "DOC") {
    if (filter === "DrawingName") displayName = node.DOCNAME || "(No Name)";
    else if (filter === "DrawingNumber") displayName = node.DOCNUM || "(No Number)";
    else displayName = `[${node.DOCNUM}] ${node.DOCNAME}`;
  } else {
    displayName = node.NAME || "(No Name)";
  }

  const handleClick = async () => {
       if (node.TYPE === "DOC") {
            onFileSelect(node); // 부모에게 node 정보를 그대로 전달
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

const DrawingList = ({ filter, onFileSelect, tree, loading, activeFileId, expandedNodes, onNodeToggle, onTestLoad }) => {

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
          onTestLoad={onTestLoad}
          activeFileId={activeFileId}
          depth={0}
          expandedNodes={expandedNodes}
          onNodeToggle={onNodeToggle}
        />
      ))}
    </ul>
  );
};

export default DrawingList;