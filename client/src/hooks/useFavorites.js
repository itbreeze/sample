import { useState, useCallback } from 'react';
import { fetchFavorites, toggleFavoriteDoc } from '../services/favorites';
import { getDocumentMetadata } from '../services/documentsApi';

const normalizeFavoriteDoc = (doc = {}) => ({
  docId: doc.docId || doc.DOCNO || doc.docNo || '',
});

export const useFavorites = () => {
  const [favoriteDocs, setFavoriteDocs] = useState([]);
  const [favoriteEquipments, setFavoriteEquipments] = useState([]);
  const [favoriteDocMeta, setFavoriteDocMeta] = useState({});

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

      const missing = Array.from(memo.values()).filter(({ metaKey }) => !favoriteDocMeta[metaKey]);
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
    [favoriteDocMeta]
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

  return {
    favoriteDocs,
    favoriteEquipments,
    refreshFavorites,
    toggleDocFavorite,
    isDocFavorite,
    favoriteDocMeta,
  };
};
