// server/controllers/userCheckController.js

const { executeQuery } = require('../utils/dataBase/oracleClient');
const { usePlantScopeFilter } = require('../utils/plantFilter');
const { setAuthCookie, clearAuthCookie } = require('../utils/auth');
const { json } = require('body-parser');

const normalizeUserId = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeDocId = (value) => (typeof value === 'string' ? value.trim() : '');

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

const buildUserPayload = (userRow, plantCode, isPsn) => {
  const normalizedUserId = normalizeUserId(userRow?.pernr);

  return {
    userId: normalizedUserId || null,
    name: userRow.name,
    deptName: userRow.deptName,
    deptCode: userRow.deptCode,
    plantCode,
    authName: userRow.sAuthName || null,
    sAuthId: userRow.sAuthId || null,
    endDate: userRow.endDate || null,
    isPsn: !!isPsn,
  };
};

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
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

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

  const rows = await executeQuery(sql, { userId: normalizedUserId });
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

async function checkUser(req, res) {
  try {
    const { userId } = req.body || {};
    const trimmedUserId = normalizeUserId(userId);

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



/**
 * USERCONTEXTS 테이블에서 사용자 컨텍스트 JSON 한 건 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<object|null>}
 */
// CONTEXTS (실제는 USERCONTEXTS)에서 사용자 컨텍스트 JSON 읽기
// controllers/userCheckController.js

// CONTEXTS (USERCONTEXTS)에서 사용자 컨텍스트 JSON 읽기

async function findUserContext(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

  const sql = `
    SELECT
      CONTEXT AS "context"
    FROM USERCONTEXTS
    WHERE TRIM(USERID) = :userId
  `;

  const rows = await executeQuery(sql, { userId: normalizedUserId });
  if (!rows || rows.length === 0) return null;

  const raw = rows[0].context;
  if (raw == null) return null;

  let jsonText;

  // 1) 문자열인 경우: 그대로 사용
  if (typeof raw === 'string') {
    jsonText = raw;
  }
  // 2) CLOB(Lob) 객체인 경우: getData()로 문자열 추출
  else if (raw && typeof raw.getData === 'function') {
    // node-oracledb thin driver CLOB
    jsonText = await raw.getData();
  }
  // 3) 혹시 다른 방식의 Lob (stream)인 경우: 필요시 여기서 스트림 처리
  else {
    console.warn('[findUserContext] CONTEXT 예상 밖 타입:', typeof raw, raw);
    return null;
  }

  if (!jsonText) return null;

  try {
    const obj = JSON.parse(jsonText);
    return obj;
  } catch (err) {
    console.error('[findUserContext] JSON 파싱 오류:', err);
    console.error('[findUserContext] JSON 원본 일부:', jsonText.slice(0, 200));
    return null;
  }
}

async function fetchCurrentDocInfos(docIds = []) {
  const uniqueIds = Array.from(new Set(docIds.map((id) => normalizeDocId(id)).filter(Boolean)));
  if (!uniqueIds.length) return new Map();

  const placeholders = uniqueIds.map((_, idx) => `:docId${idx}`).join(', ');
  const sql = `
    SELECT
      DOCNO,
      DOCVR,
      DOCNUMBER,
      DOCNM,
      PLANTCODE
    FROM IDS_DOC
    WHERE DOCNO IN (${placeholders})
      AND CURRENT_YN = '001'
  `;

  const binds = {};
  uniqueIds.forEach((id, idx) => {
    binds[`docId${idx}`] = id;
  });

  const rows = await executeQuery(sql, binds);
  const map = new Map();
  for (const row of rows) {
    const key = normalizeDocId(row?.DOCNO);
    if (!key) continue;
    map.set(key, row);
  }

  return map;
}


/**
 * GET /api/auth/favorites
 * - 현재 로그인 사용자 기준으로 CONTEXTS.favorite 만 반환
 */
async function getUserFavorites(req, res) {
  try {
    const authUser = req.authUser;
    const userId = normalizeUserId(authUser?.userId);
    if (!authUser || !userId) {
      return res.status(401).json({ ok: false, message: 'NO_AUTH' });
    }

    const context = await findUserContext(userId);

    const favorite = context?.favorite || {};

    const documents = Array.isArray(favorite.documents) ? favorite.documents : [];
    const equipments = Array.isArray(favorite.equipments) ? favorite.equipments : [];

    const docIds = documents
      .map((doc) => normalizeDocId(doc?.docId))
      .filter(Boolean);
    const docInfoMap = await fetchCurrentDocInfos(docIds);

    const enrichedDocuments = documents.map((doc) => {
      const docIdKey = normalizeDocId(doc?.docId);
      const info = docIdKey ? docInfoMap.get(docIdKey) : null;
      if (!info) return doc;

      return {
        ...doc,
        docVer: info.DOCVR || doc.docVer || '',
        docNumber: info.DOCNUMBER || doc.docNumber || '',
        docName: info.DOCNM || doc.docName || '',
        plantCode: info.PLANTCODE || doc.plantCode || '',
      };
    });

    return res.json({
      ok: true,
      userId,
      favorite: {
        documents: enrichedDocuments,
        equipments,
      },
    });
  } catch (err) {
    console.error('[getUserFavorites] 오류:', err);
    return res.status(500).json({ ok: false, message: 'FAVORITE_LOAD_ERROR' });
  }
}

async function saveUserContext(userId, context) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Invalid userId');
  }

  const deleteSql = `
    DELETE FROM USERCONTEXTS
    WHERE TRIM(USERID) = :userId
  `;
  await executeQuery(deleteSql, { userId: normalizedUserId }, { autoCommit: true });

  const insertSql = `
    INSERT INTO USERCONTEXTS (USERID, CONTEXT)
    VALUES (:userId, :contextJson)
  `;
  await executeQuery(
    insertSql,
    {
      userId: normalizedUserId,
      contextJson: JSON.stringify(context),
    },
    { autoCommit: true }
  );
}

// 즐겨찾기 도면 토글
async function toggleFavoriteDoc(req, res) {
  try {
    const authUser = req.authUser;
    const userId = normalizeUserId(authUser?.userId);
    if (!authUser || !userId) {
      return res.status(401).json({ ok: false, message: 'NO_AUTH' });
    }

    const { docId, docVer, docName, docNumber, plantCode } = req.body;
    const normalizedDocId = normalizeDocId(docId);

    const resolvedPlantCode =
      typeof plantCode === 'string' ? plantCode.trim() : '';

    if (!normalizedDocId || !docVer) {
      return res
        .status(400)
        .json({ ok: false, message: 'DOC_ID_OR_VER_MISSING' });
    }

    // 기존 CONTEXT 조회
    const context = (await findUserContext(userId)) || { userId, favorite: {} };
    const favorite = context.favorite || {};
    const documents = Array.isArray(favorite.documents)
      ? favorite.documents
      : [];

    const idx = documents.findIndex(
      (d) => normalizeDocId(d.docId) === normalizedDocId
    );

    let updatedDocs;

    if (idx >= 0) {
      // 이미 즐겨찾기 → 제거
      updatedDocs = [
        ...documents.slice(0, idx),
        ...documents.slice(idx + 1),
      ];
    } else {
      // 즐겨찾기 추가
      const newDoc = {
        docId: normalizedDocId || docId,
        docVer,
        docName: docName || '',
        docNumber: docNumber || '',
        plantCode: resolvedPlantCode,
      };
      updatedDocs = [newDoc, ...documents]; // 앞에 붙이기
    }

    const updatedContext = {
      ...context,
      favorite: {
        ...favorite,
        documents: updatedDocs,
      },
    };

    await saveUserContext(userId, updatedContext);

    return res.json({
      ok: true,
      userId,
      favorite: updatedContext.favorite,
      isFavorite: idx === -1, // true면 방금 추가된 상태
    });
  } catch (err) {
    console.error('[toggleFavoriteDoc] 오류:', err);
    return res
      .status(500)
      .json({ ok: false, message: 'FAVORITE_TOGGLE_ERROR' });
  }
}




module.exports = {
  checkUser,
  getConfig,
  getSessionUser,
  getUserFavorites,
  toggleFavoriteDoc,
};
