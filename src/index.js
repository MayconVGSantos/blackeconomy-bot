// index.js
import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import dotenv from "dotenv";

// Carregue o .env primeiro para garantir que as variáveis de ambiente estejam disponíveis
dotenv.config();

// Depois de carregar o .env, importe o config
import config from "../config/config.js";
import "./keepalive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Criação do cliente Discord com todos os intents necessários
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

    console.log(`Carregando ${commandFiles.length} comandos...`);

    for (const file of commandFiles) {
      // Correção do caminho para importação correta com ESM
      const filePath = new URL(
        `file://${join(__dirname, "commands", file).replace(/\\/g, "/")}`
      ).href;

      try {
        console.log(`Carregando comando: ${file}`);
        const command = await import(filePath);

        // Se o comando tiver as propriedades necessárias, adicione à coleção
        if ("data" in command && "execute" in command) {
          client.commands.set(command.data.name, command);
          console.log(`✅ Comando carregado: ${command.data.name}`);
        } else {
          console.log(
            `⚠️ [AVISO] O comando em ${file} está faltando a propriedade "data" ou "execute" necessária.`
          );
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar o comando ${file}:`, error);
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
  console.log(`🤖 Pronto! Bot conectado como ${readyClient.user.tag}`);

  // Definir status do bot
  client.user.setActivity("economia simulada", { type: "PLAYING" });
});

// Tratamento de interações
client.on(Events.InteractionCreate, async (interaction) => {
  // Ignora interações que não são comandos de slash
  if (!interaction.isChatInputCommand()) return;

  console.log(
    `📨 Comando recebido: ${interaction.commandName} de ${interaction.user.tag}`
  );

  // Busca o comando na coleção
  const command = client.commands.get(interaction.commandName);

  // Se o comando não existe, ignora
  if (!command) {
    console.error(
      `❓ Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`
    );
    return;
  }

  try {
    // Executa o comando
    console.log(`⚙️ Executando comando: ${interaction.commandName}`);
    await command.execute(interaction);
    console.log(`✅ Comando ${interaction.commandName} executado com sucesso`);
  } catch (error) {
    console.error(
      `❌ Erro ao executar o comando ${interaction.commandName}:`,
      error
    );

    // Responde ao usuário caso o comando falhe
    const errorMessage = {
      content: "Ocorreu um erro ao executar este comando!",
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      console.error("Erro ao responder à interação:", replyError);
    }
  }
});

// Iniciar o bot
async function startBot() {
  try {
    console.log("🔄 Iniciando BlackEconomy Bot...");

    // Carregar os comandos primeiro
    await loadCommands();

    // Tentar fazer login com a variável de ambiente DISCORD_TOKEN primeiro,
    // se não estiver disponível, usar o token do config
    const token = process.env.DISCORD_TOKEN || config.discord.token;

    if (!token) {
      throw new Error("Token do Discord não encontrado!");
    }

    console.log("🔑 Tentando fazer login no Discord...");

    // Fazer login no Discord com o token
    await client.login(token);

    console.log("✅ BlackEconomy Bot iniciado com sucesso!");
  } catch (error) {
    console.error("❌ Erro crítico ao iniciar o bot:", error);
    process.exit(1); // Encerra o processo com código de erro
  }
}

// Iniciar o bot
startBot();

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Rejeição não tratada em:", promise, "razão:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Exceção não capturada:", error);
});

// Exporta o cliente para uso em outros módulos
export default client;
