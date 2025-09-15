const oracledb = require("oracledb");

// NODE_ENV 값에 따라 DB 설정 선택
const env = process.env.NODE_ENV || 'development';
let dbConfigStr;

switch (env) {
  case 'development':
    dbConfigStr = process.env.DEV_DB_CFG;
    break;
  case 'kospo':
    dbConfigStr = process.env.KOSPO_DB_CFG;
    break;
  // --- 신규 환경 설정 추가 위치 ---
  default:
    console.warn(`[DB] NODE_ENV "${env}"에 대한 설정 없음. 'development' 설정 사용.`);
    dbConfigStr = process.env.DEV_DB_CFG;
    break;
}

// DB 설정 존재 여부 확인
if (!dbConfigStr) {
  console.error(`'${env}' 환경의 DB 설정이 .env 파일에 없습니다.`);
  process.exit(1);
}

let dbConfig;
try {
  dbConfig = JSON.parse(dbConfigStr.replace(/'/g, ''));
} catch (err) {
  console.error("DB 설정 JSON 파싱 에러:", err.message);
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

    // oracledb.initOracleClient({libDir: 'C:\\oracle\\instantclient_21_3'}); // Windows Instant Client 경로 (필요시 주석 해제)
    
    pool = await oracledb.createPool({
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
    
    poolInitialized = true;
    console.log(`Oracle DB Connection Pool created for ${env} environment.`);
  } catch (err) {
    console.error("Oracle DB Pool 초기화 실패:", err);
    throw err;
  }
}

async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    // Pool이 없으면 초기화
    if (!poolInitialized || !pool) {
      console.log("Pool not initialized, initializing...");
      await initPool();
    }

    // console.log('executeQuery SQL:', sql);
    // console.log('executeQuery binds:', binds);

    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      ...options,
      outFormat: oracledb.OUT_FORMAT_OBJECT, // 결과 포맷: {컬럼명: 값} 객체
    });
    
    return result.rows;
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

// Pool 상태 확인
function isPoolReady() {
  return poolInitialized && pool;
}

module.exports = { initPool, executeQuery, closePool, isPoolReady };