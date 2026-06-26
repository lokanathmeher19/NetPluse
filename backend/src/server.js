const app = require('./app');
const env = require('./config/env');

app.listen(env.port, '0.0.0.0', () => {
    console.log(`Enterprise Express Speedtest Backend running on port ${env.port}`);
});
