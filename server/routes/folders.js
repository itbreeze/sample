
require('dotenv').config();
const express = require("express");
const router = express.Router();
const oracleClient = require('../utils/dataBase/oracleClient');
const path = require("path");
const fs = require("fs");
const { execSync } = require('child_process');



const VIEWER_FOLDER = path.resolve(process.env.VIEWER_DOC_FOLDER);
const CONVERTER_PATH = path.resolve(process.env.FILECONVERTER);



router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT 
        FD.FOLID     AS "ID",
        FD.FOLPT     AS "PARENTID",
        FD.FOLNM     AS "NAME",
        NULL         AS "DOCNAME",  -- DOC 전용 값은 NULL
        NULL         AS "DOCNUM",   -- DOC 전용 값은 NULL
        NULL         AS "DOCVR",    -- DOC 전용 값은 NULL
        'FOLDER'     AS "TYPE",
        FD.PLANTCODE AS "PLANTCODE"
      FROM IDS_FOLDER FD
      WHERE FD.APP_GUBUN = '001'  

      UNION ALL

      SELECT 
        D.DOCNO     AS "ID",
        D.FOLID     AS "PARENTID",
        NULL        AS "NAME",       
        D.DOCNM     AS "DOCNAME",    -- DOC 전용
        D.DOCNUMBER AS "DOCNUM",     -- DOC 전용
        D.DOCVR     AS "DOCVR",      -- DOC 전용
        'DOC'       AS "TYPE",
        D.PLANTCODE AS "PLANTCODE"
      FROM IDS_DOC D
      WHERE D.CURRENT_YN = '001'
      ORDER BY "PLANTCODE", "ID"
    `;
    const getDocumentList = await oracleClient.executeQuery(sql);
    res.json(getDocumentList);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "DB 조회 실패" });
  }
});


router.post("/selectDocument", async (req, res) => {

  const { docId, docVr } = req.body;
  
  let tmpFile;

  try {
    const sql = `SELECT DOCNO,DOCNM,DOCNUMBER,DOCVR,REGDT,REGID,USERID,PLANTCODE,ISPSM,DOCCT 
                 FROM IDS_DOC WHERE DOCNO = :docId AND DOCVR = :docVr`;
    const results = await oracleClient.executeQuery(sql, [docId, docVr]);

    if (!results.length)
      return res.status(404).json({ error: "DOC 파일이 없습니다." });

    const doc = results[0];
    if (!fs.existsSync(VIEWER_FOLDER))
      fs.mkdirSync(VIEWER_FOLDER, { recursive: true });

    const hostFile = `${doc.DOCNO}${doc.DOCVR}`;
    tmpFile = path.join(VIEWER_FOLDER, `${hostFile}.dwg`);
    const outputPath = path.join(VIEWER_FOLDER, `${hostFile}.vsfx`);

    // LOB → Buffer 저장
    const buffer = await doc.DOCCT.getData();
    fs.writeFileSync(tmpFile, buffer);

    // FileConverter 실행
    const cmdLine = `"${CONVERTER_PATH}" "${tmpFile}" "${outputPath}" --multithreading=true`;
    execSync(cmdLine, { stdio: "ignore" });

    const docResponse = {
      DOCNO: doc.DOCNO,
      DOCNM: doc.DOCNM,
      DOCNUMBER: doc.DOCNUMBER,
      DOCVR: doc.DOCVR,
      DATE: doc.REGDT,
      MODIUSER: doc.USERID,
      PLANTCD: doc.PLANTCODE,
      PSMYN: doc.ISPSM,
      tmpFile: `/viewer_doc/${hostFile}.vsfx`,
    };
    console.log(docResponse);
    res.json(docResponse);

  } catch (err) {
    console.error("DOC 변환 오류:", err);
    res.status(500).json({ error: "DOC 선택 처리 실패" });
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch (delErr) {
        console.error("DWG 파일 삭제 실패:", delErr);
      }
    }
  }
});



module.exports = router;
