import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  withCredentials: true,
});

/**
 * 사용자 인증/권한 검증 요청
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function checkUser(userId) {
  const payload = { userId: typeof userId === 'string' ? userId.trim() : '' };

  try {
    const res = await api.post('/api/auth/checkUser', payload);
    return res.data;
  } catch (err) {
    console.error('checkUser 요청 실패:', err);
    return {
      ok: false,
      allowed: false,
      found: false,
      isPsn: false,
      hasExternalAuth: false,
      stage: 'ERROR',
      message: err.response?.data?.message || 'REQUEST_FAILED',
      usePlantScopeFilter: false,
    };
  }
}

export default { checkUser };

export async function getAuthConfig() {
  try {
    const res = await api.get('/api/auth/config');
    return {
      usePlantScopeFilter:
        typeof res.data?.usePlantScopeFilter === 'boolean'
          ? res.data.usePlantScopeFilter
          : false,
    };
  } catch (err) {
    console.error('getAuthConfig 요청 실패:', err);
    return { usePlantScopeFilter: false };
  }
}
