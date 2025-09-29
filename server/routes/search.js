const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/dataBase/dbClient');


// =================================================================
// 🔹 신규 추가: 레벨 목록을 가져오는 API
// =================================================================
router.get('/levels', async (req, res) => {
    // 예시: IDS_SITE 테이블에서 고유한 PLANTNM을 '레벨'로 사용합니다.
    const sql = `
        SELECT DISTINCT PLANTNM AS "value", PLANTNM AS "label"
        FROM IDS_SITE
        WHERE FOLDER_TYPE = '002' AND PLANTNM IS NOT NULL
        ORDER BY "label"
    `;
    try {
        const levels = await executeQuery(sql);
        res.status(200).json(levels);
    } catch (err) {
        console.error("레벨 목록 조회 API 오류:", err);
        res.status(500).json({ message: '레벨 목록을 가져오는 중 서버 오류가 발생했습니다.' });
    }
});

// POST /api/search
router.post('/', async (req, res) => {
    const { searchTerm, searchType } = req.body;

    if (!searchTerm) {
        return res.status(400).json({ message: '검색어가 필요합니다.' });
    }

    // 검색어를 스페이스(' ') 기준으로 분리
    const terms = searchTerm.split(' ').map(t => t.trim()).filter(Boolean);

    if (terms.length === 0) {
        return res.status(400).json({ message: '유효한 검색어가 없습니다.' });
    }

    let sql = '';
    const binds = [];

    console.log(`[API] 다중 검색 요청: 유형='${searchType}', 검색어='${terms.join(', ')}'`);

    if (searchType === '도면') {
        const whereClauses = terms.map(() => `UPPER(FULL_INFO) LIKE UPPER(:bv)`);
        terms.forEach(term => {
            binds.push(`%${term}%`);
        });

        const whereCondition = whereClauses.join(' AND ');
        
        sql = `
            SELECT * FROM (
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
                    -- 여러 컬럼을 조합한 검색용 문자열
                    NVL(S.PLANTNM, '') 
                        || '-' || NVL(P.FOLNM, '')                         
                        || '-' || NVL(F.HOGI_GUBUN, '') || '호기'
                        || '-' || NVL(D.PLANTCODE, '')
                        --|| '-' || NVL(TO_CHAR(D.DOCNO), '') 
                        || '-' || NVL(TO_CHAR(D.DOCNUMBER), '') 
                        || '-' || NVL(D.DOCNM, '') 
                        --|| '-' || NVL(D.DOCVR, '') 
                        AS FULL_INFO                         
                FROM IDS_DOC D
                LEFT JOIN IDS_FOLDER F ON D.FOLID = F.FOLID
                LEFT JOIN IDS_FOLDER P ON F.FOLPT = P.FOLID -- 부모 폴더명 JOIN
                LEFT JOIN IDS_SITE S ON D.PLANTCODE = S.PLANTCODE
                WHERE F.APP_GUBUN = '001'
                  AND D.CURRENT_YN = '001'
                  AND S.FOLDER_TYPE = '003'
            )
            WHERE ${whereCondition}
            AND ROWNUM <= 100
        `;

    } else if (searchType === '설비번호') {
        const whereClauses = terms.map(() => `(UPPER(T.FUNCTION) LIKE UPPER(:bv) OR UPPER(M.EQUIPMENT) LIKE UPPER(:bv))`);
        terms.forEach(term => {
            binds.push(`%${term}%`);
            binds.push(`%${term}%`);
        });

        const whereCondition = whereClauses.join(' AND ');

        sql = `
            SELECT * FROM (
                SELECT M.EQUIPMENT, M.FUNCTION, D.DOCNO, D.DOCNUMBER, D.DOCNM, D.DOCVR 
                FROM IDS_MASTER M
                LEFT JOIN IDS_TAG T ON M.FUNCTION=T.FUNCTION AND M.INTELLIGENT=T.INTELLIGENT
                LEFT JOIN IDS_DOC D ON M.PLANTCODE=D.PLANTCODE AND M.DOCNUMBER=D.DOCNUMBER AND T.DOCNO=D.DOCNO AND T.DOCVR=D.DOCVR
                WHERE M.GUBUN IS NOT NULL
                AND D.CURRENT_YN = '001'
                AND T.TAG_TYPE <> '002'
                AND ${whereCondition}
            )
            WHERE ROWNUM <= 100
        `;

    } else {
        return res.status(400).json({ message: '알 수 없는 검색 유형입니다.' });
    }

    try {
        const results = await executeQuery(sql, binds);
        console.log(results);
        res.status(200).json(results);
    } catch (err) {
        console.error("검색 API 오류:", err);
        res.status(500).json({ message: '검색 중 서버 오류가 발생했습니다.' });
    }
});

module.exports = router;