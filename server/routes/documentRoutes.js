require('dotenv').config();
const express = require("express");
const router = express.Router();
const dbClient = require('../utils/dataBase/dbClient');
const path = require("path");
const fs = require("fs").promises; // fs.promises 사용
const { exec } = require('child_process'); // exec 사용

const VIEWER_FOLDER = path.resolve(process.env.VIEWER_DOC_FOLDER);
const CONVERTER_PATH = path.resolve(process.env.FILECONVERTER);

// GET "/" 라우트는 변경 없이 그대로 둡니다.
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT 
        FD.FOLID     AS "ID",
        FD.FOLPT     AS "PARENTID",
        FD.FOLNM     AS "NAME",
        NULL         AS "DOCNAME",
        NULL         AS "DOCNUM",
        NULL         AS "DOCVR",
        'FOLDER'     AS "TYPE",
        FD.PLANTCODE AS "PLANTCODE"
      FROM IDS_FOLDER FD
      WHERE FD.APP_GUBUN = '001'  
      UNION ALL
      SELECT 
        D.DOCNO      AS "ID",
        D.FOLID      AS "PARENTID",
        NULL         AS "NAME",       
        D.DOCNM      AS "DOCNAME",
        D.DOCNUMBER  AS "DOCNUM",
        D.DOCVR      AS "DOCVR",
        'DOC'        AS "TYPE",
        D.PLANTCODE  AS "PLANTCODE"
      FROM IDS_DOC D
      WHERE D.CURRENT_YN = '001'
      ORDER BY "PLANTCODE", "ID"
    `;
    const getDocumentList = await dbClient.executeQuery(sql);
    res.json(getDocumentList);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "DB 조회 실패" });
  }
});


// =================================================================
// (수정된 코드) /selectDocument 라우트
// =================================================================
router.post("/selectDocument", async (req, res) => {
  const { docId, docVr } = req.body;
  let tmpFile; // 임시 dwg 파일 경로

  try {
    const sql = `SELECT S.PLANTNM,F.HOGI_GUBUN,D.DOCNO,D.DOCNM,D.DOCNUMBER,D.DOCVR,D.REGDT,D.REGID,D.USERID,D.PLANTCODE,D.ISPSM,D.DOCCT
                 FROM IDS_DOC D LEFT JOIN IDS_SITE S
                   ON D.PLANTCODE=S.PLANTCODE
                   LEFT JOIN IDS_FOLDER F
                   ON D.FOLID=F.FOLID
                 WHERE S.FOLDER_TYPE='003' AND D.CURRENT_YN='001' AND D.DOCNO = :docId AND D.DOCVR = :docVr`;
    const results = await dbClient.executeQuery(sql, [docId, docVr]);

    if (!results.length)
      return res.status(404).json({ error: "DOC 파일이 없습니다." });

    const doc = results[0];
    // VSFX 파일이 저장될 폴더 확인 및 생성 (비동기)
    await fs.mkdir(VIEWER_FOLDER, { recursive: true });

    const hostFile = `${doc.DOCNO}${doc.DOCVR}`;
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
            resolve();
        });
    });

    const docResponse = {
      PLANTNM:doc.PLANTNM,
      UNIT:doc.HOGI_GUBUN,
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