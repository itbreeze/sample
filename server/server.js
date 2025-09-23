const app = require('./app');
const dbClient = require('./utils/dataBase/dbClient');

const port = process.env.PORT || 4000;

const startServer = async () => {
    try {
        await dbClient.initPool();
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error("서버 시작 실패:", err);
        process.exit(1);
    }
};

startServer();