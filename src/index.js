// index.js
import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import config from "../config/config.js";
import dotenv from "dotenv";
import './keepalive.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Criação do cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Coleção para armazenar comandos
client.commands = new Collection();

// Função para carregar comandos
async function loadCommands() {
  try {
    const commandsPath = join(__dirname, "commands");
    const commandFiles = readdirSync(commandsPath).filter((file) =>
      file.endsWith(".js")
    );

    for (const file of commandFiles) {
      // Correção do caminho para importação correta no Windows com ESM
      const filePath = new URL(
        `file://${join(__dirname, "commands", file).replace(/\\/g, "/")}`
      ).href;

      try {
        const command = await import(filePath);

        // Se o comando tiver as propriedades necessárias, adicione à coleção
        if ("data" in command && "execute" in command) {
          client.commands.set(command.data.name, command);
          console.log(`Comando carregado: ${command.data.name}`);
        } else {
          console.log(
            `[AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute" necessária.`
          );
        }
      } catch (error) {
        console.error(`Erro ao carregar o comando ${file}:`, error);
      }
    }

    console.log(
      `Total de ${client.commands.size} comandos carregados com sucesso!`
    );
  } catch (error) {
    console.error("Erro ao carregar comandos:", error);
  }
}

// Evento quando o bot está pronto
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Pronto! Bot conectado como ${readyClient.user.tag}`);
});

// Tratamento de interações
client.on(Events.InteractionCreate, async (interaction) => {
  // Ignora interações que não são comandos de slash
  if (!interaction.isChatInputCommand()) return;

  // Busca o comando na coleção
  const command = client.commands.get(interaction.commandName);

  // Se o comando não existe, ignora
  if (!command) {
    console.error(
      `Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`
    );
    return;
  }

  try {
    // Executa o comando
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `Erro ao executar o comando ${interaction.commandName}:`,
      error
    );

    // Responde ao usuário caso o comando falhe
    const errorMessage = {
      content: "Ocorreu um erro ao executar este comando!",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Iniciar o bot
async function startBot() {
  try {
    // Carregar os comandos
    await loadCommands();

    // Fazer login no Discord com o token
    await client.login(config.discord.token);

    console.log("BlackEconomy Bot iniciado com sucesso!");
  } catch (error) {
    console.error("Erro ao iniciar o bot:", error);
  }
}

startBot();

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("Rejeição não tratada em:", promise, "razão:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Exceção não capturada:", error);
});
