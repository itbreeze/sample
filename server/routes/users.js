const express = require('express');
const router = express.Router();
const oracleClient = require('../utils/dataBase/oracleClient');

const formatDateObject = (dateObj) => {
    if (!dateObj) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

router.get('/profile', async (req, res) => {
    const { userId } = req;

    if (!userId) {
        return res.status(401).json({ message: "인증된 사용자가 없음" });
    }

    try {
        // 1단계: PT_INSA 확인
        const infoSql = `
            SELECT TRIM(PERNR) AS "userId", NAME AS "userName",
                   EMGRD_NM AS "positionName", DEPT_NAME AS "department" , DEPT_CODE AS "departCode"
            FROM PT_INSA WHERE TRIM(PERNR) = :userId
        `;
        const users = await oracleClient.executeQuery(infoSql, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ message: `${userId} 사용자 정보를 찾을 수 없습니다.` });
        }
        const userInfo = users[0];

        // 2단계: psn 사용자인 경우에만 IDS_USER 추가 검증
        const isPsnUser = userId.toLowerCase().startsWith('psn');
        if (isPsnUser) {
            const validationSql = `
                SELECT 
                    END_DATE,
                    CASE 
                        WHEN TO_DATE(
                                '20' || SUBSTR(TRIM(END_DATE), 1, 2) || '/' || 
                                SUBSTR(TRIM(END_DATE), 4), 
                                'YYYY/MM/DD'
                            ) >= SYSDATE
                        THEN 'Y'
                        ELSE 'N'
                    END AS "isDateValid"
                FROM IDS_USER
                WHERE TRIM(USERID) = :userId
            `;
            const validationResult = await oracleClient.executeQuery(validationSql, [userId]);
            const permissionInfo = validationResult.length > 0 ? validationResult[0] : null;

            if (!permissionInfo) {
                return res.status(403).json({ message: `${userInfo.userName}님 ${userInfo.userId} 등록되지 않은 계정입니다.` });
            } else if (permissionInfo.isDateValid !== 'Y') {
                const formattedDate = formatDateObject(permissionInfo.END_DATE);
                return res.status(403).json({ message: `${userInfo.userName}님 ${userInfo.userId} 만료된 계정입니다. 유효기한:${formattedDate}` });
            }
        }

        // 권한 부여: 차후 추가 예정

        // 최종 승인: 모든 검증을 통과한 사용자에게 정보 반환
        res.status(200).json(userInfo);

    } catch (err) {
        console.error('사용자 조회 처리 중 서버 오류:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;