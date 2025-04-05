// deploy-commands.js
import { REST, Routes } from "discord.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import dotenv from "dotenv";

// Carregue o .env primeiro para garantir que as variáveis de ambiente estejam disponíveis
dotenv.config();

// Informações de debug inicial
console.log("Carregando configurações...");
console.log(
  `DISCORD_TOKEN disponível: ${process.env.DISCORD_TOKEN ? "Sim" : "Não"}`
);
console.log(`CLIENT_ID disponível: ${process.env.CLIENT_ID ? "Sim" : "Não"}`);

// Depois de carregar o .env, tente importar o config
let config;
try {
  config = await import("../config/config.js");
} catch (error) {
  console.warn("⚠️ Erro ao carregar config.js:", error.message);
  console.warn("⚠️ Continuando apenas com variáveis de ambiente...");
  config = { discord: { token: null } };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Carregar dinamicamente todos os comandos
async function loadCommands() {
  const commandsPath = join(__dirname, "commands");
  const commandFiles = readdirSync(commandsPath).filter((file) =>
    file.endsWith(".js")
  );

  console.log(
    `Encontrados ${commandFiles.length} arquivos de comando para registro.`
  );
  console.log(`Diretório de comandos: ${commandsPath}`);

  for (const file of commandFiles) {
    try {
      // Correção do caminho para importação correta com ESM
      const filePath = new URL(
        `file://${join(__dirname, "commands", file).replace(/\\/g, "/")}`
      ).href;

      console.log(`Tentando carregar comando de: ${filePath}`);
      const command = await import(filePath);

      if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
        console.log(`Comando carregado para registro: ${command.data.name}`);
      } else {
        console.log(
          `⚠️ [AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute" necessária.`
        );
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar o comando ${file}:`, error);
    }
  }
}

// Registrar comandos
async function registerCommands() {
  try {
    await loadCommands();

    if (commands.length === 0) {
      console.error("❌ Nenhum comando foi carregado para registro!");
      return;
    }

    console.log(`Iniciando o registro de ${commands.length} comandos slash...`);

    // Obter tokens e IDs do .env ou config
    const token = process.env.DISCORD_TOKEN || config.discord.token;
    const clientId = process.env.CLIENT_ID || config.discord.clientId;

    // Verificar se o token está disponível
    if (!token) {
      console.error(
        "❌ Token do Discord não encontrado! Verifique se o arquivo .env existe e contém DISCORD_TOKEN=seu_token"
      );
      return;
    }

    // Verificar se o clientId está disponível
    if (!clientId) {
      console.error(
        "❌ Client ID não encontrado! Verifique se o arquivo .env contém CLIENT_ID=seu_client_id"
      );
      return;
    }

    // Imprimir informações para debug (não inclua o token completo em produção)
    console.log(`Usando Client ID: ${clientId}`);
    console.log(
      `Token disponível: ${
        token
          ? "Sim (primeiros 10 caracteres: " + token.substring(0, 10) + "...)"
          : "Não"
      }`
    );

    // Configurar REST API com o token
    const rest = new REST().setToken(token);

    // Registrar os comandos para a aplicação
    console.log(`Tentando registrar comandos com Client ID: ${clientId}`);

    try {
      const data = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });

      console.log(
        `✅ ${data.length} comando(s) slash registrado(s) com sucesso!`
      );
    } catch (apiError) {
      console.error(
        "❌ Erro na API do Discord ao registrar comandos:",
        apiError
      );
      console.error("Detalhes do erro:", apiError.message);

      if (apiError.code === 0) {
        console.error(
          "Isso pode indicar um problema com o token do Discord ou com a conexão."
        );
        console.error(
          "Verifique se o token está correto e se o bot tem as permissões necessárias."
        );
      }
    }
  } catch (error) {
    console.error("❌ Erro ao registrar comandos slash:", error);
  }
}

// Executar a função principal
registerCommands().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
