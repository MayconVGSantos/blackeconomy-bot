// usar.js - Versão completamente corrigida
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import inventoryService from "../services/inventory.js";
import storeItemsService from "../services/store-items.js";
import embedUtils from "../utils/embed.js";
import firebaseService from "../services/firebase.js";
import { getDatabase, ref, update, get } from "firebase/database";

export const data = new SlashCommandBuilder()
  .setName("usar")
  .setDescription("Usa um item do seu inventário")
  .addStringOption((option) =>
    option
      .setName("item")
      .setDescription("Item que você deseja usar")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  await interactionHandler(interaction);
}

// Função para autocompletar os itens - completamente revisada
export async function autocomplete(interaction) {
  const userId = interaction.user.id;
  const focusedValue = interaction.options.getFocused().toLowerCase();

  try {
    // Obter inventário diretamente do Firebase para garantir dados atualizados
    const database = getDatabase();
    const inventoryRef = ref(database, `users/${userId}/inventory/items`);
    const snapshot = await get(inventoryRef);

    if (!snapshot.exists()) {
      console.log("Sem itens no inventário");
      return interaction.respond([
        {
          name: "Você não possui itens no inventário",
          value: "no_items",
        },
      ]);
    }

    const inventoryItems = snapshot.val();
    console.log("Itens encontrados no inventário:", inventoryItems);

    // Filtrar itens usáveis com quantidade > 0
    const usableItems = [];

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

      console.log(
        `Verificando item ${itemId}, quantidade: ${itemData.quantity}`
      );

      // Obter detalhes do item da loja
      const storeItem = storeItemsService.getItemById(itemId);

      // Se o item existe na loja e é usável, adicionar à lista
      if (storeItem && storeItem.usavel) {
        usableItems.push({
          name: `${storeItem.icon} ${storeItem.name} (${itemData.quantity}x)`,
          value: itemId,
        });
        console.log(`Item usável adicionado: ${storeItem.name}`);
      }
    }

    console.log(`Total de itens usáveis encontrados: ${usableItems.length}`);

    // Se não houver itens usáveis
    if (usableItems.length === 0) {
      return interaction.respond([
        {
          name: "Você não possui itens usáveis no inventário",
          value: "no_usable_items",
        },
      ]);
    }

    // Filtrar os itens com base no texto digitado pelo usuário
    const filteredItems = usableItems.filter((item) =>
      item.name.toLowerCase().includes(focusedValue)
    );

    console.log(
      `Itens filtrados por "${focusedValue}": ${filteredItems.length}`
    );

    // Limitar os resultados e responder
    const responseItems = filteredItems.slice(0, 25);
    await interaction.respond(
      responseItems.length > 0
        ? responseItems
        : [
            {
              name: "Nenhum item corresponde à sua busca",
              value: "no_match",
            },
          ]
    );
  } catch (error) {
    console.error("Erro ao buscar itens para autocomplete:", error);
    await interaction.respond([
      {
        name: "Erro ao carregar seus itens",
        value: "error",
      },
    ]);
  }
}

async function interactionHandler(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const itemId = interaction.options.getString("item");

    console.log(`Tentando usar item: ${itemId}`);

    // Tratar casos especiais
    if (
      itemId === "no_items" ||
      itemId === "no_usable_items" ||
      itemId === "no_match" ||
      itemId === "error"
    ) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Sem Itens Disponíveis",
        mensagem: "Você não possui itens usáveis em seu inventário.",
      });
      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o item existe na loja diretamente
    const item = storeItemsService.getItemById(itemId);
    console.log("Detalhes do item:", item);

    if (!item) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Encontrado",
        mensagem: "O item que você tentou usar não existe.",
      });
      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o item é usável
    if (!item.usavel) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Usável",
        mensagem: `${item.icon} ${item.name} não é um item que pode ser usado.`,
      });
      return interaction.editReply({ embeds: [embedErro] });
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
      return interaction.editReply({ embeds: [embedErro] });
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
        return interaction.editReply({ embeds: [embedErro] });
      }
    }

    // Usar o item (atualizar inventário e debitar o uso)
    // Atualizar diretamente no Firebase
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
      .addFields({ name: "📋 Efeito", value: resultMessage, inline: false })
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embedSucesso] });
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
 * Aplica o efeito do item usado e retorna uma mensagem descritiva.
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
    throw error;
  }
}
