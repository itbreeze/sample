import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchFavorites,
  toggleFavoriteDoc,
  toggleFavoriteEquipment,
} from '../services/favorites';
import { getDocumentMetadata } from '../services/documentsApi';

const normalizeFavoriteDoc = (doc = {}) => ({
  docId: doc.docId || doc.DOCNO || doc.docNo || '',
});
const normalizeDocId = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeTagId = (value) => (typeof value === 'string' ? value.trim() : '');
const buildEquipmentKey = (equipment = {}) => ({
  docId:
    normalizeDocId(
      equipment.docId || equipment.DOCNO || equipment.docNo || equipment.docId || ''
    ) || '',
  docVer: equipment.docVer || equipment.DOCVR || equipment.docVr || '001',
  tagId:
    normalizeTagId(
      equipment.tagId || equipment.TAGNO || equipment.tagId || equipment.TAGNO_CD || ''
    ) || '',
});

export const useFavorites = () => {
  const [favoriteDocs, setFavoriteDocs] = useState([]);
  const [favoriteEquipments, setFavoriteEquipments] = useState([]);
  const [favoriteDocMeta, setFavoriteDocMeta] = useState({});
  const favoriteDocMetaRef = useRef(favoriteDocMeta);

  useEffect(() => {
    favoriteDocMetaRef.current = favoriteDocMeta;
  }, [favoriteDocMeta]);

  const updateFavorites = useCallback((favorite = {}) => {
    setFavoriteDocs(Array.isArray(favorite.documents) ? favorite.documents : []);
    setFavoriteEquipments(
      Array.isArray(favorite.equipments) ? favorite.equipments : []
    );
  }, []);

  const buildMetaKey = (doc = {}) => {
    const docId = doc.docId || doc.DOCNO || doc.docNo || doc.DOCNO;
    if (!docId) return null;
    const docVer = doc.docVer || doc.DOCVR || doc.docVr || '';
    return `${docId}-${docVer}`;
  };

  const hydrateFavoritesMeta = useCallback(
    async (favorite = {}) => {
      const documents = Array.isArray(favorite.documents) ? favorite.documents : [];
      const equipments = Array.isArray(favorite.equipments) ? favorite.equipments : [];
      const memo = new Map();

      const collect = (item) => {
        const key = buildMetaKey(item);
        if (!key || memo.has(key)) return;
        memo.set(key, {
          metaKey: key,
          docId: item.docId || item.DOCNO || item.docNo || '',
          docVr: item.docVer || item.DOCVR || item.docVr || '',
        });
      };

      documents.forEach(collect);
      equipments.forEach(collect);

      const existingMeta = favoriteDocMetaRef.current;
      const missing = Array.from(memo.values()).filter(({ metaKey }) => !existingMeta[metaKey]);
      if (!missing.length) return;

      const responses = await Promise.all(
        missing.map(({ docId, docVr }) =>
          getDocumentMetadata({ docId, docVr }).catch((err) => {
            console.error('[favorites] metadata fetch failed', { docId, docVr, err });
            return null;
          })
        )
      );

      setFavoriteDocMeta((prev) => {
        const next = { ...prev };
        missing.forEach((entry, index) => {
          const meta = responses[index];
          if (meta) {
            next[entry.metaKey] = meta;
          }
        });
        return next;
      });
    },
    []
  );

  const refreshFavorites = useCallback(async () => {
    const favorite = await fetchFavorites();
    updateFavorites(favorite);
    hydrateFavoritesMeta(favorite);
    return favorite;
  }, [updateFavorites, hydrateFavoritesMeta]);

  const toggleDocFavorite = useCallback(
    async (docMeta) => {
      const res = await toggleFavoriteDoc(docMeta);
      if (res?.favorite) {
        updateFavorites(res.favorite);
        hydrateFavoritesMeta(res.favorite);
      }
      return res;
    },
    [hydrateFavoritesMeta, updateFavorites]
  );

  const toggleEquipmentFavorite = useCallback(
    async (equipmentMeta) => {
      const res = await toggleFavoriteEquipment(equipmentMeta);
      if (res?.favorite) {
        updateFavorites(res.favorite);
        hydrateFavoritesMeta(res.favorite);
      }
      return res;
    },
    [hydrateFavoritesMeta, updateFavorites]
  );

  const isDocFavorite = useCallback(
    (doc) => {
      if (!doc) return false;
      const target = normalizeFavoriteDoc(doc);
      return favoriteDocs.some((fav) => {
        const candidate = normalizeFavoriteDoc(fav);
        return candidate.docId === target.docId;
      });
    },
    [favoriteDocs]
  );

  const isEquipmentFavorite = useCallback(
    (equipment) => {
      const target = buildEquipmentKey(equipment);
      if (!target.docId || !target.tagId) return false;
      return favoriteEquipments.some((fav) => {
        const candidate = buildEquipmentKey(fav);
        return (
          candidate.docId === target.docId &&
          candidate.docVer === target.docVer &&
          candidate.tagId === target.tagId
        );
      });
    },
    [favoriteEquipments]
  );

  return {
    favoriteDocs,
    favoriteEquipments,
    refreshFavorites,
    toggleDocFavorite,
    isDocFavorite,
    toggleEquipmentFavorite,
    isEquipmentFavorite,
    favoriteDocMeta,
  };
};
