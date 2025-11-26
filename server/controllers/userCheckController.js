const { executeQuery } = require('../utils/dataBase/oracleClient');
const { usePlantScopeFilter } = require('../utils/plantFilter');
const { setAuthCookie, clearAuthCookie } = require('../utils/auth');

const DEPT_TO_PLANT = {
  '3200': '5800',
  '7000': '6100',
  '7550': '5100',
  '7620': '5300',
  '8200': '6000',
  '8260': '5200',
  '8400': '5900',
  '8920': '5700',
};

const DEFAULT_PLANT_CODE = '0001';

const logResponse = (tag, userId, body) => {
  try {
    console.log(`[checkUser] ${tag}`, {
      userId,
      allowed: body?.allowed,
      stage: body?.stage,
      message: body?.message,
      plantScopeFilter: body?.usePlantScopeFilter,
      authId: body?.user?.sAuthId,
      isPsn: body?.user?.isPsn,
    });
  } catch (_) {
    // 로그 실패는 무시
  }
};

const buildUserPayload = (userRow, plantCode, isPsn) => ({
  userId: userRow.pernr,
  name: userRow.name,
  deptName: userRow.deptName,
  deptCode: userRow.deptCode,
  plantCode,
  authName: userRow.sAuthName || null,
  sAuthId: userRow.sAuthId || null,
  endDate: userRow.endDate || null,
  isPsn: !!isPsn,
});

async function getUpperDept(deptCode) {
  if (!deptCode) return null;

  const sql = `
    SELECT
      UP_CODE   AS "upCode",
      DEPT_NAME AS "deptName"
    FROM PT_JOJIK
    WHERE DEPT_CODE = :deptCode
  `;

  const rows = await executeQuery(sql, { deptCode });
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

async function getDeptPath(deptCode) {
  const path = [];
  if (!deptCode) return path;

  let current = String(deptCode).trim();
  const visited = new Set();

  while (current && !visited.has(current)) {
    visited.add(current);
    path.push(current);

    const upper = await getUpperDept(current);
    if (!upper || !upper.upCode) break;

    const upCode = String(upper.upCode).trim();
    if (!upCode || upCode === '0000') break;

    if (upCode === 'A000') {
      path.push('A000');
      break;
    }

    current = upCode;
  }

  return path;
}

function extractPrimaryPlantDeptCode(path) {
  if (!Array.isArray(path) || path.length < 2) return null;

  const idx = path.indexOf('A000');
  if (idx > 0) {
    return path[idx - 1];
  }

  return path[path.length - 1] || null;
}

function getPlantCodeFromDept(deptCodeForPlant) {
  if (!deptCodeForPlant) return DEFAULT_PLANT_CODE;
  const key = String(deptCodeForPlant).trim();
  return DEPT_TO_PLANT[key] || DEFAULT_PLANT_CODE;
}

async function findUserInTable(userId) {
  const sql = `
    SELECT
      I.EMGRD_NM                         AS "gradeName",
      I.DEPT_NAME                        AS "deptName",
      I.DEPT_CODE                        AS "deptCode",
      TRIM(I.PERNR)                      AS "pernr",
      I.NAME                             AS "name",
      COALESCE(U.S_AUTH_ID, 'A003')      AS "sAuthId",
      A.S_NAME                           AS "sAuthName",
      TO_CHAR(U.END_DATE, 'YYYY-MM-DD')  AS "endDate"
    FROM PT_INSA I
    LEFT JOIN IDS_USER U
      ON TRIM(I.PERNR) = TRIM(U.USERID)
    LEFT JOIN IDS_AUTH A
      ON COALESCE(U.S_AUTH_ID, 'A003') = A.S_AUTH_ID
    WHERE TRIM(I.PERNR) = :userId
  `;

  const rows = await executeQuery(sql, { userId });
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

async function checkUser(req, res) {
  try {
    const { userId } = req.body || {};
    const rawUserId = typeof userId === 'string' ? userId : '';
    const trimmedUserId = rawUserId.trim();

    console.log('[checkUser] 요청', { userId: trimmedUserId, ip: req.ip });

    if (!trimmedUserId) {
      clearAuthCookie(res);
      const body = {
        ok: false,
        allowed: false,
        found: false,
        isPsn: false,
        hasExternalAuth: false,
        stage: 'INVALID_INPUT',
        message: 'EMPTY_USER_ID',
        usePlantScopeFilter,
      };
      logResponse('응답', trimmedUserId, body);
      return res.status(400).json(body);
    }

    const userRow = await findUserInTable(trimmedUserId);

    if (!userRow) {
      clearAuthCookie(res);
      const body = {
        ok: true,
        allowed: false,
        found: false,
        isPsn: false,
        hasExternalAuth: false,
        stage: 'NO_PERMISSION',
        message: 'NO_PERMISSION',
        usePlantScopeFilter,
      };
      console.warn('[checkUser] 미존재', { userId: trimmedUserId });
      logResponse('응답', trimmedUserId, body);
      return res.json(body);
    }

    const isPsn = trimmedUserId.toLowerCase().startsWith('psn');

    const deptCode = userRow.deptCode;
    let plantCode = DEFAULT_PLANT_CODE;
    try {
      if (deptCode) {
        const deptPath = await getDeptPath(deptCode);
        const primaryDeptForPlant = extractPrimaryPlantDeptCode(deptPath) || deptCode;
        plantCode = getPlantCodeFromDept(primaryDeptForPlant);
      }
    } catch (err) {
      console.error('plantCode 계산 오류:', err);
      plantCode = DEFAULT_PLANT_CODE;
    }

    const userPayload = buildUserPayload(userRow, plantCode, isPsn);
    console.log('[checkUser] 기본정보', {
      userId: trimmedUserId,
      isPsn,
      deptCode: userRow.deptCode,
      plantCode,
      authId: userRow.sAuthId,
      endDate: userRow.endDate,
    });

    if (!isPsn) {
      setAuthCookie(res, { ...userPayload, plantScopeFilter: usePlantScopeFilter });
      const body = {
        ok: true,
        allowed: true,
        found: true,
        isPsn: false,
        hasExternalAuth: false,
        stage: 'PASS_INTERNAL',
        message: 'INTERNAL_EMPLOYEE_PASS',
        user: userPayload,
        usePlantScopeFilter,
      };
      console.log('[checkUser] 내부 직원 PASS', { userId: trimmedUserId, plantScopeFilter: usePlantScopeFilter });
      logResponse('응답', trimmedUserId, body);
      return res.json(body);
    }

    const authId = userRow.sAuthId;
    const endDateStr = userRow.endDate;

    const needsDateCheck = !authId || authId === 'A003';

    if (!needsDateCheck) {
      setAuthCookie(res, { ...userPayload, plantScopeFilter: usePlantScopeFilter });
      const body = {
        ok: true,
        allowed: true,
        found: true,
        isPsn: true,
        hasExternalAuth: true,
        stage: 'PASS_EXTERNAL',
        message: 'EXTERNAL_EMPLOYEE_PASS',
        user: userPayload,
        usePlantScopeFilter,
      };
      console.log('[checkUser] 외부 권한 PASS (날짜 검사 불필요)', { userId: trimmedUserId });
      logResponse('응답', trimmedUserId, body);
      return res.json(body);
    }

    if (!endDateStr) {
      clearAuthCookie(res);
      const body = {
        ok: true,
        allowed: false,
        found: true,
        isPsn: true,
        hasExternalAuth: !!authId,
        stage: 'NEED_EXTERNAL_AUTH',
        message: 'EXTERNAL_EMPLOYEE_NO_VALID_ENDDATE',
        user: userPayload,
        usePlantScopeFilter,
      };
      console.warn('[checkUser] 외부 권한 필요 - 종료일 없음', { userId: trimmedUserId, authId });
      logResponse('응답', trimmedUserId, body);
      return res.json(body);
    }

    let isExpired = false;
    if (endDateStr !== '1999-12-31') {
      const end = new Date(endDateStr + 'T23:59:59');
      const now = new Date();
      if (end < now) isExpired = true;
    }

    if (isExpired) {
      clearAuthCookie(res);
      const body = {
        ok: true,
        allowed: false,
        found: true,
        isPsn: true,
        hasExternalAuth: !!authId,
        stage: 'EXPIRED',
        message: 'EXTERNAL_AUTH_EXPIRED',
        user: userPayload,
        usePlantScopeFilter,
      };
      console.warn('[checkUser] 외부 권한 만료', { userId: trimmedUserId, endDate: endDateStr });
      logResponse('응답', trimmedUserId, body);
      return res.json(body);
    }

    setAuthCookie(res, { ...userPayload, plantScopeFilter: usePlantScopeFilter });
    console.log('[checkUser] 외부 권한 PASS', { userId: trimmedUserId, endDate: endDateStr });

    const body = {
      ok: true,
      allowed: true,
      found: true,
      isPsn: true,
      hasExternalAuth: !!authId,
      stage: 'PASS_EXTERNAL',
      message: 'EXTERNAL_EMPLOYEE_PASS',
      user: userPayload,
      usePlantScopeFilter,
    };
    logResponse('응답', trimmedUserId, body);
    return res.json(body);
  } catch (error) {
    console.error('checkUser error:', error);
    clearAuthCookie(res);
    const body = {
      ok: false,
      allowed: false,
      found: false,
      isPsn: false,
      hasExternalAuth: false,
      stage: 'ERROR',
      message: 'INTERNAL_SERVER_ERROR',
      usePlantScopeFilter,
    };
    logResponse('응답', 'UNKNOWN', body);
    return res.status(500).json(body);
  }
}

function getConfig(req, res) {
  return res.json({ usePlantScopeFilter });
}

function getSessionUser(req, res) {
  if (!req.authUser) {
    return res.status(401).json({
      ok: false,
      allowed: false,
      message: 'UNAUTHORIZED',
      usePlantScopeFilter,
    });
  }

  const userPayload = buildUserPayload(
    {
      pernr: req.authUser.userId,
      name: req.authUser.name,
      deptName: req.authUser.deptName,
      deptCode: req.authUser.deptCode,
      sAuthName: req.authUser.authName,
      sAuthId: req.authUser.sAuthId,
      endDate: req.authUser.endDate,
    },
    req.authUser.plantCode || DEFAULT_PLANT_CODE,
    req.authUser.isPsn
  );

  return res.json({
    ok: true,
    allowed: true,
    found: true,
    user: userPayload,
    usePlantScopeFilter:
      typeof req.authUser.plantScopeFilter === 'boolean'
        ? req.authUser.plantScopeFilter
        : usePlantScopeFilter,
  });
}

module.exports = {
  checkUser,
  getConfig,
  getSessionUser,
};
