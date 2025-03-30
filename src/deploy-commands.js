// deploy-commands.js
import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import config from '../config/config.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Carregar dinamicamente todos os comandos
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  console.log(`Encontrados ${commandFiles.length} arquivos de comando para registro.`);

  for (const file of commandFiles) {
    try {
      // Correção do caminho para importação correta no Windows com ESM
      const filePath = new URL(`file://${join(__dirname, 'commands', file).replace(/\\/g, '/')}`).href;
      
      const command = await import(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Comando carregado para registro: ${command.data.name}`);
      } else {
        console.log(`[AVISO] O comando em ${filePath} está faltando a propriedade "data" ou "execute" necessária.`);
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
      console.error('Nenhum comando foi carregado para registro!');
      return;
    }
    
    console.log(`Iniciando o registro de ${commands.length} comandos slash...`);

    // Configurar REST API
    const rest = new REST().setToken(config.discord.token);

    // Registrar os comandos para a aplicação
    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands },
    );

    console.log(`${data.length} comando(s) slash registrado(s) com sucesso!`);
  } catch (error) {
    console.error('Erro ao registrar comandos slash:', error);
  }
}

// Executar a função principal
registerCommands();