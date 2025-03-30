// inventario.js
import { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
   } from 'discord.js';
   import inventoryService from '../services/inventory.js';
   import storeItemsService from '../services/store-items.js';
   import embedUtils from '../utils/embed.js';
   
   export const data = new SlashCommandBuilder()
    .setName('inventario')
    .setDescription('Mostra os itens em seu inventário')
    .addUserOption(option => 
      option.setName('usuario')
        .setDescription('Usuário para ver o inventário (opcional)')
        .setRequired(false)
    )
    .addStringOption(option => 
      option.setName('categoria')
        .setDescription('Categoria de itens para mostrar')
        .setRequired(false)
        .addChoices(
          { name: '🎰 Cassino', value: 'casino' },
          { name: '🧪 Consumíveis', value: 'consumiveis' },
          { name: '✨ VIP', value: 'vip' }
        )
    );
   
   export async function execute(interaction) {
    try {
      await interaction.deferReply();
      
      // Verifica se foi especificado um usuário ou usa o autor do comando
      const targetUser = interaction.options.getUser('usuario') || interaction.user;
      const userId = targetUser.id;
      const isOwnInventory = targetUser.id === interaction.user.id;
      
      // Verifica se foi especificada uma categoria
      const category = interaction.options.getString('categoria');
      
      // Obter inventário do usuário
      const inventory = await inventoryService.getUserInventory(userId);
      
      if (!inventory) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Inventário Não Encontrado',
          mensagem: `Não foi possível encontrar o inventário ${isOwnInventory ? 'do seu usuário' : 'deste usuário'}.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Se uma categoria foi especificada, mostrar apenas itens dessa categoria
      if (category) {
        return await showCategoryItems(interaction, targetUser, category, inventory);
      }
      
      // Caso contrário, mostrar o resumo do inventário
      return await showInventorySummary(interaction, targetUser, inventory);
    } catch (error) {
      console.error('Erro ao executar comando inventario:', error);
      
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
   * Mostra o resumo do inventário do usuário
   * @param {Interaction} interaction - Interação do Discord
   * @param {User} targetUser - Usuário alvo
   * @param {Object} inventory - Dados do inventário
   * @returns {Promise<void>}
   */
   async function showInventorySummary(interaction, targetUser, inventory) {
    const isOwnInventory = targetUser.id === interaction.user.id;
    
    // Contagem de itens por categoria
    const itemCounts = {
      'casino': 0,
      'consumiveis': 0,
      'vip': 0
    };
    
    // Contar itens por categoria
    if (inventory.items) {
      for (const itemId in inventory.items) {
        const item = storeItemsService.getItemById(itemId);
        if (item && item.category && itemCounts[item.category] !== undefined) {
          itemCounts[item.category] += inventory.items[itemId].quantity;
        }
      }
    }
    
    // Criar campos para cada categoria
    const fields = [];
    
    // Campo para fichas de cassino
    fields.push({
      name: '🎰 Fichas de Cassino',
      value: `${inventory.fichas_cassino || 0} fichas`,
      inline: true
    });
    
    // Campos para categorias de itens
    for (const category in itemCounts) {
      fields.push({
        name: `${storeItemsService.getCategoryIcon(category)} ${storeItemsService.getCategoryDisplayName(category)}`,
        value: `${itemCounts[category]} item(s)`,
        inline: true
      });
    }
    
    // Se não há itens no inventário
    if (fields.length === 0) {
      fields.push({
        name: '❌ Inventário Vazio',
        value: 'Você ainda não possui nenhum item. Use o comando `/loja` para comprar itens.',
        inline: false
      });
    }
    
    // Criar embed de inventário
    const embed = new EmbedBuilder()
      .setColor(0x0099FF) // Azul
      .setTitle(`🎒 Inventário de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(fields)
      .setFooter({ text: `Use o menu abaixo para ver detalhes por categoria • ${targetUser.username}` })
      .setTimestamp();
    
    // Criar menu de seleção apenas se for o próprio inventário
    const components = [];
    
    if (isOwnInventory) {
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('inventory_category')
            .setPlaceholder('Selecione uma categoria para ver detalhes')
            .addOptions([
              {
                label: '🎰 Cassino',
                value: 'casino',
                emoji: '🎰',
                description: 'Ver itens de cassino'
              },
              {
                label: '🧪 Consumíveis',
                value: 'consumiveis',
                emoji: '🧪',
                description: 'Ver itens consumíveis'
              },
              {
                label: '✨ VIP',
                value: 'vip',
                emoji: '✨',
                description: 'Ver itens VIP'
              }
            ])
        );
        
      components.push(selectRow);
    }
    
    // Enviar a mensagem
    const reply = await interaction.editReply({
      embeds: [embed],
      components: components
    });
    
    // Se não há componentes interativos, não precisa de coletor
    if (components.length === 0) return;
    
    // Criar coletor de interações
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000 // 1 minuto
    });
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Você não pode usar este menu.', ephemeral: true });
        return;
      }
      
      const selectedCategory = i.values[0];
      await i.deferUpdate();
      await showCategoryItems(interaction, targetUser, selectedCategory, inventory);
      collector.stop();
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Desativar o menu após o tempo limite
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('inventory_category_disabled')
              .setPlaceholder('Menu expirado')
              .setDisabled(true)
              .addOptions([{ label: 'Expirado', value: 'expired' }])
          );
        
        await interaction.editReply({
          components: [disabledRow]
        }).catch(console.error);
      }
    });
   }
   
   /**
   * Mostra os itens de uma categoria específica
   * @param {Interaction} interaction - Interação do Discord
   * @param {User} targetUser - Usuário alvo
   * @param {string} category - Categoria selecionada
   * @param {Object} inventory - Dados do inventário
   * @returns {Promise<void>}
   */
   async function showCategoryItems(interaction, targetUser, category, inventory) {
    const isOwnInventory = targetUser.id === interaction.user.id;
    
    // Lista de itens desta categoria que o usuário possui
    const userItems = [];
    
    // Para itens especiais como fichas de cassino
    if (category === 'casino' && inventory.fichas_cassino) {
      userItems.push({
        id: 'fichas_cassino',
        name: 'Fichas de Cassino',
        description: 'Usadas para apostar nos jogos do cassino.',
        quantity: inventory.fichas_cassino,
        icon: '🎰'
      });
    }
    
    // Para outros itens normais
    if (inventory.items) {
      for (const itemId in inventory.items) {
        const itemData = inventory.items[itemId];
        const item = storeItemsService.getItemById(itemId);
        
        if (item && item.category === category) {
          userItems.push({
            ...item,
            quantity: itemData.quantity,
            lastUsed: itemData.lastUsed
          });
        }
      }
    }
    
    // Se não há itens nesta categoria
    if (userItems.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000) // Vermelho
        .setTitle(`${storeItemsService.getCategoryIcon(category)} Nenhum Item Encontrado`)
        .setDescription(`${isOwnInventory ? 'Você não possui' : 'Este usuário não possui'} nenhum item na categoria ${storeItemsService.getCategoryDisplayName(category)}.`);
        
      const backButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('inventory_back')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      
      const reply = await interaction.editReply({
        embeds: [embed],
        components: isOwnInventory ? [backButton] : []
      });
      
      // Se não for o próprio inventário, não precisa de botão de voltar
      if (!isOwnInventory) return;
      
      // Criar coletor para o botão de voltar
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minuto
      });
      
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Você não pode usar este botão.', ephemeral: true });
          return;
        }
        
        await i.deferUpdate();
        await showInventorySummary(interaction, targetUser, inventory);
        collector.stop();
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              ButtonBuilder.from(backButton.components[0]).setDisabled(true)
            );
          
          await interaction.editReply({
            components: [disabledRow]
          }).catch(console.error);
        }
      });
      
      return;
    }
    
    // Descrição dos itens
    const itemsDescription = userItems.map(item => {
      let description = `**${item.icon} ${item.name}** (x${item.quantity})
   ${item.description}`;
      
      // Adicionar informações sobre último uso, se aplicável
      if (item.lastUsed) {
        const lastUsedDate = new Date(item.lastUsed);
        description += `\nÚltimo uso: ${lastUsedDate.toLocaleString('pt-BR')}`;
        
        // Se for um item com cooldown, mostrar tempo restante
        if (item.cooldown) {
          const now = Date.now();
          const timeElapsed = now - item.lastUsed;
          
          if (timeElapsed < item.cooldown) {
            const timeRemaining = item.cooldown - timeElapsed;
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            
            description += `\n⏱️ Cooldown: ${minutes}m ${seconds}s restantes`;
          }
        }
      }
      
      return description;
    }).join('\n\n');
    
    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF) // Azul
      .setTitle(`${storeItemsService.getCategoryIcon(category)} ${storeItemsService.getCategoryDisplayName(category)} - ${targetUser.username}`)
      .setDescription(itemsDescription)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `Inventário de ${targetUser.username}` })
      .setTimestamp();
    
    // Botões para navegar e usar itens
    const components = [];
    
    if (isOwnInventory) {
      // Botões de uso para itens consumíveis
      if (category === 'consumiveis') {
        const usableItems = userItems.filter(item => item.usavel && item.quantity > 0);
        
        for (let i = 0; i < Math.min(usableItems.length, 5); i++) {
          const item = usableItems[i];
          const itemRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`use_${item.id}`)
                .setLabel(`Usar ${item.name}`)
                .setStyle(ButtonStyle.Success)
                .setEmoji(item.icon)
                .setDisabled(item.lastUsed && Date.now() - item.lastUsed < item.cooldown)
            );
          
          components.push(itemRow);
        }
      }
      
      // Botão de voltar
      const navigationRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('inventory_back')
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      
      components.push(navigationRow);
    }
    
    // Enviar mensagem
    const reply = await interaction.editReply({
      embeds: [embed],
      components: components
    });
    
    // Se não há componentes interativos, não precisa de coletor
    if (components.length === 0) return;
    
    // Criar coletor para botões
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minuto
    });
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
        return;
      }
      
      const customId = i.customId;
      
      if (customId === 'inventory_back') {
        await i.deferUpdate();
        await showInventorySummary(interaction, targetUser, inventory);
        collector.stop();
        return;
      }
      
      if (customId.startsWith('use_')) {
        await i.deferUpdate();
        const itemId = customId.replace('use_', '');
        // Aqui adicionaremos a lógica para usar itens quando implementarmos o comando /usar
        await i.followUp({ 
          content: 'Esta funcionalidade será implementada com o comando `/usar`. Por favor, use esse comando para utilizar seus itens.',
          ephemeral: true 
        });
      }
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Desativar os botões após o tempo limite
        const disabledComponents = components.map(row => {
          const newRow = new ActionRowBuilder();
          row.components.forEach(component => {
            newRow.addComponents(
              ButtonBuilder.from(component).setDisabled(true)
            );
          });
          return newRow;
        });
        
        await interaction.editReply({
          components: disabledComponents
        }).catch(console.error);
      }
    });
   }