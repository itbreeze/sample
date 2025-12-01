import { useState, useEffect, useMemo } from 'react';
import { getCurrentUser } from '../auth/AuthModule';
import { persistPlantContext } from '../services/api';

const normalizeUser = (payload = {}) => ({
  userId: payload.userId || '',
  userName: payload.name || payload.userName || '',
  positionName: payload.authName || payload.positionName || '',
  department: payload.deptName || payload.department || '',
  departCode: payload.deptCode || payload.departCode || '',
  plantCode: payload.plantCode || '',
  sAuthId: payload.sAuthId || '',
  endDate: payload.endDate || '',
  plantScopeFilter:
    typeof payload.plantScopeFilter === 'boolean'
      ? payload.plantScopeFilter
      : undefined,
});

const parseWindowPayload = () => {
  if (!window?.name) return null;
  try {
    const parsed = JSON.parse(window.name);
    if (parsed && parsed.userId) {
      console.log('ECM 인증 :', parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('window.name payload 파싱 실패:', err);
  }
  return null;
};

const DEFAULT_AUTH_ERROR_MESSAGE =
  '인증 정보가 없거나 만료되었습니다. Mockup-ECM에서 먼저 로그인해주세요.';

export const useAuthState = () => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirectedForAuth, setRedirectedForAuth] = useState(false);

  const limitedAuth = useMemo(() => {
    if (!user) return true;
    const sAuthId = String(user.sAuthId || '').trim().toUpperCase();
    return !user.sAuthId || sAuthId === 'A003';
  }, [user]);

  useEffect(() => {
    const hydrateUser = async () => {
      setAuthError(null);

      const ecmPayload = parseWindowPayload();
      if (ecmPayload) {
        const nextUser = normalizeUser(ecmPayload);
        setUser(nextUser);
        persistPlantContext({
          plantCode: nextUser.plantCode,
          plantScopeFilter: nextUser.plantScopeFilter,
        });
        setLoading(false);
        return;
      }

      try {
        const session = await getCurrentUser();
        if (session?.ok && session.user) {
          const nextUser = normalizeUser({
            ...session.user,
            plantScopeFilter:
              typeof session.usePlantScopeFilter === 'boolean'
                ? session.usePlantScopeFilter
                : session.user.plantScopeFilter,
          });

          setUser(nextUser);
          persistPlantContext({
            plantCode: nextUser.plantCode,
            plantScopeFilter: nextUser.plantScopeFilter,
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('세션 사용자 조회 실패:', err);
      }

      persistPlantContext(null);
      setUser(null);
      setAuthError(DEFAULT_AUTH_ERROR_MESSAGE);
      setLoading(false);
    };

    hydrateUser();
  }, []);

  useEffect(() => {
    if (loading || redirectedForAuth) return;
    if (!user || authError) {
      const message = authError || DEFAULT_AUTH_ERROR_MESSAGE;
      setRedirectedForAuth(true);
      alert(message);
      persistPlantContext(null);
      if (window?.history?.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  }, [authError, loading, redirectedForAuth, user]);

  return {
    user,
    loading,
    authError,
    limitedAuth,
    setUser,
    setAuthError,
  };
};
