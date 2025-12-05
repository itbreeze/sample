// client/src/services/favorites.js
import axios from 'axios';

export const fetchFavorites = async () => {
  const res = await axios.get('/api/auth/favorites', { withCredentials: true });
  return res.data.favorite || { documents: [], equipments: [] };
};

export const toggleFavoriteDoc = async (docMeta) => {
  const res = await axios.post(
    '/api/auth/favorites/docnument/toggle',
    docMeta,
    { withCredentials: true }
  );
  return res.data; // { ok, userId, favorite, isFavorite }
};

export const toggleFavoriteEquipment = async (equipmentMeta) => {
  const res = await axios.post(
    '/api/auth/favorites/equipment/toggle',
    equipmentMeta,
    { withCredentials: true }
  );
  return res.data;
};
