const app = require('./app');
const oracleClient = require('./utils/dataBase/oracleClient');

const port = process.env.PORT || 4001;

const startServer = async () => {
    try {
        await oracleClient.initPool();
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error("서버 시작 실패:", err);
        process.exit(1);
    }
};

startServer();
