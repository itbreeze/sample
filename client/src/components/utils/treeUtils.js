/**
 * 배열 형태의 데이터를 트리 구조로 변환합니다.
 * @param {Array} items - PARENTID 속성을 가진 객체 배열
 * @returns {Array} 트리 구조의 배열
 */
export const buildTree = (items) => {
    const map = {};
    const roots = [];
    if (!items) return roots;

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
 * 트리 구조의 노드 배열에서 특정 ID를 가진 노드를 재귀적으로 찾습니다.
 * @param {Array} nodes - 검색 대상 노드 배열
 * @param {String|Number} id - 찾고자 하는 노드의 ID
 * @returns {Object|null} - 찾은 노드 객체 또는 null
 */
export const findNodeById = (nodes, id) => {
    if (!nodes || !id) return null;

    for (const node of nodes) {
        // ID가 문자열과 숫자 타입 간에 일치하지 않을 수 있으므로 타입 비교를 느슨하게 합니다.
        if (node.id == id) {
            return node;
        }
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
};