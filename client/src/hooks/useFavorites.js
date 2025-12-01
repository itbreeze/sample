import { useState, useCallback } from 'react';
import { fetchFavorites, toggleFavoriteDoc } from '../services/favorites';

const normalizeFavoriteDoc = (doc = {}) => ({
  docId: doc.docId || doc.DOCNO || doc.docNo || '',
  docVer: doc.docVer || doc.DOCVR || '',
});

export const useFavorites = () => {
  const [favoriteDocs, setFavoriteDocs] = useState([]);
  const [favoriteEquipments, setFavoriteEquipments] = useState([]);

  const updateFavorites = useCallback((favorite = {}) => {
    setFavoriteDocs(Array.isArray(favorite.documents) ? favorite.documents : []);
    setFavoriteEquipments(
      Array.isArray(favorite.equipments) ? favorite.equipments : []
    );
  }, []);

  const refreshFavorites = useCallback(async () => {
    const favorite = await fetchFavorites();
    updateFavorites(favorite);
    return favorite;
  }, [updateFavorites]);

  const toggleDocFavorite = useCallback(
    async (docMeta) => {
      const res = await toggleFavoriteDoc(docMeta);
      if (res?.favorite) {
        updateFavorites(res.favorite);
      }
      return res;
    },
    [updateFavorites]
  );

  const isDocFavorite = useCallback(
    (doc) => {
      if (!doc) return false;
      const target = normalizeFavoriteDoc(doc);
      return favoriteDocs.some((fav) => {
        const candidate = normalizeFavoriteDoc(fav);
        return (
          candidate.docId === target.docId &&
          candidate.docVer === target.docVer
        );
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
  };
};
