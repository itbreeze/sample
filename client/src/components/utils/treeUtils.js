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
