// src/keepalive.js
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});

server.listen(process.env.PORT || 8080, () => {
  console.log(`🟢 Keep-alive HTTP server rodando na porta ${process.env.PORT || 8080}`);
});
