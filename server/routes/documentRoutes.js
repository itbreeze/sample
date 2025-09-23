require('dotenv').config();
const express = require("express");
const router = express.Router();
const dbClient = require('../utils/dataBase/dbClient');
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
        NULL         AS "DOCNAME",
        NULL         AS "DOCNUM",
        NULL         AS "DOCVR",
        'FOLDER'     AS "TYPE",
        FD.PLANTCODE AS "PLANTCODE"
      FROM IDS_FOLDER FD
      WHERE FD.APP_GUBUN = '001'  

      UNION ALL

      SELECT 
        D.DOCNO     AS "ID",
        D.FOLID     AS "PARENTID",
        NULL        AS "NAME",       
        D.DOCNM     AS "DOCNAME",
        D.DOCNUMBER AS "DOCNUM",
        D.DOCVR     AS "DOCVR",
        'DOC'       AS "TYPE",
        D.PLANTCODE AS "PLANTCODE"
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


router.post("/selectDocument", async (req, res) => {
  const { docId, docVr } = req.body;
  let tmpFile;

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
    if (!fs.existsSync(VIEWER_FOLDER))
      fs.mkdirSync(VIEWER_FOLDER, { recursive: true });

    const hostFile = `${doc.DOCNO}${doc.DOCVR}`;
    tmpFile = path.join(VIEWER_FOLDER, `${hostFile}.dwg`);
    const outputPath = path.join(VIEWER_FOLDER, `${hostFile}.vsfx`);

    const buffer = await doc.DOCCT.getData();
    fs.writeFileSync(tmpFile, buffer);

    const cmdLine = `"${CONVERTER_PATH}" "${tmpFile}" "${outputPath}" --multithreading=true`;
    execSync(cmdLine, { stdio: "ignore" });

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