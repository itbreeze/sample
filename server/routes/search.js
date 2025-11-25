// server/routes/search.js
const express = require('express');
const router = express.Router();
const oracleClient = require('../utils/dataBase/oracleClient');

const usePlantScopeFilter =
  String(process.env.USE_PLANT_SCOPE_FILTER || 'false').toLowerCase() === 'true';

const normalizePlantCode = (value) =>
  typeof value === 'string' ? value.trim() : '';

const extractPlantCode = (req) =>
  normalizePlantCode(
    (req.headers && req.headers['x-plant-code']) ||
      (req.body && req.body.plantCode) ||
      (req.query && req.query.plantCode) ||
      ''
  );

const buildPlantFilter = (req, columnAlias = 'D') => {
  const plantCode = extractPlantCode(req);
  const shouldFilter =
    usePlantScopeFilter && plantCode && plantCode !== '0001';

  if (!shouldFilter) {
    return { clause: '', binds: {}, shouldFilter: false };
  }

  const column = columnAlias ? `${columnAlias}.PLANTCODE` : 'PLANTCODE';
  return {
    clause: ` AND ${column} = :plantCode`,
    binds: { plantCode },
    shouldFilter: true,
  };
};

const buildDocInnerQuery = (plantClause = '') => `
    SELECT 
      'DOC' AS KEY,
      S.PLANTNM,
      P.FOLNM AS PARENTNM,
      F.HOGI_GUBUN,
      D.PLANTCODE,
      D.DOCNO,
      D.DOCNUMBER,
      D.DOCNM,
      D.DOCVR,
      F.FOLID,
      CASE 
        WHEN NVL(F.HOGI_GUBUN, '') = '0' THEN '공용' 
        WHEN REGEXP_LIKE(NVL(F.HOGI_GUBUN, ''), '^[0-9]+$') THEN NVL(F.HOGI_GUBUN, '') || '호기'
        ELSE NVL(F.HOGI_GUBUN, '')
      END AS HOGI_LABEL,
      NVL(S.PLANTNM, '') 
        || '-' || NVL(P.FOLNM, '')                         
        || '-' || 
          CASE 
            WHEN NVL(F.HOGI_GUBUN, '') = '0' THEN '공용' 
            ELSE NVL(F.HOGI_GUBUN, '') || '호기' 
          END
        || '-' || NVL(D.PLANTCODE, '')
        || '-' || NVL(TO_CHAR(D.DOCNUMBER), '') 
        || '-' || NVL(D.DOCNM, '') 
        AS FULL_INFO
    FROM IDS_DOC D
    LEFT JOIN IDS_FOLDER F ON D.FOLID = F.FOLID
    LEFT JOIN IDS_FOLDER P ON F.FOLPT = P.FOLID
    LEFT JOIN IDS_SITE S ON D.PLANTCODE = S.PLANTCODE
    WHERE F.APP_GUBUN = '001'
      AND D.CURRENT_YN = '001'
      AND S.FOLDER_TYPE = '003'
      ${plantClause}
  `;

// GET /api/search/levels
router.get("/levels", async (req, res) => {
  try {
    const { clause: plantClause, binds: plantBinds } = buildPlantFilter(req, '');

    const sql = `
      WITH RECURSIVE_TREE (ID, PARENTID, NAME, LVL, ORDER_SEQ, PLANTCODE) AS (
        -- 최상위 폴더
        SELECT 
          F.FOLID,
          F.FOLPT,
          F.FOLNM,
          0 AS LVL,
          LPAD(ROW_NUMBER() OVER (ORDER BY F.FOLNM), 5, '0') AS ORDER_SEQ,
          F.PLANTCODE
        FROM IDS_FOLDER F
        WHERE F.FOLPT IS NULL AND F.APP_GUBUN = '001'
        UNION ALL
        -- 자식 폴더
        SELECT 
          F.FOLID,
          F.FOLPT,
          F.FOLNM,
          P.LVL + 1 AS LVL,
          P.ORDER_SEQ || '.' || LPAD(ROW_NUMBER() OVER (PARTITION BY F.FOLPT ORDER BY F.PLANTCODE, F.FOLNM), 5, '0') AS ORDER_SEQ,
          F.PLANTCODE
        FROM IDS_FOLDER F
        INNER JOIN RECURSIVE_TREE P ON F.FOLPT = P.ID
        WHERE F.APP_GUBUN = '001'
      )
      SELECT LVL AS LEV, ID, PARENTID, NAME, PLANTCODE, ORDER_SEQ
      FROM RECURSIVE_TREE
      WHERE LVL > 0${plantClause}
      ORDER BY PLANTCODE
    `;

    const result = await oracleClient.executeQuery(sql, plantBinds);

    const levelData = result.map(row => ({
      LEV: row.LEV,
      LEVEL_CD: row.ID,
      PARENT_CD: row.PARENTID,
      LEVEL_NM: row.NAME,
      NODE_TYPE: 'folder',
      PLANTCODE: row.PLANTCODE,
      ORDER_SEQ: row.ORDER_SEQ
    }));

    res.json(levelData);

  } catch (error) {
    console.error('Error fetching levels:', error);
    res.status(500).json({ message: "작업 정보를 가져오는 도중 서버에서 오류가 발생했습니다." });
  }
});

// POST /api/search
router.post('/', async (req, res) => {
  const { searchTerm, searchType } = req.body;

  if (!searchTerm) {
    return res.status(400).json({ message: '검색어가 필요합니다.' });
  }

  // 검색어를 공백(' ') 기준으로 분리
  const terms = searchTerm.split(' ').map(t => t.trim()).filter(Boolean);

  if (terms.length === 0) {
    return res.status(400).json({ message: '유효한 검색어가 아닙니다.' });
  }

  let sql = '';
  let binds = {};

  console.log(`[API] 검색 요청 수신: 유형='${searchType}', 검색어='${terms.join(', ')}'`);

  const { clause: plantClause, binds: plantBinds } = buildPlantFilter(req, 'D');

  if (searchType === '도면') {
    const whereClauses = terms.map((term, idx) => {
      const key = `bv${idx}`;
      binds[key] = `%${term}%`;
      return `UPPER(FULL_INFO) LIKE UPPER(:${key})`;
    });

    const whereCondition = whereClauses.join(' AND ');
    const innerQuery = buildDocInnerQuery(plantClause);
    binds = { ...binds, ...plantBinds };

    sql = `
      SELECT * FROM (
        ${innerQuery}
      )
      WHERE ${whereCondition}
      AND ROWNUM <= 100
    `;

  } else if (searchType === '설비번호') {
    const whereClauses = terms.map((term, idx) => {
      const fnKey = `fn_${idx}`;
      const eqKey = `eq_${idx}`;
      binds[fnKey] = `%${term}%`;
      binds[eqKey] = `%${term}%`;
      return `(UPPER(T.FUNCTION) LIKE UPPER(:${fnKey}) OR UPPER(M.EQUIPMENT) LIKE UPPER(:${eqKey}))`;
    });

    const whereCondition = whereClauses.join(' AND ');
    binds = { ...binds, ...plantBinds };

    sql = `
      SELECT * FROM (
        SELECT M.EQUIPMENT, M.FUNCTION, D.DOCNO, D.DOCNUMBER, D.DOCNM, D.DOCVR 
        FROM IDS_MASTER M
        LEFT JOIN IDS_TAG T ON M.FUNCTION = T.FUNCTION AND M.INTELLIGENT = T.INTELLIGENT
        LEFT JOIN IDS_DOC D ON M.PLANTCODE = D.PLANTCODE 
                           AND M.DOCNUMBER = D.DOCNUMBER 
                           AND T.DOCNO = D.DOCNO 
                           AND T.DOCVR = D.DOCVR
        WHERE M.GUBUN IS NOT NULL
          AND D.CURRENT_YN = '001'
          AND T.TAG_TYPE <> '002'${plantClause}
          AND ${whereCondition}
      )
      WHERE ROWNUM <= 100
    `;

  } else {
    return res.status(400).json({ message: '지원하지 않는 검색 유형입니다.' });
  }

  try {
    const results = await oracleClient.executeQuery(sql, binds);
    res.status(200).json(results);
  } catch (err) {
    console.error("검색 API 오류:", err);
    res.status(500).json({ message: '검색 중 서버 오류가 발생했습니다.' });
  }
});

// 추가 라우트: /advanced
router.post('/advanced', async (req, res) => {
  const { leafNodeIds, drawingNumber, drawingName, additionalConditions } = req.body;

  console.log('[SERVER] 상세 검색 요청 받음:', { leafNodeIds, drawingNumber, drawingName, additionalConditions });

  const { clause: plantClause, binds: plantBinds } = buildPlantFilter(req, 'D');
  const innerQuery = buildDocInnerQuery(plantClause);

  let sql = `
    SELECT *
    FROM (${innerQuery}) base
    WHERE 1 = 1
  `;

  const binds = { ...plantBinds };

  // 1. FOLID 필터 처리 (leafNodeIds 배열/문자열)
  if (leafNodeIds && leafNodeIds !== 'ALL') {
    if (Array.isArray(leafNodeIds) && leafNodeIds.length > 0) {
      const placeholders = leafNodeIds.map((_, idx) => ':folid_' + idx).join(', ');
      sql += ' AND base.FOLID IN (' + placeholders + ')';
      leafNodeIds.forEach((id, idx) => {
        binds['folid_' + idx] = id;
      });
      console.log('[SERVER] 배열 방식 FOLID 파라미터 적용:', leafNodeIds);
    } else if (typeof leafNodeIds === 'string') {
      sql += ' AND base.FOLID = :folid_single';
      binds.folid_single = leafNodeIds;
      console.log('[SERVER] 문자열 방식 FOLID 파라미터 적용:', leafNodeIds);
    }
  }

  // 2. 도면번호 조건 추가
  if (drawingNumber) {
    sql += " AND UPPER(base.DOCNUMBER) LIKE '%' || UPPER(:drawingNumber) || '%'";
    binds.drawingNumber = drawingNumber;
  }

  // 3. 도면명 조건 (DOCNM 기준)
  if (drawingName) {
    const nameTerms = drawingName.split(/\s+/).map(t => t.trim()).filter(Boolean);
    nameTerms.forEach((term, idx) => {
      const key = 'drawingName_' + idx;
      sql += " AND UPPER(base.DOCNM) LIKE '%' || UPPER(:" + key + ") || '%'";
      binds[key] = term;
    });
  }

  // 4. AND/OR/제외 조건 처리
  if (additionalConditions && additionalConditions.length > 0) {
    const filteredConditions = additionalConditions.filter(c => c.term && c.term.trim() !== '');
    if (filteredConditions.length > 0) {
      let fullClause = '';
      filteredConditions.forEach((condition, idx) => {
        const bindKey = 'add_term_' + idx;
        binds[bindKey] = condition.term;
        const baseClause = "UPPER(base.FULL_INFO) LIKE '%' || UPPER(:" + bindKey + ") || '%'";
        const isExclude = condition.operator === 'EXCLUDE';
        const clauseSegment = isExclude
          ? 'NOT (' + baseClause + ')'
          : '(' + baseClause + ')';

        if (idx === 0) {
          fullClause = clauseSegment;
          return;
        }

        const connector = condition.operator && condition.operator.toUpperCase() === 'OR' ? 'OR' : 'AND';
        fullClause = fullClause + ' ' + connector + ' ' + clauseSegment;
      });

      if (fullClause) {
        sql += ' AND (' + fullClause + ')';
      }
    }
  }

  const unlimitedFlag = req.body && req.body.unlimited;
  if (!unlimitedFlag) {
    sql += ' AND ROWNUM <= 500';
  }
  console.log('[SERVER] 최종 SQL:', sql);
  console.log('[SERVER] 바인드 변수:', binds);

  try {
    const results = await oracleClient.executeQuery(sql, binds);
    console.log(`[SERVER] 검색 결과: ${results.length}개`);
    res.status(200).json(results);
  } catch (err) {
    console.error("[SERVER] 상세 검색 API 오류:", err);
    res.status(500).json({ message: '상세 검색 중 서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
