/**
 * 플랫한 배열 데이터를 계층적인 트리 구조로 변환합니다.
 * 각 항목은 'id', 'parentId', 'name' 속성을 가져야 합니다.
 * * @param {Array} flatData - 변환할 플랫 데이터 배열
 * @param {string} rootId - 최상위 노드의 parentId 값
 * @returns {Array} - 계층 구조를 가진 트리 데이터 배열
 */
export const transformToTreeData = (flatData, rootId = null) => {
    const nodeMap = new Map();
    const tree = [];

    // 1. 모든 노드를 Map에 저장하여 쉽게 찾을 수 있도록 함
    flatData.forEach(item => {
        nodeMap.set(item.id, { ...item, children: [] });
    });

    // 2. 각 노드를 순회하며 부모-자식 관계 설정
    nodeMap.forEach(node => {
        // 부모 ID가 있는 경우, Map에서 부모를 찾아 children 배열에 추가
        if (node.parentId !== rootId && nodeMap.has(node.parentId)) {
            const parent = nodeMap.get(node.parentId);
            parent.children.push(node);
        } 
        // 부모 ID가 없는 최상위 노드인 경우, tree 배열에 바로 추가
        else {
            tree.push(node);
        }
    });

    // 자식 노드가 없는 폴더 타입을 'file'로 간주할 경우의 로직 (필요시 활성화)
    const setNodeType = (nodes) => {
        for (const node of nodes) {
            if (node.children.length === 0) {
                 // API 데이터에 type 필드가 없다면 기본값을 설정할 수 있습니다.
                 // 예: node.type = 'file'; 
            } else {
                // 예: node.type = 'folder';
                setNodeType(node.children);
            }
        }
    };
    
    // setNodeType(tree); // 필요하다면 이 함수를 호출하세요.

    return tree;
};

/**
 * API 응답 데이터를 TreeComboBox에서 사용할 수 있는 형식으로 변환합니다.
 * 백엔드 데이터의 키 이름을 id, parentId, name으로 매핑합니다.
 * * @param {Array} apiData - /api/search/levels 에서 받은 원본 데이터
 * @returns {Array} - TreeComboBox에 적합한 형식의 플랫 데이터
 */
export const formatLevelDataForTree = (apiData) => {
    return apiData.map(item => ({
        id: item.LEVEL_CD,       // 'LEVEL_CD'를 'id'로 매핑
        parentId: item.PARENT_CD || null, // 'PARENT_CD'를 'parentId'로 매핑 (없으면 null)
        name: item.LEVEL_NM,     // 'LEVEL_NM'을 'name'으로 매핑
        type: item.NODE_TYPE || 'file' // 'NODE_TYPE'이 있으면 사용, 없으면 'file' 기본값
    }));
};