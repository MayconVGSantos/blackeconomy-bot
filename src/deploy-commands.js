// deploy-commands.js
import { REST, Routes } from "discord.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import dotenv from "dotenv";

// Carregue o .env primeiro para garantir que as variveis de ambiente estejam disponíveis
dotenv.config();

// Depois de carregar o .env, importe o config
import config from "../config/config.js";

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
      // Correção do caminho para importação correta no Widows com ESM
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
          `[AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute" necessária.`
        );
      }
    } catch (error) {
      console.error(`Erro ao carregar o comando ${file}:`, error);
    }
  }
}

// Registrar comandos
async function registerCommands() {
  try {
    await loadCommands();

    if (commands.length === 0) {
      console.error("Nenhum comando foi carregado para registro!");
      return;
    }

    console.log(`Iniciando o registro de ${commands.length} comandos slash...`);

    // Verificar se o token está disponível
    if (!process.env.DISCORD_TOKEN) {
      console.error(
        "Token do Discord não encontrado no arquivo .env! Verifique se o arquivo .env existe e contém DISCORD_TOKEN=seu_token"
      );
      return;
    }

    // Verificar se o clientId está disponível
    if (!process.env.CLIENT_ID) {
      console.error(
        "Client ID não encontrado no arquivo .env! Verifique se o arquivo .env contém CLIENT_ID=seu_client_id"
      );
      return;
    }

    // Imprimir informações para debug (não inclua o token completo em produção)
    console.log(`Usando Client ID: ${process.env.CLIENT_ID}`);
    console.log(
      `Token disponível: ${
        process.env.DISCORD_TOKEN
          ? "Sim (primeiros 10 caracteres: " +
            process.env.DISCORD_TOKEN.substring(0, 10) +
            "...)"
          : "Não"
      }`
    );

    // Configurar REST API diretamente com o token do .env
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    // Registrar os comandos para a aplicação
    console.log(
      `Tentando registrar comandos com Client ID: ${process.env.CLIENT_ID}`
    );
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`${data.length} comando(s) slash registrado(s) com sucesso!`);
  } catch (error) {
    console.error("Erro ao registrar comandos slash:", error);
  }
}

// Executar a função principal
registerCommands();
