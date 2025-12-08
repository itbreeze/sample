import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, FolderClosed, FileText, Check } from 'lucide-react';
import './TreeComboBox.css';

const TreeNode = ({ node, level, expandedNodes, onToggle, onSelect, selectedId }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isFolder = node.type === 'folder';
  const typographyVariant = hasChildren
    ? level === 0
      ? 'tree-typography--parent'
      : 'tree-typography--child'
    : 'tree-typography--leaf';

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const handleSelectNode = (e) => {
    e.stopPropagation();
    onSelect(node);
  };

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleSelectNode}
      >
        <span
          className="expand-icon"
          onClick={handleArrowClick}
          title={hasChildren ? (isExpanded ? '접기' : '펼치기') : ''}
        >
          {hasChildren && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
        </span>

        <span className="type-icon">
          {isFolder ? (
            isExpanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />
          ) : (
            <FileText size={16} />
          )}
        </span>
        <span
          className={`node-name tree-typography ${typographyVariant}`}
          title="선택"
        >
          {node.name}
        </span>
        {isSelected && (
          <span className="selected-check" title="선택됨">
            <Check size={14} />
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeComboBox = ({ data, onNodeSelect, placeholder = '항목을 선택하세요', value }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) {
      setSelectedNode({ name: value, id: null }); // id가 없는 외부 값 표시
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (nodeId) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.has(nodeId) ? newSet.delete(nodeId) : newSet.add(nodeId);
      return newSet;
    });
  };

  const handleSelect = (node) => {
    setSelectedNode(node);
    onNodeSelect(node);
    setIsOpen(false);
  };

  return (
    <div className="tree-combobox-container" ref={containerRef}>
      <div className="combobox-input" onClick={() => setIsOpen(!isOpen)}>
        <span>{value || selectedNode?.name || placeholder}</span>
        <ChevronDown size={20} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && (
        <div className="dropdown-tree">
          <div
            className={`tree-node all ${selectedNode?.id === 'ALL' ? 'selected' : ''}`}
            style={{ paddingLeft: '8px' }}
            onClick={() => {
              if (onNodeSelect) onNodeSelect('ALL');
              setSelectedNode({ id: 'ALL', name: '전체' });
              setIsOpen(false);
            }}
            title="전체"
          >
            <span className="expand-icon" style={{ visibility: 'hidden' }} />
            <span className="type-icon"><FolderClosed size={16} /></span>
          <span className="node-name tree-typography tree-typography--parent">전체</span>
          </div>

          {data.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              expandedNodes={expandedNodes}
              onToggle={handleToggle}
              onSelect={handleSelect}
              selectedId={selectedNode?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeComboBox;
