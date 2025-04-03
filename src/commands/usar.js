// usar.js - Versão totalmente reformulada com interface interativa
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import inventoryService from "../services/inventory.js";
import storeItemsService from "../services/store-items.js";
import embedUtils from "../utils/embed.js";
import { getDatabase, ref, update, get } from "firebase/database";
import { formatarTempoEspera } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("usar")
  .setDescription("Usa um item do seu inventário");

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    const userId = interaction.user.id;

    // Carregar o inventário do usuário
    const usableItems = await loadUsableItems(userId);

    // Se não tiver itens usáveis
    if (Object.keys(usableItems).length === 0) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Sem Itens Usáveis",
        mensagem:
          "Você não possui nenhum item usável em seu inventário.\nVisite a `/loja` para adquirir itens!",
      });
      return interaction.editReply({ embeds: [embedErro] });
    }

    // Mostrar a interface principal com os itens usáveis
    return await showItemsInterface(interaction, userId, usableItems);
  } catch (error) {
    console.error("Erro ao executar comando usar:", error);
    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Comando",
      mensagem:
        "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
    });
    return interaction.editReply({ embeds: [embedErro] });
  }
}

/**
 * Carrega todos os itens usáveis do inventário do usuário, agrupados por categoria
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Itens usáveis agrupados por categoria
 */
async function loadUsableItems(userId) {
  try {
    const database = getDatabase();
    const inventoryRef = ref(database, `users/${userId}/inventory/items`);
    const snapshot = await get(inventoryRef);

    if (!snapshot.exists()) {
      return {};
    }

    const inventoryItems = snapshot.val();
    const usableItems = {};

    // Agrupar itens por categoria
    for (const itemId in inventoryItems) {
      const itemData = inventoryItems[itemId];

      // Verificar se a quantidade é válida e maior que zero
      if (
        !itemData ||
        typeof itemData.quantity === "undefined" ||
        itemData.quantity <= 0
      ) {
        continue;
      }

      // Obter detalhes do item da loja
      const storeItem = storeItemsService.getItemById(itemId);

      // Se o item existe na loja e é usável
      if (storeItem && storeItem.usavel) {
        // Verificar cooldown
        let emCooldown = false;
        let tempoRestante = 0;

        if (itemData.lastUsed && storeItem.cooldown) {
          const now = Date.now();
          const timeElapsed = now - itemData.lastUsed;

          if (timeElapsed < storeItem.cooldown) {
            emCooldown = true;
            tempoRestante = storeItem.cooldown - timeElapsed;
          }
        }

        // Adicionar à categoria correspondente
        const category = storeItem.category || "outros";

        if (!usableItems[category]) {
          usableItems[category] = [];
        }

        usableItems[category].push({
          id: itemId,
          name: storeItem.name,
          icon: storeItem.icon,
          description: storeItem.description,
          quantity: itemData.quantity,
          emCooldown: emCooldown,
          tempoRestante: tempoRestante,
          tier: storeItem.tier || "regular",
        });
      }
    }

    // Ordenar itens dentro de cada categoria por tier e nome
    for (const category in usableItems) {
      usableItems[category].sort((a, b) => {
        const tierOrder = {
          básico: 1,
          regular: 2,
          premium: 3,
          rare: 4,
          legendary: 5,
          deluxe: 6,
          eternal: 7,
        };

        const tierA = tierOrder[a.tier] || 2;
        const tierB = tierOrder[b.tier] || 2;

        if (tierA !== tierB) {
          return tierA - tierB;
        }

        return a.name.localeCompare(b.name);
      });
    }

    return usableItems;
  } catch (error) {
    console.error("Erro ao carregar itens usáveis:", error);
    return {};
  }
}

/**
 * Exibe a interface principal com os itens usáveis
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @param {Object} usableItems - Itens usáveis agrupados por categoria
 * @returns {Promise<void>}
 */
async function showItemsInterface(
  interaction,
  userId,
  usableItems,
  selectedCategory = null
) {
  // Se nenhuma categoria selecionada, usar a primeira disponível
  if (!selectedCategory) {
    selectedCategory = Object.keys(usableItems)[0];
  }

  // Criar embed para mostrar os itens da categoria selecionada
  const embed = new EmbedBuilder()
    .setColor(getCategoryColor(selectedCategory))
    .setTitle(`🧰 Usar Item - ${getCategoryDisplayName(selectedCategory)}`)
    .setDescription(`Selecione um item para usar:`)
    .setFooter({ text: `Solicitado por ${interaction.user.username}` })
    .setTimestamp();

  // Adicionar itens ao embed
  const itemsInCategory = usableItems[selectedCategory] || [];

  if (itemsInCategory.length === 0) {
    embed.addFields({
      name: "Sem itens nesta categoria",
      value: "Você não possui itens usáveis nesta categoria.",
      inline: false,
    });
  } else {
    let itemList = "";

    itemsInCategory.forEach((item, index) => {
      const statusIcon = item.emCooldown ? "🕒" : "✅";
      let itemText = `**${index + 1}. ${item.icon} ${item.name}** (x${
        item.quantity
      }) ${statusIcon}\n`;
      itemText += `└ ${item.description}\n`;

      if (item.emCooldown) {
        itemText += `└ Em cooldown: ${formatarTempoEspera(
          item.tempoRestante
        )}\n`;
      }

      itemList += itemText + "\n";
    });

    embed.setDescription(`Selecione um item para usar:\n\n${itemList}`);
  }

  // Criar componentes para interação
  const components = [];

  // 1. Menu de seleção de categoria
  const categories = Object.keys(usableItems);
  if (categories.length > 0) {
    const categoryMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("usar_category")
        .setPlaceholder("Selecione uma categoria")
        .addOptions(
          categories.map((cat) => {
            return {
              label: getCategoryDisplayName(cat),
              value: cat,
              emoji: getCategoryEmoji(cat),
              default: cat === selectedCategory,
            };
          })
        )
    );

    components.push(categoryMenu);
  }

  // 2. Botões para usar os itens (máximo 5 por linha, máximo 2 linhas)
  const itemButtons = [];
  const itemsToShow = Math.min(itemsInCategory.length, 10);

  for (let i = 0; i < itemsToShow; i++) {
    const item = itemsInCategory[i];
    const buttonDisabled = item.emCooldown || item.quantity <= 0;

    itemButtons.push(
      new ButtonBuilder()
        .setCustomId(`usar_item_${item.id}`)
        .setLabel(`${i + 1}. ${item.name}`)
        .setStyle(buttonDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setEmoji(item.icon)
        .setDisabled(buttonDisabled)
    );
  }

  // Dividir os botões em linhas de no máximo 5
  for (let i = 0; i < itemButtons.length; i += 5) {
    const row = new ActionRowBuilder();
    const buttonsSlice = itemButtons.slice(i, i + 5);
    row.addComponents(buttonsSlice);
    components.push(row);
  }

  // 3. Botões de navegação
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("usar_close")
      .setLabel("Fechar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
    new ButtonBuilder()
      .setCustomId("usar_refresh")
      .setLabel("Atualizar")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄"),
    new ButtonBuilder()
      .setCustomId("usar_inventory")
      .setLabel("Ver Inventário")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎒")
  );

  components.push(navigationRow);

  // Enviar ou atualizar a mensagem
  const message = await interaction.editReply({
    embeds: [embed],
    components: components,
  });

  // Criar coletor para os botões e menus
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutos
  });

  const menuCollector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000, // 5 minutos
  });

  // Tratar interações com os botões
  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i.reply({
        content: "Você não pode usar estes controles.",
        ephemeral: true,
      });
      return;
    }

    const customId = i.customId;

    // Fechar a interface
    if (customId === "usar_close") {
      const closedEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("Interface Fechada")
        .setDescription("Você fechou a interface de uso de itens.")
        .setFooter({ text: `Fechado por ${i.user.username}` })
        .setTimestamp();

      await i.update({ embeds: [closedEmbed], components: [] });
      collector.stop();
      menuCollector.stop();
      return;
    }

    // Atualizar a interface
    if (customId === "usar_refresh") {
      await i.deferUpdate();
      const refreshedItems = await loadUsableItems(userId);
      await showItemsInterface(
        interaction,
        userId,
        refreshedItems,
        selectedCategory
      );
      collector.stop();
      menuCollector.stop();
      return;
    }

    // Ver inventário
    if (customId === "usar_inventory") {
      await i.reply({
        content: "Use o comando `/inventario` para ver todos os seus itens!",
        ephemeral: true,
      });
      return;
    }

    // Usar um item
    if (customId.startsWith("usar_item_")) {
      const itemId = customId.replace("usar_item_", "");
      await i.deferUpdate();
      await useItem(interaction, userId, itemId);
      collector.stop();
      menuCollector.stop();
      return;
    }
  });

  // Tratar interações com os menus
  menuCollector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i.reply({
        content: "Você não pode usar estes controles.",
        ephemeral: true,
      });
      return;
    }

    if (i.customId === "usar_category") {
      const newCategory = i.values[0];
      await i.deferUpdate();
      await showItemsInterface(interaction, userId, usableItems, newCategory);
      collector.stop();
      menuCollector.stop();
    }
  });

  // Finalizar os coletores ao expirar o tempo
  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      try {
        // Desativar todos os componentes
        const disabledComponents = components.map((row) => {
          const newRow = new ActionRowBuilder();
          row.components.forEach((component) => {
            if (component.type === ComponentType.Button) {
              newRow.addComponents(
                ButtonBuilder.from(component).setDisabled(true)
              );
            } else if (component.type === ComponentType.StringSelect) {
              newRow.addComponents(
                StringSelectMenuBuilder.from(component)
                  .setDisabled(true)
                  .setPlaceholder("Menu expirado")
              );
            }
          });
          return newRow;
        });

        const timeoutEmbed = EmbedBuilder.from(embed)
          .setTitle("🧰 Usar Item - Expirado")
          .setDescription(
            "A interface de uso de itens expirou. Use `/usar` novamente para reabri-la."
          );

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: disabledComponents,
        });
      } catch (error) {
        console.error("Erro ao desativar componentes:", error);
      }
    }
  });
}

/**
 * Usa o item selecionado
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @param {string} itemId - ID do item a ser usado
 * @returns {Promise<void>}
 */
async function useItem(interaction, userId, itemId) {
  try {
    // Verificar se o item existe na loja
    const item = storeItemsService.getItemById(itemId);

    if (!item) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Encontrado",
        mensagem: "O item que você tentou usar não existe.",
      });
      return interaction.editReply({ embeds: [embedErro], components: [] });
    }

    // Verificar se o item é usável
    if (!item.usavel) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Usável",
        mensagem: `${item.icon} ${item.name} não é um item que pode ser usado.`,
      });
      return interaction.editReply({ embeds: [embedErro], components: [] });
    }

    // Verificar diretamente no Firebase se o usuário possui o item
    const database = getDatabase();
    const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
    const snapshot = await get(itemRef);

    if (!snapshot.exists() || snapshot.val().quantity <= 0) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Encontrado",
        mensagem: `Você não possui ${item.icon} ${item.name} em seu inventário.`,
      });
      return interaction.editReply({ embeds: [embedErro], components: [] });
    }

    // Verificar se o item está em cooldown
    const itemData = snapshot.val();
    if (itemData.lastUsed && item.cooldown) {
      const now = Date.now();
      const timeElapsed = now - itemData.lastUsed;

      if (timeElapsed < item.cooldown) {
        const tempoRestante = item.cooldown - timeElapsed;
        const minutes = Math.floor(tempoRestante / 60000);
        const seconds = Math.floor((tempoRestante % 60000) / 1000);

        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Item em Cooldown",
          mensagem: `Você precisa esperar **${minutes}m ${seconds}s** para usar ${item.icon} ${item.name} novamente.`,
        });
        return interaction.editReply({ embeds: [embedErro], components: [] });
      }
    }

    // Usar o item (atualizar inventário e debitar o uso)
    const newQuantity = itemData.quantity - 1;
    const updates = {
      quantity: newQuantity,
      lastUsed: Date.now(),
    };

    await update(itemRef, updates);

    // Aplicar o efeito do item
    let resultMessage = await applyItemEffect(userId, item);

    // Criar embed de sucesso
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`${item.icon} Item Usado com Sucesso`)
      .setDescription(`Você usou **${item.name}**!`)
      .addFields({
        name: "📋 Efeito",
        value: resultMessage,
        inline: false,
      })
      .addFields({
        name: "🔄 Quantidade Restante",
        value: `${newQuantity}x ${item.name}`,
        inline: true,
      })
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    // Botão para voltar ao menu de itens
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("voltar_menu")
        .setLabel("Voltar ao Menu")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔙")
    );

    const message = await interaction.editReply({
      embeds: [embedSucesso],
      components: [row],
    });

    // Coletor para o botão de voltar
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: "Você não pode usar este botão.",
          ephemeral: true,
        });
        return;
      }

      if (i.customId === "voltar_menu") {
        await i.deferUpdate();
        const refreshedItems = await loadUsableItems(userId);
        if (Object.keys(refreshedItems).length > 0) {
          await showItemsInterface(interaction, userId, refreshedItems);
        } else {
          const semItensEmbed = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Sem Itens Usáveis",
            mensagem:
              "Você não possui mais itens usáveis em seu inventário.\nVisite a `/loja` para adquirir itens!",
          });
          await interaction.editReply({
            embeds: [semItensEmbed],
            components: [],
          });
        }
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && message.editable) {
        const newRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true)
        );
        await interaction.editReply({ components: [newRow] });
      }
    });
  } catch (error) {
    console.error("Erro ao usar item:", error);
    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro ao Usar Item",
      mensagem: "Ocorreu um erro ao usar o item. Tente novamente mais tarde.",
    });
    return interaction.editReply({ embeds: [embedErro], components: [] });
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
      case "reduce_cooldown": {
        // Reduz o cooldown de todos os comandos
        const userRef = ref(database, `users/${userId}/cooldowns`);
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
          return "Nenhum cooldown para reduzir.";
        }
        const cooldowns = snapshot.val();
        const now = Date.now();
        const updatedCooldowns = {};
        for (const cmd in cooldowns) {
          const lastUsed = cooldowns[cmd];
          const timeElapsed = now - lastUsed;
          updatedCooldowns[cmd] = lastUsed + timeElapsed * item.effectValue;
        }
        await update(userRef, updatedCooldowns);
        return `Reduziu o cooldown de todos os comandos em ${
          item.effectValue * 100
        }%.`;
      }
      case "reduce_cooldown_single": {
        // Reduz o cooldown de um comando específico
        // Primeiro, mostrar uma mensagem pedindo ao usuário para usar outro comando específico
        return `Use o comando /reduzir-cooldown para selecionar qual comando você deseja reduzir em ${
          item.effectValue * 100
        }%.`;
      }
      case "boost_work": {
        // Aumenta os ganhos do comando trabalhar por um período
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          boost_work: {
            multiplier: item.effectValue,
            expiration: Date.now() + item.duration,
          },
        });
        const hours = Math.floor(item.duration / 3600000);
        return `Aumentou os ganhos do comando /trabalhar em ${
          (item.effectValue - 1) * 100
        }% por ${hours} hora(s).`;
      }
      case "boost_crime": {
        // Aumenta os ganhos e a chance de sucesso do comando crime
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          boost_crime: {
            multiplier: item.effectValue,
            expiration: Date.now() + item.duration,
          },
        });
        const hours = Math.floor(item.duration / 3600000);
        return `Aumentou os ganhos e as chances de sucesso do comando /crime em ${
          (item.effectValue - 1) * 100
        }% por ${hours} hora(s).`;
      }
      case "boost_study": {
        // Aumenta pontos ganhos no próximo estudo
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          boost_study: {
            multiplier: item.effectValue,
            expiration: Date.now() + item.duration,
          },
        });
        return `Seu próximo comando /estudar renderá ${item.effectValue}x mais pontos!`;
      }
      case "boost_exam": {
        // Aumenta chances de passar no próximo exame
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          boost_exam: {
            bonus: item.effectValue,
            expiration: Date.now() + item.duration,
          },
        });
        return `Suas chances de passar no próximo exame aumentaram em ${
          item.effectValue * 100
        }%!`;
      }
      case "vip_status": {
        // Aplica o status VIP
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          vip_status: {
            cooldownReduction: item.effectValue.cooldownReduction,
            incomeBoost: item.effectValue.incomeBoost,
            expiration: Date.now() + item.duration,
          },
        });
        const days = Math.floor(item.duration / 86400000);
        return `Status VIP ativado por ${days} dia(s): redução de cooldowns em ${
          item.effectValue.cooldownReduction * 100
        }% e aumento de ganhos em ${item.effectValue.incomeBoost * 100}%.`;
      }
      case "vip_permanent": {
        // Aplica status VIP permanente
        const userRef = ref(database, `users/${userId}/activeEffects`);
        await update(userRef, {
          vip_permanent: {
            cooldownReduction: item.effectValue.cooldownReduction,
            incomeBoost: item.effectValue.incomeBoost,
            activated: Date.now(),
          },
        });
        return `Status VIP PERMANENTE ativado: redução de cooldowns em ${
          item.effectValue.cooldownReduction * 100
        }% e aumento de ganhos em ${item.effectValue.incomeBoost * 100}%.`;
      }
      case "reset_morality": {
        // Redefine a reputação moral para neutro
        const userRef = ref(database, `users/${userId}/reputation`);
        await update(userRef, { moral: 0 });
        return "Sua reputação moral foi redefinida para neutro (0).";
      }
      case "skip_education_level": {
        // Pular um nível educacional
        const userRef = ref(database, `users/${userId}/education`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
          return "Não foi possível avançar seu nível educacional.";
        }

        const education = snapshot.val();
        const currentLevel = education.currentLevel || "fundamental";

        // Determinar próximo nível
        let nextLevel;
        switch (currentLevel) {
          case "fundamental":
            nextLevel = "medio";
            break;
          case "medio":
            nextLevel = "superior";
            break;
          case "superior":
            nextLevel = "pos";
            break;
          case "pos":
            return "Você já alcançou o nível máximo de educação.";
          default:
            nextLevel = "medio";
        }

        // Atualizar nível educacional
        const completedLevels = education.completedLevels || {};
        completedLevels[currentLevel] = Date.now();

        await update(userRef, {
          currentLevel: nextLevel,
          currentPoints: 0,
          completedLevels: completedLevels,
        });

        return `Você avançou do nível educacional ${currentLevel} para ${nextLevel}!`;
      }
      case "reset_all_cooldowns": {
        // Reseta todos os cooldowns
        const userRef = ref(database, `users/${userId}/cooldowns`);
        await update(userRef, null);
        return "Todos os cooldowns foram removidos! Você pode usar todos os comandos imediatamente.";
      }
      case "double_income_lose_rep": {
        // Dobra ganhos mas perde reputação
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
          return "Não foi possível aplicar o efeito.";
        }

        // Ativar o boost de ganhos
        await update(ref(database, `users/${userId}/activeEffects`), {
          income_boost: {
            multiplier: item.effectValue,
            expiration: Date.now() + item.duration,
          },
        });

        // Reduzir a reputação
        const userData = snapshot.val();
        const currentRep =
          (userData.reputation && userData.reputation.moral) || 0;
        await update(ref(database, `users/${userId}/reputation`), {
          moral: currentRep > 0 ? 0 : currentRep - 50, // Se positiva, zera. Se negativa, reduz mais
        });
        const hours = Math.floor(item.duration / 3600000);
        return `Pacto mágico ativado! Seus ganhos estão dobrados por ${hours} hora(s), mas sua reputação foi severamente afetada.`;
      }
      default:
        return "Este item não tem efeito definido.";
    }
  } catch (error) {
    console.error("Erro ao aplicar efeito do item:", error);
    return "Erro ao aplicar o efeito do item.";
  }
}

/**
 * Obtém a cor associada a uma categoria
 * @param {string} category - Nome da categoria
 * @returns {number} - Código de cor hexadecimal
 */
function getCategoryColor(category) {
  const colors = {
    casino: 0xffd700, // Dourado
    consumiveis: 0x9966cc, // Roxo
    vip: 0x4169e1, // Azul real
    especiais: 0xff4500, // Laranja avermelhado
    outros: 0x808080, // Cinza
  };

  return colors[category] || 0x0099ff;
}

/**
 * Obtém o nome de exibição de uma categoria
 * @param {string} category - Nome da categoria
 * @returns {string} - Nome de exibição
 */
function getCategoryDisplayName(category) {
  const displayNames = {
    casino: "🎰 Cassino",
    consumiveis: "🧪 Consumíveis",
    vip: "✨ Status VIP",
    especiais: "🌟 Itens Especiais",
    outros: "📦 Outros Itens",
  };

  return displayNames[category] || category;
}

/**
 * Obtém o emoji associado a uma categoria
 * @param {string} category - Nome da categoria
 * @returns {string} - Emoji
 */
function getCategoryEmoji(category) {
  const emojis = {
    casino: "🎰",
    consumiveis: "🧪",
    vip: "✨",
    especiais: "🌟",
    outros: "📦",
  };

  return emojis[category] || "📦";
}
