const oracledb = require("oracledb");

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
let dbConfigStr;

switch (appEnv) {
  case 'dev':
  case 'development':
    dbConfigStr = process.env.DEV_DB_CFG;
    break;
  case 'kospo':
    dbConfigStr = process.env.KOSPO_DB_CFG;
    break;
  case 'khnp':
    dbConfigStr = process.env.KHNP_DB_CFG;
    break;
  default:
    console.warn(`[DB] APP_ENV "${appEnv}"에 대한 설정 없음. 'dev' 설정 사용.`);
    dbConfigStr = process.env.DEV_DB_CFG;
    break;
}

if (!dbConfigStr) {
  console.error(`'${appEnv}' 환경의 DB 설정이 .env 파일에 없습니다.`);
  process.exit(1);
}

const stripWrappingQuotes = (value) => {
  if (typeof value !== 'string' || value.length < 2) {
    return value;
  }

  const firstChar = value[0];
  const lastChar = value[value.length - 1];
  const isQuote = firstChar === lastChar && ["'", '"', '`'].includes(firstChar);

  return isQuote ? value.slice(1, -1) : value;
};

let dbConfig;
try {
  const trimmedConfig = dbConfigStr.trim();
  const normalizedConfig = stripWrappingQuotes(trimmedConfig);

  dbConfig = JSON.parse(normalizedConfig);
} catch (err) {
  console.error('DB 설정 JSON 파싱 에러:', err.message);
  process.exit(1);
}

let pool;
let poolInitialized = false;

async function initPool() {
  try {
    if (poolInitialized) {
      console.log("Oracle DB Pool already initialized");
      return;
    }
    
    pool = await oracledb.createPool({
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
    
    poolInitialized = true;
    console.log(`Oracle DB Connection Pool created for ${appEnv} environment.`);
  } catch (err) {
    console.error("Oracle DB Pool 초기화 실패:", err);
    throw err;
  }
}

async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    if (!poolInitialized || !pool) {
      console.log("Pool not initialized, initializing...");
      await initPool();
    }

    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      ...options,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      // expose dbType in meta to help detect LOBs
      extendedMetaData: true,
    });

    const rows = result.rows || [];

    // Utility: detect a Node-oracledb LOB stream-like object
    const isLobStream = (val) => val && typeof val === 'object' && typeof val.on === 'function' && (typeof val.close === 'function' || typeof val.destroy === 'function');

    // Utility: read BLOB to memory (Buffer). CLOB은 처리하지 않음.
    const readLob = (lob) => new Promise((resolve, reject) => {
      const chunks = [];
      lob.on('data', (chunk) => chunks.push(chunk));
      lob.on('error', (err) => reject(err));
      lob.on('end', () => {
        try { if (typeof lob.close === 'function') lob.close(); } catch (_) { /* noop */ }
        resolve(Buffer.concat(chunks));
      });
    });

    // Map: column name -> dbType
    const meta = Array.isArray(result.metaData) ? result.metaData : [];
    const typeByName = new Map();
    for (const c of meta) {
      if (c && c.name) typeByName.set(c.name, c.dbType);
    }

    const pendingReads = [];
    for (const row of rows) {
      for (const [col, val] of Object.entries(row)) {
        if (val == null) continue;

        // If already materialized as Buffer
        if (Buffer.isBuffer(val)) {
          const data = val;
          row[col] = {
            type: 'BLOB',
            length: data.length,
            getData: async () => data,
          };
          continue;
        }

        const dbType = typeByName.get(col);

        // Streamed BLOBs only (skip CLOB)
        if (isLobStream(val) && dbType === oracledb.DB_TYPE_BLOB) {
          const p = readLob(val).then((data) => {
            row[col] = {
              type: 'BLOB',
              length: data ? data.length : 0,
              getData: async () => data,
            };
          });
          pendingReads.push(p);
        }
      }
    }

    if (pendingReads.length) {
      await Promise.all(pendingReads);
    }

    return rows;
  } catch (err) {
    console.error("DB Query Error:", err);
    console.error("SQL:", sql);
    console.error("Binds:", binds);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Connection close error:", closeErr);
      }
    }
  }
}

async function closePool() {
  try {
    if (pool && poolInitialized) {
      await pool.close(0);
      poolInitialized = false;
      console.log("Oracle DB Pool closed");
    }
  } catch (err) {
    console.error("Pool close error:", err);
  }
}

function isPoolReady() {
  return poolInitialized && pool;
}

module.exports = { initPool, executeQuery, closePool, isPoolReady };
