// loja.js - Versão melhorada para trabalhar com a nova estrutura
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
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("loja")
  .setDescription("Abre a loja para comprar itens")
  .addStringOption((option) =>
    option
      .setName("categoria")
      .setDescription("Categoria de itens que deseja ver")
      .setRequired(false)
      .addChoices(
        { name: "🎰 Cassino", value: "casino" },
        { name: "🧪 Consumíveis", value: "consumiveis" },
        { name: "✨ Status VIP", value: "vip" },
        { name: "🌟 Itens Especiais", value: "especiais" }
      )
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
            description: getDescricaoCategoria(category),
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
      { name: "💰 Seu Saldo", value: formatarDinheiro(saldo), inline: true },
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
    .setFooter({ text: "Use o menu abaixo para navegar entre as categorias." })
    .setTimestamp();

  // Enviar a mensagem com o menu
  const reply = await interaction.editReply({
    embeds: [embed],
    components: [selectRow],
  });

  // Criar coletor de interações para o menu
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 180000, // 3 minutos
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
 * Retorna uma descrição curta para cada categoria
 * @param {string} category - Nome da categoria
 * @returns {string} - Descrição da categoria
 */
function getDescricaoCategoria(category) {
  const descricoes = {
    casino: "Fichas e itens para jogos de azar",
    consumiveis: "Potenciadores temporários",
    vip: "Status especial com benefícios",
    especiais: "Itens raros e poderosos",
  };

  return descricoes[category] || "Itens diversos";
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

  // Agrupar itens por tier, se disponível
  const itemsByTier = {};
  items.forEach((item) => {
    const tier = item.tier || "regular";
    if (!itemsByTier[tier]) {
      itemsByTier[tier] = [];
    }
    itemsByTier[tier].push(item);
  });

  // Ordenar tiers por importância
  const tierOrder = {
    básico: 1,
    regular: 2,
    premium: 3,
    rare: 4,
    legendary: 5,
    deluxe: 6,
    eternal: 7,
  };

  // Criar lista de itens ordenada por tier
  let formattedItems = "";

  // Processar tiers em ordem
  Object.keys(itemsByTier)
    .sort((a, b) => (tierOrder[a] || 0) - (tierOrder[b] || 0))
    .forEach((tier) => {
      // Adicionar separador de tier se houver mais de um tier
      if (Object.keys(itemsByTier).length > 1) {
        let tierTitle = tier.charAt(0).toUpperCase() + tier.slice(1);

        // Adicionar ícones para tiers
        let tierIcon = "📦";
        if (tier === "básico") tierIcon = "🔹";
        else if (tier === "premium") tierIcon = "🔶";
        else if (tier === "rare") tierIcon = "💠";
        else if (tier === "legendary") tierIcon = "🔱";
        else if (tier === "deluxe") tierIcon = "💫";
        else if (tier === "eternal") tierIcon = "✴️";

        formattedItems += `\n## ${tierIcon} ${tierTitle}\n\n`;
      }

      // Adicionar itens deste tier
      itemsByTier[tier].forEach((item, index) => {
        // Verificar se o usuário pode comprar este item
        const canAfford = saldo >= item.price;
        const priceText = canAfford
          ? formatarDinheiro(item.price)
          : `${formatarDinheiro(item.price)} (Saldo insuficiente)`;

        formattedItems += `**${index + 1}. ${item.icon} ${item.name}**\n`;
        formattedItems += `💰 Preço: ${priceText}\n`;
        formattedItems += `${item.description}\n\n`;
      });
    });

  // Criar o embed dos itens da categoria
  const embed = new EmbedBuilder()
    .setColor(storeItemsService.getCategoryColor(category))
    .setTitle(
      `${storeItemsService.getCategoryIcon(
        category
      )} ${storeItemsService.getCategoryDisplayName(category)}`
    )
    .setDescription(formattedItems)
    .addFields({
      name: "💰 Seu Saldo",
      value: formatarDinheiro(saldo),
      inline: true,
    })
    .setFooter({
      text: "Use os botões abaixo para comprar itens ou voltar ao menu.",
    })
    .setTimestamp();

  // Criar os botões de compra
  const rows = [];

  // Botões de compra (limitados a 5 por linha, máximo 3 linhas para itens)
  // Reagrupar itens em ordem plana para os botões
  const allItems = [];
  Object.values(itemsByTier).forEach((tierItems) => {
    allItems.push(...tierItems);
  });

  // Máximo de 15 botões (5 por linha, 3 linhas)
  const maxButtons = 15;
  const buttonsToCreate = Math.min(allItems.length, maxButtons);

  // Criar linhas de botões (máximo 5 botões por linha)
  for (let i = 0; i < buttonsToCreate; i += 5) {
    const itemRow = new ActionRowBuilder();

    // Adicionar até 5 botões nesta linha
    for (let j = i; j < i + 5 && j < buttonsToCreate; j++) {
      const item = allItems[j];
      const canAfford = saldo >= item.price;

      itemRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${item.id}`)
          .setLabel(`${item.name} (${formatarDinheiro(item.price)})`)
          .setStyle(canAfford ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji(item.icon)
          .setDisabled(!canAfford)
      );
    }

    if (itemRow.components.length > 0) {
      rows.push(itemRow);
    }
  }

  // Linha de navegação
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("store_close")
      .setLabel("Fechar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌")
  );

  // Adicionar botão para voltar
  navigationRow.addComponents(
    new ButtonBuilder()
      .setCustomId("store_back")
      .setLabel("Voltar às Categorias")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

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
    time: 180000, // 3 minutos
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
        mensagem: `Você tem apenas ${formatarDinheiro(
          saldo
        )}, mas o item custa ${formatarDinheiro(item.price)}.`,
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
    if (item.id.startsWith("fichas_cassino_")) {
      // Para fichas de cassino, adicionar diretamente ao inventário
      await inventoryService.addCasinoChips(userId, item.quantidade);
    } else {
      // Para outros itens
      await inventoryService.addItem(userId, itemId);
    }

    // 3. Exibir mensagem de confirmação
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00) // Verde
      .setTitle("✅ Compra Realizada com Sucesso!")
      .setDescription(
        `Você comprou **${item.icon} ${item.name}** por **${formatarDinheiro(
          item.price
        )}**.`
      )
      .addFields(
        {
          name: "💰 Novo Saldo",
          value: formatarDinheiro(novoSaldo),
          inline: true,
        },
        {
          name: "🛒 Item Adquirido",
          value: item.description,
          inline: true,
        }
      );

    // Adicionar instrução de uso se for um item usável
    if (item.usavel) {
      embedSucesso.addFields({
        name: "ℹ️ Como Usar",
        value: `Use o comando \`/usar ${item.name}\` para utilizar este item.`,
        inline: false,
      });
    }

    embedSucesso
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
