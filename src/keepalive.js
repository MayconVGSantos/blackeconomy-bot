// src/keepalive.js
import http from "http";

// Cria um servidor HTTP básico para manter a aplicação ativa
const server = http.createServer((req, res) => {
  // Adicionar informações básicas sobre o estado do bot
  const statusHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>BlackEconomy Bot Status</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
          .status { color: green; font-weight: bold; }
          .uptime { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>BlackEconomy Bot</h1>
        <p class="status">✅ Online</p>
        <p class="uptime">Ativo desde: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(statusHTML);
});

// Configurar intervalo para fazer ping em si mesmo (útil para plataformas como Replit)
const keepAlive = () => {
  setInterval(() => {
    console.log(`🔄 Keep-alive ping em ${new Date().toLocaleString()}`);
  }, 5 * 60 * 1000); // A cada 5 minutos
};

// Iniciar o servidor na porta definida ou na 8080 como fallback
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🟢 Keep-alive HTTP server rodando na porta ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);

  // Iniciar o sistema de keep-alive
  keepAlive();
});

// Tratamento de erros do servidor
server.on("error", (error) => {
  console.error("❌ Erro no servidor HTTP:", error);
});

export default server; // Exportar o servidor para referência em outros módulos
