const parseHandles = (value) => {
  if (!value) return [];
  return value
    .split('/')
    .map((handle) => (typeof handle === 'string' ? handle.trim() : ''))
    .filter(Boolean);
};

const sortByLabel = (a, b) => (a.label || '').localeCompare(b.label || '');

export const normalizeHandles = (handles = []) => {
  return handles
    .map((handle) => (handle ? String(handle) : ''))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);
};

export const buildEquipmentModel = (rows = []) => {
  const nodes = new Map();

  rows.forEach((row) => {
    if (!row?.libId) return;
    if (!nodes.has(row.libId)) {
      nodes.set(row.libId, {
        id: row.libId,
        label: row.libDesc || row.libName || `LIB-${row.libId}`,
        description: row.libDesc || null,
        parent: row.parent || null,
        level: row.libLv || null,
        tagsMap: new Map(),
        tags: [],
        children: [],
        metadata: {
          docId: row.docno || null,
          docVer: row.docVer || null,
          intelligent: row.intelligent || null,
          connection: row.connection || null,
        },
      });
    }

    const node = nodes.get(row.libId);

    if (row.tagId) {
      const tagId = row.tagId;
      const existing = node.tagsMap.get(tagId);
      const handles = parseHandles(row.handle);

      if (existing) {
        handles.forEach((handle) => {
          if (!existing.handles.includes(handle)) {
            existing.handles.push(handle);
          }
        });
      } else {
        node.tagsMap.set(tagId, {
          id: tagId,
          label: row.function || row.intelligent || tagId || '기타',
          tagType: row.tagType || 'UNKNOWN',
          handles,
        });
      }
    }
  });

  nodes.forEach((node) => {
    node.tags = Array.from(node.tagsMap.values());
    node.tagsMap = undefined;
  });

  const roots = [];
  nodes.forEach((node) => {
    if (node.parent && nodes.has(node.parent)) {
      nodes.get(node.parent).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const handleCache = new Map();
  const parentByLibId = new Map();
  const allHandles = new Set();

  const annotateNode = (node) => {
    const handles = new Set();
    node.tags?.forEach((tag) => {
      tag.handles?.forEach((handle) => {
        handles.add(handle);
        allHandles.add(handle);
      });
    });

    node.children?.forEach((child) => {
      const childHandles = annotateNode(child);
      childHandles.forEach((handle) => handles.add(handle));
    });

    node.totalHandles = Array.from(handles);
    node.totalCount = handles.size;
    handleCache.set(node.id, node.totalHandles);
    parentByLibId.set(node.id, node.parent);
    node.children = node.children.sort(sortByLabel);
    return handles;
  };

  roots.forEach((root) => annotateNode(root));
  const sortedRoots = roots.sort(sortByLabel);

  return {
    tree: sortedRoots,
    allHandles: Array.from(allHandles),
    handlesByLibId: handleCache,
    parentByLibId,
  };
};

export const getHandlesByLibId = (map = new Map(), libId) => map.get(libId) || [];
export const getAllHandles = (model) => model?.allHandles || [];
export const getParentIdByLibId = (model, libId) => model?.parentByLibId?.get(libId) || null;

export const commonFunc = {
  buildEquipmentModel,
  getHandlesByLibId,
  getAllHandles,
  getParentIdByLibId,
  normalizeHandles,
};
