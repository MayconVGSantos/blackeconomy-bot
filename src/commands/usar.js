// usar.js
import { 
    SlashCommandBuilder,
    EmbedBuilder
  } from 'discord.js';
  import inventoryService from '../services/inventory.js';
  import storeItemsService from '../services/store-items.js';
  import embedUtils from '../utils/embed.js';
  import firebaseService from '../services/firebase.js';
  import { 
    getDatabase, 
    ref, 
    set, 
    update,
    get 
  } from 'firebase/database';
  
  export const data = new SlashCommandBuilder()
    .setName('usar')
    .setDescription('Usa um item do seu inventário')
    .addStringOption(option => 
      option.setName('item')
        .setDescription('Item que você deseja usar')
        .setRequired(true)
        .setAutocomplete(true)
    );
  
  export async function execute(interaction) {
    await interactionHandler(interaction);
  }
  
  // Função para autocompletar os itens
  export async function autocomplete(interaction) {
    const userId = interaction.user.id;
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    try {
      // Obter inventário do usuário
      const inventory = await inventoryService.getUserInventory(userId);
      
      if (!inventory || !inventory.items) {
        return interaction.respond([]);
      }
      
      // Filtrar itens usáveis
      const usableItems = [];
      
      for (const itemId in inventory.items) {
        if (inventory.items[itemId].quantity <= 0) continue;
        
        const item = storeItemsService.getItemById(itemId);
        
        if (item && item.usavel) {
          usableItems.push({
            name: `${item.icon} ${item.name}`,
            value: itemId
          });
        }
      }
      
      // Filtrar por texto digitado
      const filtered = usableItems.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue)
      );
      
      await interaction.respond(
        filtered.slice(0, 25)
      );
    } catch (error) {
      console.error('Erro na autocompletar items:', error);
      await interaction.respond([]);
    }
  }
  
  async function interactionHandler(interaction) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const itemId = interaction.options.getString('item');
      
      // Verificar se o item existe
      const item = storeItemsService.getItemById(itemId);
      
      if (!item) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Item Não Encontrado',
          mensagem: 'O item que você tentou usar não existe.'
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Verificar se o item é usável
      if (!item.usavel) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Item Não Usável',
          mensagem: `${item.icon} ${item.name} não é um item que pode ser usado.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Verificar se o usuário possui o item
      const hasItem = await inventoryService.hasItem(userId, itemId);
      
      if (!hasItem) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Item Não Encontrado',
          mensagem: `Você não possui ${item.icon} ${item.name} em seu inventário.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Verificar cooldown do item
      const cooldownCheck = await inventoryService.checkItemCooldown(userId, itemId);
      
      if (cooldownCheck.emCooldown) {
        const minutes = Math.floor(cooldownCheck.tempoRestante / 60000);
        const seconds = Math.floor((cooldownCheck.tempoRestante % 60000) / 1000);
        
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Item em Cooldown',
          mensagem: `Você precisa esperar **${minutes}m ${seconds}s** para usar ${item.icon} ${item.name} novamente.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Usar o item
      const used = await inventoryService.useItem(userId, itemId);
      
      if (!used) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Erro ao Usar Item',
          mensagem: `Não foi possível usar ${item.icon} ${item.name}.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Aplicar efeito do item
      let resultMessage = await applyItemEffect(userId, item);
      
      // Criar embed de sucesso
      const embedSucesso = new EmbedBuilder()
        .setColor(0x00FF00) // Verde
        .setTitle(`${item.icon} Item Usado com Sucesso`)
        .setDescription(`Você usou **${item.name}**!`)
        .addFields(
          { name: '📋 Efeito', value: resultMessage, inline: false }
        )
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embedSucesso] });
    } catch (error) {
      console.error('Erro ao executar comando usar:', error);
      
      // Criar embed de erro
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: 'Erro no Comando',
        mensagem: 'Ocorreu um erro ao processar o comando. Tente novamente mais tarde.'
      });
      
      return interaction.editReply({ embeds: [embedErro] });
    }
  }
  
  /**
   * Aplica o efeito do item usado
   * @param {string} userId - ID do usuário
   * @param {Object} item - Objeto do item
   * @returns {Promise<string>} - Mensagem de resultado
   */
  async function applyItemEffect(userId, item) {
    const database = getDatabase();
    
    try {
      switch (item.effect) {
        case 'reduce_cooldown': {
          // Reduz o cooldown de todos os comandos
          const userRef = ref(database, `users/${userId}/cooldowns`);
          const snapshot = await get(userRef);
          
          if (!snapshot.exists()) {
            return 'Nenhum cooldown para reduzir.';
          }
          
          const cooldowns = snapshot.val();
          const now = Date.now();
          const updatedCooldowns = {};
          
          // Para cada comando em cooldown, reduzir o tempo
          for (const cmd in cooldowns) {
            const lastUsed = cooldowns[cmd];
            const timeElapsed = now - lastUsed;
            
            // Se ainda está em cooldown, reduzir o tempo
            updatedCooldowns[cmd] = lastUsed + (timeElapsed * item.effectValue);
          }
          
          await update(userRef, updatedCooldowns);
          return `Reduziu o cooldown de todos os comandos em ${item.effectValue * 100}%.`;
        }
        
        case 'boost_work': {
          // Aumenta os ganhos do comando trabalhar por um período
          const userRef = ref(database, `users/${userId}/activeEffects`);
          
          await update(userRef, {
            boost_work: {
              multiplier: item.effectValue,
              expiration: Date.now() + item.duration
            }
          });
          
          const hours = Math.floor(item.duration / 3600000);
          return `Aumentou os ganhos do comando /trabalhar em ${(item.effectValue - 1) * 100}% por ${hours} hora(s).`;
        }
        
        case 'boost_crime': {
          // Aumenta os ganhos e chance de sucesso do comando crime
          const userRef = ref(database, `users/${userId}/activeEffects`);
          
          await update(userRef, {
            boost_crime: {
              multiplier: item.effectValue,
              expiration: Date.now() + item.duration
            }
          });
          
          const hours = Math.floor(item.duration / 3600000);
          return `Aumentou os ganhos e chances de sucesso do comando /crime em ${(item.effectValue - 1) * 100}% por ${hours} hora(s).`;
        }
        
        case 'vip_status': {
          // Aplica status VIP
          const userRef = ref(database, `users/${userId}/activeEffects`);
          
          await update(userRef, {
            vip_status: {
              cooldownReduction: item.effectValue.cooldownReduction,
              incomeBoost: item.effectValue.incomeBoost,
              expiration: Date.now() + item.duration
            }
          });
          
          const days = Math.floor(item.duration / 86400000);
          return `Status VIP ativado por ${days} dia(s). Redução de cooldowns em ${item.effectValue.cooldownReduction * 100}% e aumento de ganhos em ${item.effectValue.incomeBoost * 100}%.`;
        }
        
        default:
          return 'Este item não tem efeito definido.';
      }
    } catch (error) {
      console.error('Erro ao aplicar efeito do item:', error);
      throw error;
    }
  }