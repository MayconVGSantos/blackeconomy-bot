// usar.js - Implementação robusta sem autocomplete
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase, ref, get, update } from "firebase/database";
import embedUtils from "../utils/embed.js";
import storeItemsService from "../services/store-items.js";

export const data = new SlashCommandBuilder()
  .setName("usar")
  .setDescription("Usa um item do seu inventário")
  .addStringOption((option) =>
    option
      .setName("item")
      .setDescription(
        "Nome do item que você deseja usar (deixe em branco para ver todos)"
      )
      .setRequired(false)
  );

export async function execute(interaction) {
  // Flag para rastrear se a interação já foi respondida
  let replied = false;

  try {
    // Primeiro, defira a resposta para evitar timeout
    try {
      await interaction.deferReply();
      replied = true;
    } catch (deferError) {
      console.error("Erro ao deferir resposta:", deferError);
      // Se não conseguir deferir, pode ser que a interação já tenha expirado
      return;
    }

    const userId = interaction.user.id;
    const itemName = interaction.options.getString("item")?.toLowerCase();

    // Se nenhum item foi especificado, mostrar todos os itens usáveis
    if (!itemName) {
      await showUsableItems(interaction, userId);
      return;
    }

    // Caso contrário, encontrar o item pelo nome
    await useItemByName(interaction, userId, itemName);
  } catch (error) {
    console.error("Erro ao executar comando usar:", error);

    // Só tentar responder se ainda não respondeu
    if (replied) {
      try {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Erro no Comando",
          mensagem:
            "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
        });

        await interaction.editReply({ embeds: [embedErro] });
      } catch (responseError) {
        console.error("Erro ao enviar mensagem de erro:", responseError);
      }
    }
  }
}

/**
 * Mostra todos os itens usáveis do inventário
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 */
async function showUsableItems(interaction, userId) {
  try {
    // Obter inventário do usuário
    const database = getDatabase();
    const inventoryRef = ref(database, `users/${userId}/inventory/items`);
    const snapshot = await get(inventoryRef);

    if (!snapshot.exists()) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Inventário Vazio",
        mensagem:
          "Você não possui nenhum item em seu inventário.\nVisite a `/loja` para adquirir itens!",
      });

      return await interaction.editReply({ embeds: [embedErro] });
    }

    // Encontrar todos os itens usáveis
    const inventoryItems = snapshot.val();
    const usableItems = [];

    for (const itemId in inventoryItems) {
      const itemData = inventoryItems[itemId];

      // Pular itens com quantidade zero
      if (
        !itemData ||
        typeof itemData.quantity === "undefined" ||
        itemData.quantity <= 0
      ) {
        continue;
      }

      // Obter detalhes do item
      const storeItem = storeItemsService.getItemById(itemId);

      // Adicionar apenas itens usáveis
      if (storeItem && storeItem.usavel) {
        // Verificar se está em cooldown
        let cooldownInfo = "";

        if (itemData.lastUsed && storeItem.cooldown) {
          const now = Date.now();
          const timeElapsed = now - itemData.lastUsed;

          if (timeElapsed < storeItem.cooldown) {
            const minutes = Math.floor(
              (storeItem.cooldown - timeElapsed) / 60000
            );
            const seconds = Math.floor(
              ((storeItem.cooldown - timeElapsed) % 60000) / 1000
            );
            cooldownInfo = ` (⏳ Cooldown: ${minutes}m ${seconds}s)`;
          }
        }

        usableItems.push({
          id: itemId,
          name: storeItem.name,
          icon: storeItem.icon,
          description: storeItem.description,
          quantity: itemData.quantity,
          cooldownInfo: cooldownInfo,
          category: storeItem.category || "outros",
        });
      }
    }

    // Se não houver itens usáveis
    if (usableItems.length === 0) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Sem Itens Usáveis",
        mensagem:
          "Você não possui itens usáveis em seu inventário.\nVisite a `/loja` para adquirir itens!",
      });

      return await interaction.editReply({ embeds: [embedErro] });
    }

    // Agrupar itens por categoria
    const categorias = {};
    usableItems.forEach((item) => {
      if (!categorias[item.category]) {
        categorias[item.category] = [];
      }
      categorias[item.category].push(item);
    });

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("🧰 Itens Usáveis")
      .setDescription(
        `Para usar um item, digite:\n\`/usar [nome do item]\`\n\nPor exemplo: \`/usar ${usableItems[0].name}\``
      )
      .setFooter({
        text: `Solicitado por ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    // Adicionar categorias ao embed
    for (const categoria in categorias) {
      const itensCategoria = categorias[categoria];
      const categoriaNome = getCategoryDisplayName(categoria);

      let textoItens = "";
      itensCategoria.forEach((item) => {
        textoItens += `${item.icon} **${item.name}** (x${item.quantity})${item.cooldownInfo}\n`;
        textoItens += `└ ${item.description}\n\n`;
      });

      embed.addFields({
        name: categoriaNome,
        value: textoItens || "Nenhum item nesta categoria",
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao mostrar itens usáveis:", error);
    throw error;
  }
}

/**
 * Usa um item baseado no nome
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @param {string} itemName - Nome do item (ou parte dele)
 */
async function useItemByName(interaction, userId, itemName) {
  try {
    // Obter inventário do usuário
    const database = getDatabase();
    const inventoryRef = ref(database, `users/${userId}/inventory/items`);
    const snapshot = await get(inventoryRef);

    if (!snapshot.exists()) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Inventário Vazio",
        mensagem: "Você não possui nenhum item em seu inventário.",
      });

      return await interaction.editReply({ embeds: [embedErro] });
    }

    // Encontrar o item pelo nome
    const inventoryItems = snapshot.val();
    let foundItem = null;
    let foundItemId = null;
    let foundItemData = null;

    // Primeiro, verificar correspondência exata
    for (const itemId in inventoryItems) {
      const itemData = inventoryItems[itemId];

      // Pular itens com quantidade zero
      if (
        !itemData ||
        typeof itemData.quantity === "undefined" ||
        itemData.quantity <= 0
      ) {
        continue;
      }

      // Obter detalhes do item
      const storeItem = storeItemsService.getItemById(itemId);

      if (
        storeItem &&
        storeItem.usavel &&
        storeItem.name.toLowerCase() === itemName
      ) {
        foundItem = storeItem;
        foundItemId = itemId;
        foundItemData = itemData;
        break;
      }
    }

    // Se não encontrou correspondência exata, procurar por correspondência parcial
    if (!foundItem) {
      for (const itemId in inventoryItems) {
        const itemData = inventoryItems[itemId];

        // Pular itens com quantidade zero
        if (
          !itemData ||
          typeof itemData.quantity === "undefined" ||
          itemData.quantity <= 0
        ) {
          continue;
        }

        // Obter detalhes do item
        const storeItem = storeItemsService.getItemById(itemId);

        if (
          storeItem &&
          storeItem.usavel &&
          storeItem.name.toLowerCase().includes(itemName)
        ) {
          foundItem = storeItem;
          foundItemId = itemId;
          foundItemData = itemData;
          break;
        }
      }
    }

    // Se não encontrou nenhum item
    if (!foundItem) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Encontrado",
        mensagem: `Não foi possível encontrar o item "${itemName}" em seu inventário.`,
      });

      return await interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o item está em cooldown
    if (foundItemData.lastUsed && foundItem.cooldown) {
      const now = Date.now();
      const timeElapsed = now - foundItemData.lastUsed;

      if (timeElapsed < foundItem.cooldown) {
        const minutes = Math.floor((foundItem.cooldown - timeElapsed) / 60000);
        const seconds = Math.floor(
          ((foundItem.cooldown - timeElapsed) % 60000) / 1000
        );

        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Item em Cooldown",
          mensagem: `Você precisa esperar **${minutes}m ${seconds}s** para usar ${foundItem.icon} ${foundItem.name} novamente.`,
        });

        return await interaction.editReply({ embeds: [embedErro] });
      }
    }

    // Usar o item
    const itemRef = ref(
      database,
      `users/${userId}/inventory/items/${foundItemId}`
    );
    const newQuantity = foundItemData.quantity - 1;

    await update(itemRef, {
      quantity: newQuantity,
      lastUsed: Date.now(),
    });

    // Aplicar o efeito do item
    const resultMessage = await applyItemEffect(userId, foundItem);

    // Criar embed de sucesso
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`${foundItem.icon} Item Usado com Sucesso`)
      .setDescription(`Você usou **${foundItem.name}**!`)
      .addFields({
        name: "📋 Efeito",
        value: resultMessage,
        inline: false,
      })
      .addFields({
        name: "🔄 Quantidade Restante",
        value: `${newQuantity}x ${foundItem.name}`,
        inline: true,
      })
      .setFooter({
        text: `Solicitado por ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embedSucesso] });
  } catch (error) {
    console.error("Erro ao usar item por nome:", error);
    throw error;
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
