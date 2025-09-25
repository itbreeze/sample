import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './IntelligentToolPage.css'
import { FolderOpen, Star, Search, Waypoints, Layers, Settings, FileText, History } from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainView from './MainView';
import { Panel } from '../components/utils/Panel';
import DrawingList from './DrawingList';
import ResizablePanel from './ResizablePanel';
import { useDocumentTree } from './hooks/useDocumentTree';
import { useDocumentLoader } from './hooks/useDocumentLoader';
import SearchResultList from './Search/SearchResultList';

// --- Axios 기본 설정 ---
axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.withCredentials = true;

// --- 상수 정의 ---
const DEFAULT_EXPAND_LEVEL = 0; // 사이드바 트리 기본 확장 레벨

// 특정 노드까지의 경로를 찾는 함수
const findPathToNode = (nodes, nodeId, path = []) => {
    for (const node of nodes) {
        const newPath = [...path, node.ID];
        if (node.ID === nodeId) return newPath;
        if (node.CHILDREN) {
            const result = findPathToNode(node.CHILDREN, nodeId, newPath);
            if (result.length) return result;
        }
    }
    return [];
};

// 지정한 레벨까지 폴더 ID 수집
const collectIdsToLevel = (nodes, maxLevel, currentLevel = 0) => {
    if (currentLevel > maxLevel) return [];
    let ids = [];
    for (const node of nodes) {
        if (node.TYPE === 'FOLDER' && node.CHILDREN && node.CHILDREN.length > 0) {
            ids.push(node.ID);
            ids = ids.concat(collectIdsToLevel(node.CHILDREN, maxLevel, currentLevel + 1));
        }
    }
    return ids;
};

// 뷰 상태 추출 유틸리티
const getCurrentViewState = (viewer) => {
    if (!viewer) return null;
    const view = viewer.activeView;
    if (!view) return null;

    try {
        if (view.position && view.target && view.upVector) {
            const viewParams = {
                position: view.position.toArray(),
                target: view.target.toArray(),
                upVector: view.upVector.toArray(),
                fieldWidth: view.fieldWidth,
                fieldHeight: view.fieldHeight,
                projection: view.projection,
            };
            view.delete();
            return viewParams;
        }
    } catch (error) {
        console.warn('뷰 상태 추출 실패:', error);
    }

    if (view.delete) view.delete();
    return null;
};

// 브라우저 resize 이벤트 강제 트리거
const triggerResize = () => {
    const viewerContainer = document.getElementById("viewer-container");
    if (!viewerContainer) return;
    window.dispatchEvent(new Event("resize"));
};

// --- 정적 데이터 ---

// 상단 탭 정의
const tabItems = [
    { id: 'drawing', label: 'P&ID' },
    { id: 'pld', label: 'PLD' },
    { id: 'intelligent', label: '지능화' },
    { id: 'inherit', label: '지능화 승계' },
];

// 사이드바 메뉴 정의
const sidebarMenus = {
    drawing: [
        { id: 'search', icon: <Search size={20} />, label: '상세검색' },
        { id: 'bookmark', icon: <Star size={20} />, label: '즐겨찾기' },
        { id: 'mydocs', icon: <FolderOpen size={20} />, label: '내 문서' },
        { id: 'recentdocs', icon: <History size={20} />, label: '최근 본 도면' },
        { id: 'equipments', icon: <Settings size={20} />, label: '설비목록' },
        { id: 'pipeLayers', icon: <Waypoints size={20} />, label: '유체색' },
        { id: 'layers', icon: <Layers size={20} />, label: '레이어' },
    ],
    pld: [{ id: 'pld', icon: <FileText size={20} />, label: 'PLD Menu' }],
    intelligent: [{ id: 'intelligent', icon: <FileText size={20} />, label: 'Sample Menu' }],
    inherit: [{ id: 'inherit', icon: <FileText size={20} />, label: 'Sample Menu' }],
};

// 준비 중 컴포넌트
const NotImplemented = () => <div style={{ padding: '20px', textAlign: 'center' }}>🚧 준비 중인 기능입니다.</div>;

// 설비 관련 패널 탭
const equipmentTabs = [
    { id: "equipmentList", label: "설비목록", content: () => <NotImplemented /> },
    { id: "searchEquipment", label: "설비상세검색", content: () => <NotImplemented /> },
];

function IntelligentToolPage() {
    const { documentTree, loading: documentsLoading } = useDocumentTree();
    const { isLoading: isDocumentLoading, loadDocument } = useDocumentLoader();

    // --- 상태 관리 (State) ---
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState(tabItems[0].id);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeMenuItem, setActiveMenuItem] = useState(null);
    const [isPanelMaximized, setIsPanelMaximized] = useState(true);
    const [openFiles, setOpenFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);
    const [viewStates, setViewStates] = useState({});
    const [isFileLoaded, setIsFileLoaded] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isTabSwitching, setIsTabSwitching] = useState(false);
    const tabSwitchTimeoutRef = useRef(null);
    const currentViewerInstanceRef = useRef(null);
    const [activeSearchTab, setActiveSearchTab] = useState("documentList");

    // 검색 정보 상태 추가
    const [searchInfo, setSearchInfo] = useState(null); // { type, term }

    // 상세검색으로 이동하는 핸들러
    const handleViewDetailSearch = (searchType, searchTerm) => {
        setSearchInfo({ type: searchType, term: searchTerm });
        setActiveMenuItem('search');
        setActiveSearchTab("searchDrawing"); // 도면상세검색 탭으로 전환
    };

    // --- 이벤트 핸들러 ---

    // 사이드바 메뉴 클릭 시, 패널을 열고 최대화
    const handleMenuClick = (menuId) => {
        setActiveMenuItem(menuId);
        const config = PANEL_CONFIG[menuId];
        if (config) {
            setIsPanelMaximized(config.startsMaximized);
        }
    };

    // 로고 클릭 시, 사이드바와 패널을 닫고 검색 상태 초기화
    const handleLogoClick = () => {
        setActiveMenuItem(null);
        setSearchResults([]);
        setSearchInfo(null); // 검색 정보도 초기화
    };

    // 메인 뷰 클릭 시, 사이드바와 패널 닫기
    const handleMainViewClick = (e) => {
        if (e.target.closest('.view-tab')) return;
        setActiveMenuItem(null);
    };

    // 뷰 상태 변경 저장
    const handleViewStateChange = useCallback((docno, viewState) => {
        setViewStates(prev => ({
            ...prev,
            [docno]: {
                ...viewState,
                timestamp: Date.now()
            }
        }));
    }, []);

    // 검색 실행 - searchInfo도 함께 설정
    const handleSearch = async (searchType, searchTerm) => {
        if (!searchTerm.trim()) return;
        setIsSearching(true);
        setSearchInfo({ type: searchType, term: searchTerm }); // 검색 정보 설정

        try {
            const response = await fetch("http://localhost:4000/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ searchType, searchTerm })
            });
            if (!response.ok) throw new Error('검색 요청 실패');
            const results = await response.json();
            setSearchResults(results);
        } catch (error) {
            console.error("검색 실패:", error);
            alert("검색 중 오류가 발생했습니다.");
        } finally {
            setIsSearching(false);
        }
    };

    // 파일(도면) 선택 시, 뷰어에 탭을 추가하고 패널을 최소화
    const handleFileSelect = useCallback(async (fileIdentifier) => {
        // fileIdentifier는 { docId, docVr } 형태의 객체입니다.
        const loadedFile = await loadDocument(fileIdentifier);

        if (loadedFile) {
            // 훅을 통해 성공적으로 파일 정보를 받아왔을 때만 탭을 엽니다.
            setOpenFiles(prevOpenFiles => {
                const isAlreadyOpen = prevOpenFiles.some(f => f.DOCNO === loadedFile.DOCNO);
                if (isAlreadyOpen) {
                    return [loadedFile, ...prevOpenFiles.filter(f => f.DOCNO !== loadedFile.DOCNO)];
                }
                return [loadedFile, ...prevOpenFiles];
            });
            setActiveFileId(loadedFile.DOCNO);
            setIsFileLoaded(true);
            setIsPanelMaximized(false);
        }
    }, [loadDocument]);

    // 뷰어 탭 클릭 핸들러
    const handleTabClick = useCallback((docno) => {
        if (docno === activeFileId || isTabSwitching) return;
        setIsTabSwitching(true);

        if (tabSwitchTimeoutRef.current) {
            clearTimeout(tabSwitchTimeoutRef.current);
        }

        if (currentViewerInstanceRef.current && activeFileId) {
            try {
                const currentState = getCurrentViewState(currentViewerInstanceRef.current);
                if (currentState) {
                    handleViewStateChange(activeFileId, currentState);
                }
            } catch (error) {
                console.warn('뷰 상태 저장 실패:', error);
            }
        }
        setActiveFileId(docno);
        tabSwitchTimeoutRef.current = setTimeout(() => {
            setIsTabSwitching(false);
        }, 300);
    }, [activeFileId, handleViewStateChange, isTabSwitching]);

    // 뷰어 탭 닫기 핸들러
    const handleTabClose = (docnoToClose) => {
        const newOpenFiles = openFiles.filter(file => file.DOCNO !== docnoToClose);
        setOpenFiles(newOpenFiles);
        setViewStates(prev => {
            const newStates = { ...prev };
            delete newStates[docnoToClose];
            return newStates;
        });
        if (activeFileId === docnoToClose) {
            setActiveFileId(newOpenFiles.length > 0 ? newOpenFiles[0].DOCNO : null);
            if (newOpenFiles.length === 0) setIsFileLoaded(false);
        }
    };

    // 뷰어 탭 순서 변경 핸들러
    const handleTabReorder = (newFiles, draggedFileId) => {
        setOpenFiles(newFiles);
        setActiveFileId(draggedFileId);
    };

    // 뷰어 인스턴스 준비 완료 시 콜백
    const handleViewerReady = useCallback((viewerInstance) => {
        currentViewerInstanceRef.current = viewerInstance;
        window.currentViewerInstance = viewerInstance;
    }, []);

    // 트리 노드 확장/축소 핸들러
    const handleNodeToggle = (nodeId) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) newSet.delete(nodeId);
            else newSet.add(nodeId);
            return newSet;
        });
    };

    // --- 데이터 로딩 및 사이드 이펙트(useEffect) ---

    // 최초 사용자 접근 권한 확인
    useEffect(() => {
        const checkUserAccess = async () => {
            try {
                const response = await axios.get('/api/users/profile');
                setUser(response.data);
            } catch (err) {
                const errorMessage = err.response?.data?.message || '접근 권한이 없습니다.';
                alert(errorMessage);
                window.close();
            } finally {
                setLoading(false);
            }
        };
        checkUserAccess();
    }, []);

    // 활성 탭 변경 시 사이드바 메뉴 초기화
    useEffect(() => {
        setActiveMenuItem(null);
    }, [activeTab]);

    // 활성 파일 변경 시 트리에서 해당 파일 위치로 스크롤 및 확장
    useEffect(() => {
        if (documentTree.length > 0 && activeFileId) {
            const path = findPathToNode(documentTree, activeFileId);
            if (path.length > 0) {
                setExpandedNodes(new Set(path.slice(0, -1)));
            }
        }
    }, [activeFileId, documentTree]);

    // 패널 상태 변경 시 뷰어 리사이즈 트리거
    useEffect(() => {
        if (!isFileLoaded) return;
        const timer = setTimeout(triggerResize, 150);
        return () => clearTimeout(timer);
    }, [activeMenuItem, isFileLoaded]);

    // 컴포넌트 언마운트 시 타임아웃 정리
    useEffect(() => {
        return () => {
            if (tabSwitchTimeoutRef.current) {
                clearTimeout(tabSwitchTimeoutRef.current);
            }
        };
    }, []);

    // --- 렌더링 ---

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>사용자 권한을 확인 중입니다...</p>
            </div>
        );
    }

    // 검색 패널의 탭 정의
    const searchTabs = [
        {
            id: "documentList",
            label: "도면목록",
            content: (filter) => <DrawingList
                filter={filter}
                onFileSelect={(node) => handleFileSelect({ docId: node.ID, docVr: node.DOCVR })}
                tree={documentTree}
                loading={documentsLoading}
                activeFileId={activeFileId}
                expandedNodes={expandedNodes}
                onNodeToggle={handleNodeToggle}
            />,
        },
        {
            id: "searchDrawing",
            label: "도면상세검색",
            content: () => <SearchResultList
                searchResults={searchResults}
                searchInfo={searchInfo}
                onFileSelect={handleFileSelect}
            />
        },
        { id: "searchEquipment", label: "설비상세검색", content: () => <NotImplemented /> },
    ];

    const PANEL_CONFIG = {
        search: {
            component: (
                <Panel
                    tabs={searchTabs}
                    defaultTab={activeSearchTab}
                    showFilterTabs={['documentList']}
                />
            ),
            startsMaximized: true,
            isResizable: true
        },
        equipments: { component: <Panel tabs={equipmentTabs} defaultTab="equipmentList" />, startsMaximized: true, isResizable: true },
        bookmark: { component: <NotImplemented />, startsMaximized: false, isResizable: true },
        mydocs: { component: <NotImplemented />, startsMaximized: false, isResizable: true },
        recentdocs: { component: <NotImplemented />, startsMaximized: true, isResizable: true },
        pipeLayers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
        layers: { component: <NotImplemented />, startsMaximized: false, isResizable: false },
    };

    const activePanelConfig = PANEL_CONFIG[activeMenuItem];
    const isPanelOpen = activeMenuItem !== null;

    return (
        <div className="tool-page-layout">
            <Header
                user={user}
                tabItems={tabItems}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogoClick={handleLogoClick}
                onSearch={handleSearch}
                onFileSelect={(node) => handleFileSelect({ docId: node.DOCNO, docVr: node.DOCVR })}
                onViewDetailSearch={handleViewDetailSearch}
            />
            <div className="content-wrapper">
                <Sidebar
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    menuItems={sidebarMenus[activeTab] || []}
                    activeMenuItem={activeMenuItem}
                    onMenuItemClick={handleMenuClick}
                    user={user}
                    isFileLoaded={isFileLoaded}
                />

                {isPanelOpen && activePanelConfig && (
                    <ResizablePanel
                        key={activeMenuItem}
                        initialWidth={isPanelMaximized ? 800 : 300}
                        minWidth={300}
                        maxWidth={800}
                        isResizable={activePanelConfig.isResizable}
                    >
                        {activePanelConfig.component}
                    </ResizablePanel>
                )}

                <MainView
                    openFiles={openFiles}
                    activeFileId={activeFileId}
                    onTabClick={handleTabClick}
                    onTabClose={handleTabClose}
                    onTabReorder={handleTabReorder}
                    onMainViewClick={handleMainViewClick}
                    viewStates={viewStates}
                    onViewStateChange={handleViewStateChange}
                    onViewerReady={handleViewerReady}
                    isTabSwitching={isTabSwitching}
                />
            </div>
        </div>
    );
}

export default IntelligentToolPage;