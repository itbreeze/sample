// client/src/services/favorites.js
import axios from 'axios';

export const fetchFavorites = async () => {
  const res = await axios.get('/api/auth/favorites', { withCredentials: true });
  console.log('Fetched favorites:', res.data.favorite);
   return res.data.favorite || { documents: [], equipments: [] };
};

export const toggleFavoriteDoc = async (docMeta) => {
  const res = await axios.post(
    '/api/auth/favorites/toggle',
    docMeta,
    { withCredentials: true }
  );
  return res.data; // { ok, userId, favorite, isFavorite }
};
