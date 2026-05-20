require('dotenv').config();
import http from 'http';
import app from './app';

const port = Number(process.env.APP_PORT || 8000);
const host = process.env.APP_HOST || '0.0.0.0';

const server = http.createServer(app);

server.listen(port, host, () => {
  console.warn(`Server running on http://${host}:${port}`);
});

export default server;
