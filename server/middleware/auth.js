// Base64 디코드 함수
const decode = (b64) => Buffer.from(b64, 'base64').toString();

const identifyUser = (req, res, next) => {
  let identifiedUserId;
  const appEnv = process.env.APP_ENV || 'dev';

  console.log(`[Auth] 실행 환경: ${appEnv}`);

  if (appEnv === 'dev') {
    identifiedUserId = 'psn21115';
  } else if (appEnv === 'kospo') {
    const queryUserId = req.query.sUserId;
    const cookieUserId = req.cookies.sUserId;

    if (queryUserId) {
      identifiedUserId = decode(queryUserId);
      const last = queryUserId.slice(-2);
      const rest = queryUserId.slice(0, -2);
      res.cookie('sUserId', last + rest, {
        maxAge: 86400000,
        httpOnly: true,
        path: '/',
      });
    } else if (cookieUserId) {
      const str = cookieUserId.slice(2) + cookieUserId.slice(0, 2);
      identifiedUserId = decode(str);
    }
  } else if (appEnv === 'khnp') {
    console.log('[Auth] khnp 환경 로직 미구현');
  }

  if (identifiedUserId) {
    req.userId = identifiedUserId;
    console.log(`[Auth] 사용자 접근: ${req.userId}`);
    return next();
  }

  if (appEnv !== 'dev') {
    return res.status(401).json({ message: '사용자 인증 실패' });
  }

  next();
};

module.exports = { identifyUser };