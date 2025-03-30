// loja.js
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";
import firebaseService from "../services/firebase.js";
import storeItemsService from "../services/store-items.js";
import inventoryService from "../services/inventory.js";
import embedUtils from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("loja")
  .setDescription("Abre a loja para comprar itens")
  .addStringOption((option) =>
    option
      .setName("categoria")
      .setDescription("Categoria de itens que deseja ver")
      .setRequired(false)
      .addChoices({ name: "🎰 Cassino", value: "casino" })
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    let selectedCategory = interaction.options.getString("categoria");

    // Se nenhuma categoria foi selecionada, mostrar o menu principal
    if (!selectedCategory) {
      return await showMainMenu(interaction, userId);
    }

    // Se uma categoria foi selecionada, mostrar os itens dessa categoria
    return await showCategoryItems(interaction, userId, selectedCategory);
  } catch (error) {
    console.error("Erro ao executar comando loja:", error);

    // Criar embed de erro
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
 * Mostra o menu principal da loja com as categorias
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @returns {Promise<void>}
 */
async function showMainMenu(interaction, userId) {
  // Obter saldo do usuário
  const userData = await firebaseService.getUserData(userId);
  const saldo = userData.saldo || 0;

  // Obter categorias disponíveis
  const categories = storeItemsService.getCategories();

  // Se não houver categorias, mostrar mensagem de loja vazia
  if (categories.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Loja Vazia")
      .setDescription("Não há itens disponíveis no momento.");

    return interaction.editReply({ embeds: [embed], components: [] });
  }

  // Como temos apenas a categoria de cassino, direcionar para ela automaticamente
  if (categories.length === 1 && categories[0] === "casino") {
    return await showCategoryItems(interaction, userId, "casino");
  }

  // Criar o menu de seleção de categorias
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("store_category")
      .setPlaceholder("Selecione uma categoria")
      .addOptions(
        categories.map((category) => {
          return {
            label: storeItemsService.getCategoryDisplayName(category),
            value: category,
            emoji: storeItemsService.getCategoryIcon(category),
          };
        })
      )
  );

  // Criar o embed do menu principal
  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Dourado
    .setTitle("🛒 Loja do BlackEconomy")
    .setDescription(
      `Bem-vindo à loja, ${interaction.user.username}!\nEscolha uma categoria para ver os itens disponíveis.`
    )
    .setThumbnail("https://i.imgur.com/XwrZmS0.png") // Imagem representativa da loja
    .addFields(
      { name: "💰 Seu Saldo", value: `R$${saldo.toFixed(2)}`, inline: true },
      {
        name: "📋 Categorias Disponíveis",
        value: categories
          .map(
            (cat) =>
              `${storeItemsService.getCategoryIcon(
                cat
              )} ${storeItemsService.getCategoryDisplayName(cat)}`
          )
          .join("\n"),
        inline: true,
      }
    )
    .setFooter({ text: "Use o menu abaixo para navegar." })
    .setTimestamp();

  // Enviar a mensagem com o menu
  const reply = await interaction.editReply({
    embeds: [embed],
    components: [selectRow],
  });

  // Criar coletor de interações para o menu
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000, // 1 minuto
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i.reply({
        content: "Você não pode usar este menu.",
        ephemeral: true,
      });
      return;
    }

    const selectedCategory = i.values[0];
    await i.deferUpdate();
    await showCategoryItems(interaction, userId, selectedCategory, reply);
    collector.stop();
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      // Desativar o menu após o tempo limite
      const disabledRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("store_category_disabled")
          .setPlaceholder("Menu expirado")
          .setDisabled(true)
          .addOptions([{ label: "Expirado", value: "expired" }])
      );

      await interaction
        .editReply({
          components: [disabledRow],
        })
        .catch(console.error);
    }
  });
}

/**
 * Mostra os itens de uma categoria específica
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @param {string} category - Categoria selecionada
 * @param {Message} [existingReply] - Mensagem existente para editar
 * @returns {Promise<void>}
 */
async function showCategoryItems(
  interaction,
  userId,
  category,
  existingReply = null
) {
  // Obter saldo do usuário
  const userData = await firebaseService.getUserData(userId);
  const saldo = userData.saldo || 0;

  // Obter itens da categoria
  const items = storeItemsService.getItemsByCategory(category);

  if (items.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Categoria Vazia")
      .setDescription(
        `Não há itens disponíveis na categoria ${storeItemsService.getCategoryDisplayName(
          category
        )}.`
      );

    if (existingReply) {
      await existingReply.edit({ embeds: [embed], components: [] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [] });
    }
    return;
  }

  // Criar descrição dos itens
  const itemsDescription = items
    .map((item, index) => {
      return `**${index + 1}. ${item.icon} ${item.name}**
 Preço: R${item.price.toFixed(2)}
 ${item.description}`;
    })
    .join("\n\n");

  // Criar o embed dos itens da categoria
  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Dourado
    .setTitle(
      `${storeItemsService.getCategoryIcon(
        category
      )} ${storeItemsService.getCategoryDisplayName(category)}`
    )
    .setDescription(itemsDescription)
    .addFields({
      name: "💰 Seu Saldo",
      value: `R${saldo.toFixed(2)}`,
      inline: true,
    })
    .setFooter({
      text: "Use os botões abaixo para comprar itens ou voltar ao menu.",
    })
    .setTimestamp();

  // Criar os botões de compra
  const rows = [];

  // Botões de compra (max 5 por linha, max 5 linhas)
  for (let i = 0; i < Math.min(items.length, 5); i++) {
    const itemButtons = new ActionRowBuilder();

    itemButtons.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${items[i].id}`)
        .setLabel(`Comprar ${items[i].name}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(items[i].icon)
    );

    rows.push(itemButtons);
  }

  // Linha de navegação
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("store_close")
      .setLabel("Fechar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌")
  );

  // Adicionar botão para voltar apenas se houver mais de uma categoria
  const categories = storeItemsService.getCategories();
  if (categories.length > 1) {
    navigationRow.addComponents(
      new ButtonBuilder()
        .setCustomId("store_back")
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
    );
  }

  rows.push(navigationRow);

  // Enviar ou editar a mensagem
  let reply;
  if (existingReply) {
    reply = await existingReply.edit({
      embeds: [embed],
      components: rows,
    });
  } else {
    reply = await interaction.editReply({
      embeds: [embed],
      components: rows,
    });
  }

  // Criar coletor de interações para os botões
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000, // 1 minuto
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i.reply({
        content: "Você não pode usar estes botões.",
        ephemeral: true,
      });
      return;
    }

    const customId = i.customId;

    if (customId === "store_back") {
      await i.deferUpdate();
      await showMainMenu(interaction, userId);
      collector.stop();
      return;
    }

    if (customId === "store_close") {
      const closedEmbed = new EmbedBuilder()
        .setColor(0x808080) // Cinza
        .setTitle("🛒 Loja Fechada")
        .setDescription(
          "Você fechou a loja. Use `/loja` novamente quando quiser comprar algo."
        );

      await i.update({ embeds: [closedEmbed], components: [] });
      collector.stop();
      return;
    }

    if (customId.startsWith("buy_")) {
      await i.deferUpdate();
      const itemId = customId.replace("buy_", "");
      await buyItem(interaction, userId, itemId, i);
    }
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      // Desativar os botões após o tempo limite
      const disabledRows = rows.map((row) => {
        const newRow = new ActionRowBuilder();
        row.components.forEach((component) => {
          newRow.addComponents(ButtonBuilder.from(component).setDisabled(true));
        });
        return newRow;
      });

      await interaction
        .editReply({
          components: disabledRows,
        })
        .catch(console.error);
    }
  });
}

/**
 * Processa a compra de um item
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} userId - ID do usuário
 * @param {string} itemId - ID do item
 * @param {ButtonInteraction} buttonInteraction - Interação do botão
 * @returns {Promise<void>}
 */
async function buyItem(interaction, userId, itemId, buttonInteraction) {
  try {
    // Obter detalhes do item
    const item = storeItemsService.getItemById(itemId);

    if (!item) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Item Não Encontrado",
        mensagem: "O item que você tentou comprar não existe.",
      });

      return buttonInteraction.editReply({
        embeds: [embedErro],
        components: [],
      });
    }

    // Obter saldo do usuário
    const userData = await firebaseService.getUserData(userId);
    const saldo = userData.saldo || 0;

    // Verificar se o usuário tem saldo suficiente
    if (saldo < item.price) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Saldo Insuficiente",
        mensagem: `Você tem apenas R${saldo.toFixed(
          2
        )}, mas o item custa R${item.price.toFixed(2)}.`,
      });

      await buttonInteraction.followUp({
        embeds: [embedErro],
        ephemeral: true,
      });
      return;
    }

    // Processar a compra
    // 1. Debitar o saldo
    const novoSaldo = await firebaseService.updateUserBalance(
      userId,
      -item.price
    );

    // 2. Adicionar o item ao inventário
    await inventoryService.addItem(userId, itemId);

    // 3. Exibir mensagem de confirmação
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00) // Verde
      .setTitle("✅ Compra Realizada com Sucesso!")
      .setDescription(
        `Você comprou **${item.icon} ${item.name}** por **R${item.price.toFixed(
          2
        )}**.`
      )
      .addFields({
        name: "💰 Novo Saldo",
        value: `R${novoSaldo.toFixed(2)}`,
        inline: true,
      })
      .setFooter({ text: `Comprado por ${interaction.user.username}` })
      .setTimestamp();

    await buttonInteraction.followUp({
      embeds: [embedSucesso],
      ephemeral: true,
    });

    // 4. Atualizar a loja para refletir o novo saldo
    // Recarregar a categoria atual
    await showCategoryItems(interaction, userId, item.category);
  } catch (error) {
    console.error("Erro ao processar compra:", error);

    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro na Compra",
      mensagem:
        "Ocorreu um erro ao processar sua compra. Tente novamente mais tarde.",
    });

    await buttonInteraction.followUp({ embeds: [embedErro], ephemeral: true });
  }
}
