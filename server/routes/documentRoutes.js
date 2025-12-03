const express = require("express");
const router = express.Router();
const oracleClient = require('../utils/dataBase/oracleClient');
const path = require("path");
const fs = require("fs").promises; // fs.promises 사용
const { exec } = require('child_process'); // exec 사용

const { buildPlantFilter } = require('../utils/plantFilter');
const { SYSASM } = require("oracledb");

const VIEWER_FOLDER = path.resolve(process.env.VIEWER_DOC_FOLDER);
const CONVERTER_PATH = path.resolve(process.env.FILECONVERTER);

const buildGroupedEquipmentSql = () => `
                SELECT T1.LIBNO AS "libId", T1.LIBNM AS "libName", T1.LIBDS AS "libDesc", T1.LIBPT AS "parent", T1.LIBLV, T1.DOCNO, T1.DOCVR AS "docVer"
                        , T1.INTELLIGENT AS "intelligent", T1.FUNCTION AS "function", T1.CONNECTION AS "connection"
                        , T2.TAGHANDLE AS "handle", T2.TAG_TYPE AS "tagType", T2.TAGNO AS "tagId"
                FROM (
                    SELECT B.LIBNO, B.LIBNM, B.LIBDS, B.LIBPT, B.LIBLV, A.DOCNO, A.TAGNO, A.TAG_TYPE, A.DOCVR, A.INTELLIGENT, A.FUNCTION, A.CONNECTION
                    FROM IDS_TAG A, IDS_LIB B 
                    WHERE A.DOCNO = :docId AND A.DOCVR = :docVer AND B.LIBLV != '9' AND B.PLANTCODE = :plantCode AND A.GUBUN = 'Y' AND A.LIBNO = B.LIBNO 
                    GROUP BY B.LIBNO, B.LIBNM, B.LIBDS, B.LIBPT, B.LIBLV, A.DOCNO, A.TAGNO, A.TAG_TYPE, A.DOCVR, A.INTELLIGENT, A.FUNCTION, A.CONNECTION
                    UNION ALL 
                    SELECT LIBNO, LIBNM, LIBDS, LIBPT, LIBLV, '' AS DOCNO, '' AS TAGNO, '' AS TAG_TYPE, '' AS DOCVR, '' AS INTELLIGENT, '' AS FUNCTION, '' AS CONNECTION
                    FROM IDS_LIB 
                    WHERE PLANTCODE = :plantCode AND LIBLV != '9' AND LIBDS = 'VALVE' AND LIBNO IN (
                        SELECT LIBPT FROM IDS_TAG A, IDS_LIB B 
                        WHERE A.DOCNO = :docId AND A.DOCVR = '001' AND B.LIBLV != '9' AND B.PLANTCODE = :plantCode AND A.GUBUN = 'Y' AND A.LIBNO = B.LIBNO
                        GROUP BY B.LIBPT
                    )
                    ORDER BY LIBDS
                ) T1 LEFT JOIN (
                                    SELECT LISTAGG(SUB.TAGHANDLE, '/') WITHIN GROUP (ORDER BY SUB.TAGNO) AS TAGHANDLE, SUB.TAG_TYPE, SUB.TAGNO
                                    FROM (
                                        SELECT A.TAGHANDLE, B.TAG_TYPE, A.TAGNO, A.DOCNO, A.DOCVR FROM IDS_TAG_DETAIL A, IDS_TAG B
                                            WHERE A.DOCNO = B.DOCNO AND A.DOCVR = B.DOCVR AND A.TAGNO = B.TAGNO AND A.DOCVR = :docVer AND A.DOCNO = :docId
                                        GROUP BY B.TAG_TYPE, A.TAGNO, A.DOCNO, A.DOCVR, A.TAGHANDLE
                                    ) SUB
                                    GROUP BY SUB.TAGNO, SUB.TAG_TYPE
                                ) T2 ON T2.TAGNO IN (T1.TAGNO)
                ORDER BY FUNCTION
                `;

// GET "/" 라우트는 변경 없이 그대로 둡니다.
router.get("/", async (req, res) => {
  try {
    const { shouldFilter, binds: plantBinds } = buildPlantFilter(req, '');
    const sql = `WITH RECURSIVE_TREE (
    ID, PARENTID, NAME, DOCNAME, DOCNUM, DOCVR, TYPE, PLANTCODE, LVL, ORDER_SEQ
) AS (
    -- 최상위 폴더 (LVL 0, ORDER_SEQ = '00000')
    SELECT 
        F.FOLID,
        F.FOLPT,
        F.FOLNM,
        NULL,
        NULL,
        NULL,
        'FOLDER',
        F.PLANTCODE,
        0 AS LVL,
        '00000' AS ORDER_SEQ
    FROM IDS_FOLDER F
    WHERE F.FOLPT IS NULL AND F.APP_GUBUN='001'  -- 최상위 조건

    UNION ALL

    -- 자식 폴더 + 문서
    SELECT 
        C.ID,
        C.PARENTID,
        C.NAME,
        C.DOCNAME,
        C.DOCNUM,
        C.DOCVR,
        C.TYPE,
        C.PLANTCODE,
        P.LVL + 1 AS LVL,
        P.ORDER_SEQ || '.' || LPAD(ROW_NUMBER() OVER (PARTITION BY C.PARENTID ORDER BY C.ID),5,'0') AS ORDER_SEQ
        
    FROM (
        SELECT 
            F.FOLID AS ID,
            F.FOLPT AS PARENTID,
            F.FOLNM AS NAME,
            NULL AS DOCNAME,
            NULL AS DOCNUM,
            NULL AS DOCVR,
            'FOLDER' AS TYPE,
            F.PLANTCODE
        FROM IDS_FOLDER F
        WHERE F.APP_GUBUN = '001'

        UNION ALL

        SELECT 
            D.DOCNO AS ID,
            D.FOLID AS PARENTID,
            NULL AS NAME,
            D.DOCNM AS DOCNAME,
            D.DOCNUMBER AS DOCNUM,
            D.DOCVR AS DOCVR,
            'DOC' AS TYPE,
            D.PLANTCODE
        FROM IDS_DOC D
        WHERE D.CURRENT_YN = '001'
    ) C
    INNER JOIN RECURSIVE_TREE P ON C.PARENTID = P.ID
)
SELECT *
FROM RECURSIVE_TREE
${shouldFilter ? 'WHERE PLANTCODE = :plantCode' : ''}
ORDER BY ORDER_SEQ,PLANTCODE
`
    const getDocumentList = await oracleClient.executeQuery(sql, plantBinds);
    res.json(getDocumentList);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "DB 조회 실패" });
  }
});

router.get("/info", async (req, res) => {
  try {
    const { docId, docVr } = req.query;
    if (!docId) {
      return res.status(400).json({ error: "docId가 필요합니다." });
    }

    const sql = `
      SELECT 
        D.DOCNO,
        D.DOCVR,
        D.DOCNUMBER,
        D.DOCNM,
        S.PLANTNM,
        (SELECT FOLNM FROM IDS_FOLDER WHERE FOLID = F.FOLPT) AS SYSTEMNM,
        CASE 
          WHEN NVL(F.HOGI_GUBUN, '') = '0' THEN '공용' 
          WHEN REGEXP_LIKE(NVL(F.HOGI_GUBUN, ''), '^[0-9]+$') THEN NVL(F.HOGI_GUBUN, '') || '호기'
          ELSE NVL(F.HOGI_GUBUN, '')
        END AS HOGI_LABEL
      FROM IDS_DOC D
      LEFT JOIN IDS_SITE S ON D.PLANTCODE = S.PLANTCODE
      LEFT JOIN IDS_FOLDER F ON D.FOLID = F.FOLID
      WHERE D.DOCNO = :docId
        AND D.CURRENT_YN = '001'
        AND S.FOLDER_TYPE = '003'
        ${docVr ? 'AND D.DOCVR = :docVr' : ''}
    `;

    const binds = { docId };
    if (docVr) binds.docVr = docVr;

    const results = await oracleClient.executeQuery(sql, binds);
    if (!results.length) {
      return res.status(404).json({ error: "해당 도면 정보를 찾을 수 없습니다." });
    }

    const doc = results[0];
    res.json({
      docId: doc.DOCNO,
      docVer: doc.DOCVR,
      docNumber: doc.DOCNUMBER,
      docName: doc.DOCNM,
      plantName: doc.PLANTNM,
      systemName: doc.SYSTEMNM,
      unit: doc.HOGI_LABEL,
    });
  } catch (err) {
    console.error("[/info] 도면 메타 조회 실패:", err);
    res.status(500).json({ error: "도면 메타 정보 조회 실패" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    const { docId, docVr } = req.query;
    if (!docId) {
      return res.status(400).json({ error: "docId가 필요합니다." });
    }

    const binds = { docId };
    let vrClause = "";
    if (docVr) {
      binds.docVr = docVr;
      vrClause = "AND T.DOCVR = :docVr";
    }

    const sql = `
        SELECT * FROM IDS_TAG T
        LEFT JOIN IDS_TAG_DETAIL D
        ON T.DOCNO=D.DOCNO
        AND T.DOCVR=D.DOCVR
        AND T.TAGNO=D.TAGNO
        WHERE 1=1
        AND T.GUBUN='Y'
        AND T.DOCNO = :docId
        ${vrClause}
    `;

    const results = await oracleClient.executeQuery(sql, binds);
    res.json(results);
  } catch (err) {
    console.error("[/tags] 태그 리스트 조회 실패:", err);
    res.status(500).json({ error: "태그 정보 조회 실패" });
  }
});

router.get("/equipment", async (req, res) => {
  try {
    const { docId, docVr, plantCode } = req.query;
    if (!docId || !plantCode) {
      return res.status(400).json({ error: "docId와 plantCode는 필수입니다." });
    }
    const docVer = docVr || '001';
    const sql = buildGroupedEquipmentSql();
    const binds = { docId, docVer, plantCode };
    const results = await oracleClient.executeQuery(sql, binds);
    res.json(results);
  } catch (err) {
    console.error("[/equipment] 설비 목록 조회 실패:", err);
    res.status(500).json({ error: "설비 목록 조회 실패" });
  }
});


// =================================================================
// (수정된 코드) /selectDocument 라우트
// =================================================================
router.post("/selectDocument", async (req, res) => {
  const { docId, docVr } = req.body;
  let tmpFile; // 임시 dwg 파일 경로
  try {
    const sql = `SELECT S.PLANTNM, (SELECT FOLNM FROM IDS_FOLDER WHERE FOLID=F.FOLPT) AS SYSTEMNM,
                  CASE 
                    WHEN NVL(F.HOGI_GUBUN, '') = '0' THEN '공용' 
                    WHEN REGEXP_LIKE(NVL(F.HOGI_GUBUN, ''), '^[0-9]+$') THEN NVL(F.HOGI_GUBUN, '') || '호기'
                    ELSE NVL(F.HOGI_GUBUN, '')
                  END AS HOGI_LABEL,D.DOCNO ,D.DOCNM,D.DOCNUMBER,D.DOCVR AS DOCVR,D.REGDT,D.REGID,D.USERID,D.PLANTCODE,D.ISPSM,D.DOCCT
                  FROM IDS_DOC D 
                  LEFT JOIN IDS_SITE S
                    ON D.PLANTCODE=S.PLANTCODE
                  LEFT JOIN IDS_FOLDER F
                    ON D.FOLID=F.FOLID
                    WHERE S.FOLDER_TYPE='003' AND D.CURRENT_YN='001' AND D.DOCNO = :docId `;
    const results = await oracleClient.executeQuery(sql, [docId]);

    if (!results.length) {
      console.warn('[selectDocument] DOC 미존재', { docId });
      return res.status(404).json({ error: "DOC 파일이 없습니다." });
    }

    const doc = results[0];
    // VSFX 파일이 저장될 폴더 확인 및 생성 (비동기)
    await fs.mkdir(VIEWER_FOLDER, { recursive: true });

    // 파일명 규칙: docno_docvr (예: 0000...4602_001)
    const hostFile = `${doc.DOCNO}_${doc.DOCVR}`;
    tmpFile = path.join(VIEWER_FOLDER, `${hostFile}.dwg`);
    const outputPath = path.join(VIEWER_FOLDER, `${hostFile}.vsfx`);

    // 1. DB에서 BLOB 데이터를 가져와 임시 dwg 파일로 저장 (비동기)
    const buffer = await doc.DOCCT.getData();
    await fs.writeFile(tmpFile, buffer);

    // 2. dwg 파일을 vsfx로 변환 (비동기)
    const cmdLine = `"${CONVERTER_PATH}" "${tmpFile}" "${outputPath}" --multithreading=true`;
    await new Promise((resolve, reject) => {
      exec(cmdLine, (error, stdout, stderr) => {
        if (error) {
          console.error(`Conversion error: ${stderr || error.message}`);
          return reject(new Error('File conversion failed.'));
        }
        if (stderr) console.warn('[selectDocument] 변환 stderr', stderr);
        resolve();
      });
    });

    const docResponse = {
      PLANTNM: doc.PLANTNM,
      SYSTEMNM: doc.SYSTEMNM,
      UNIT: doc.HOGI_LABEL,
      DOCNO: doc.DOCNO,
      DOCNM: doc.DOCNM,
      DOCNUMBER: doc.DOCNUMBER,
      DOCVR: doc.DOCVR,
      DATE: doc.REGDT,
      MODIUSER: doc.USERID,
      PLANTCD: doc.PLANTCODE,
      PSMYN: doc.ISPSM,
      // 최종적으로 클라이언트가 요청할 변환된 파일의 경로
      tmpFile: `/viewer_doc/${hostFile}.vsfx`,
    };

    console.log("Document Response:", docResponse);

    res.json(docResponse);

  } catch (err) {
    console.error("DOC 변환 오류:", err);
    res.status(500).json({ error: "DOC 선택 처리 실패" });
  } finally {
    // 3. 임시 dwg 파일 삭제 (비동기)
    if (tmpFile) {
      try {
        await fs.unlink(tmpFile);
      } catch (delErr) {
        // 파일이 없거나 다른 이유로 삭제 실패 시 오류 로깅
        console.error("DWG 파일 삭제 실패:", delErr);
      }
    }
  }
});

module.exports = router;
