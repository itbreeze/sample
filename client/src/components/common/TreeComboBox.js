import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, FolderClosed, FileText } from 'lucide-react';
import './TreeComboBox.css';

// TreeNode 컴포넌트는 변경 사항 없습니다.
const TreeNode = ({ node, level, expandedNodes, onToggle, onSelect, onTitleClick, selectedId }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedId === node.id;
    const isFolder = node.type === 'folder';

    const handleArrowClick = (e) => {
        e.stopPropagation();
        if (hasChildren) {
            onToggle(node.id);
        }
    };

    const handleTitleClick = (e) => {
        e.stopPropagation();
        if (isFolder) {
            onTitleClick(node);
        } else {
            onSelect(node);
        }
    };

    return (
        <div>
            <div
                onClick={handleTitleClick}
                className={`tree-node ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'}`}
                style={{ paddingLeft: `${level * 20 + 8}px` }}
            >
                <span className="expand-icon" onClick={handleArrowClick}>
                    {hasChildren && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                </span>

                <span className="type-icon">
                    {isFolder ? (
                        isExpanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />
                    ) : (
                        <FileText size={16} />
                    )}
                </span>
                <span className="node-name">{node.name}</span>
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
                            onTitleClick={onTitleClick}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


const TreeComboBox = ({ data, onNodeSelect, onTitleClick, placeholder = '항목을 선택하세요', value }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const containerRef = useRef(null);

    useEffect(() => {
        if (value) {
            console.log('[TreeComboBox] 외부 value 변경:', value);
            setSelectedNode({ name: value, id: null }); // id는 선택용이 아니므로 null
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
        console.log('[TreeComboBox] 노드 선택:', node);
        setSelectedNode(node);
        onNodeSelect(node);
        setIsOpen(false);
    };

    const handleTitleAndClose = (node) => {
        console.log('[TreeComboBox] 폴더 제목 클릭:', node);
        if (onTitleClick) {
            onTitleClick(node);
        }
        if (onNodeSelect) onNodeSelect(node);
        setSelectedNode(node); // ✅ 폴더 선택도 고정
        setIsOpen(false);
    };

    // --- ▲▲▲ [추가] ---

    return (
        <div className="tree-combobox-container" ref={containerRef}>
            <div className="combobox-input" onClick={() => setIsOpen(!isOpen)}>
                <span>{value || selectedNode?.name || placeholder}</span>
                <ChevronDown size={20} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
            </div>

            {isOpen && (
                <div className="dropdown-tree">
                    {data.map((node) => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            level={0}
                            expandedNodes={expandedNodes}
                            onToggle={handleToggle}
                            onSelect={handleSelect}
                            // --- [수정] 새로 만든 핸들러를 onTitleClick prop으로 전달 ---
                            onTitleClick={handleTitleAndClose}
                            selectedId={selectedNode?.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TreeComboBox;