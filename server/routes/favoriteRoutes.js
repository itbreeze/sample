// server/routes/favoriteRoutes.js
const express = require('express');
const router = express.Router();
const oracleClient = require('../utils/dataBase/oracleClient');
const { buildPlantFilter } = require('../utils/plantFilter');

// 🔹 즐겨찾기 목록 조회
// GET /api/favorites
router.get('/', async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ ok: false, message: 'UNAUTHORIZED' });
    }

    const userId = req.authUser.userId;   // auth 쿠키에 들어있는 값 사용 :contentReference[oaicite:8]{index=8}

    const { clause: plantClause, binds: plantBinds } = buildPlantFilter(req, 'D'); // D.PLANTCODE 기준 필터 :contentReference[oaicite:9]{index=9}

    const sql = `
      SELECT
        F.USERID,
        F.DOCNO,
        F.DOCVR,
        F.PLANTCODE,
        NVL(F.ORDER_SEQ, 0) AS ORDER_SEQ,
        F.CREATED_AT,
        D.DOCNUMBER,
        D.DOCNM,
        D.ISPSM,
        D.USERID AS MODIUSER,
        D.REGDT AS DATE,
        S.PLANTNM,
        NVL(FOL.HOGI_GUBUN, '0') AS UNIT
      FROM IDS_FAVORITE_DOC F
      JOIN IDS_DOC D
        ON F.DOCNO = D.DOCNO
       AND F.DOCVR = D.DOCVR
       AND D.CURRENT_YN = '001'
      LEFT JOIN IDS_SITE S
        ON D.PLANTCODE = S.PLANTCODE
      LEFT JOIN IDS_FOLDER FOL
        ON D.FOLID = FOL.FOLID
      WHERE F.USERID = :userId
      ${plantClause}
      ORDER BY F.ORDER_SEQ, F.CREATED_AT DESC
    `;

    const binds = { userId, ...plantBinds };

    const rows = await oracleClient.executeQuery(sql, binds);
    console.log('[favorites] 조회된 즐겨찾기 도면 수:', rows.length);
    return res.json({
      ok: true,
      items: rows,
    });
  } catch (err) {
    console.error('[favorites] 목록 조회 오류:', err);
    return res.status(500).json({ ok: false, message: 'INTERNAL_SERVER_ERROR' });
  }
});

// 🔹 즐겨찾기 추가
// POST /api/favorites  { docno, docvr }
router.post('/', async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ ok: false, message: 'UNAUTHORIZED' });
    }

    const userId = req.authUser.userId;
    const plantCode = req.authUser.plantCode || '0001'; // auth 쿠키에 이미 계산된 plantCode 존재 :contentReference[oaicite:10]{index=10}

    const { docno, docvr } = req.body || {};
    if (!docno || !docvr) {
      return res.status(400).json({ ok: false, message: 'DOCNO_DOCVR_REQUIRED' });
    }

    const sql = `
      MERGE INTO IDS_FAVORITE_DOC T
      USING (
        SELECT :userId AS USERID,
               :docno  AS DOCNO,
               :docvr  AS DOCVR
        FROM DUAL
      ) S
      ON (T.USERID = S.USERID AND T.DOCNO = S.DOCNO AND T.DOCVR = S.DOCVR)
      WHEN NOT MATCHED THEN
        INSERT (USERID, DOCNO, DOCVR, PLANTCODE, ORDER_SEQ, CREATED_AT)
        VALUES (:userId, :docno, :docvr, :plantCode, 0, SYSDATE)
    `;

    await oracleClient.executeQuery(
      sql,
      { userId, docno, docvr, plantCode },
      { autoCommit: true } // DML이므로 커밋 필요 :contentReference[oaicite:11]{index=11}
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[favorites] 추가 오류:', err);
    return res.status(500).json({ ok: false, message: 'INTERNAL_SERVER_ERROR' });
  }
});

// 🔹 즐겨찾기 삭제
// DELETE /api/favorites/:docno/:docvr
router.delete('/:docno/:docvr', async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ ok: false, message: 'UNAUTHORIZED' });
    }

    const userId = req.authUser.userId;
    const { docno, docvr } = req.params;

    const sql = `
      DELETE FROM IDS_FAVORITE_DOC
      WHERE USERID = :userId
        AND DOCNO  = :docno
        AND DOCVR  = :docvr
    `;

    await oracleClient.executeQuery(
      sql,
      { userId, docno, docvr },
      { autoCommit: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[favorites] 삭제 오류:', err);
    return res.status(500).json({ ok: false, message: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
