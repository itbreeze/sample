// Run with: node test.js
require('dotenv').config({ path: __dirname + '/.env' });

const fs = require('fs').promises;
const path = require('path');
const oracledb = require('oracledb');
const { initPool, closePool } = require('./utils/dataBase/oracleClient');

const viewerRoot = process.env.VIEWER_DOC_FOLDER
  ? path.resolve(__dirname, process.env.VIEWER_DOC_FOLDER)
  : path.resolve(__dirname, 'viewer_doc');

const isDwg = (name) => /\.dwg$/i.test(name);

async function collectDwgs(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const nested = await collectDwgs(full);
      out.push(...nested);
    } else if (ent.isFile() && isDwg(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

async function updateDocct(pool, filePath) {
  const fileName = path.basename(filePath);
  const docno = path.basename(filePath, path.extname(filePath));

  const sql = `
    UPDATE ids_doc
    SET docct = :docct
    WHERE docno = :docno
      AND current_yn = '001'
  `;

  // read DWG as buffer and bind as BLOB
  const buffer = await fs.readFile(filePath);
  const binds = {
    docct: { val: buffer, type: oracledb.BLOB },
    docno,
  };

  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, { autoCommit: true });
    const rows = result?.rowsAffected || 0;
    console.log(`[UPDATE] docno=${docno} file=${fileName} size=${buffer.length} rows=${rows}`);
    return rows;
  } finally {
    await conn.close();
  }
}

async function main() {
  await initPool();
  const pool = oracledb.getPool();

  console.log(`[INFO] DWG root: ${viewerRoot}`);
  const files = await collectDwgs(viewerRoot);
  console.log(`[INFO] Found ${files.length} dwg files`);

  let totalUpdates = 0;
  for (const file of files) {
    try {
      const rows = await updateDocct(pool, file);
      totalUpdates += rows;
    } catch (err) {
      console.error('[ERROR] update failed', { file, message: err.message });
    }
  }

  console.log(`[DONE] Total rows updated: ${totalUpdates}`);
  await closePool();
}

main().catch((err) => {
  console.error('[FATAL]', err);
  closePool();
  process.exit(1);
});
