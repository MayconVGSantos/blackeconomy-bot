// marketplace.js - Sistema de mercado entre jogadores
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import firebaseService from "../services/firebase.js";
import inventoryService from "../services/inventory.js";
import storeItemsService from "../services/store-items.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("marketplace")
  .setDescription(
    "Sistema de mercado para comprar e vender itens entre jogadores"
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("listar")
      .setDescription("Lista um item do seu inventário para venda")
      .addStringOption((option) =>
        option
          .setName("item")
          .setDescription("Item que você deseja vender")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("preco")
          .setDescription("Preço de venda do item")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName("descricao")
          .setDescription("Descrição opcional para o anúncio")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ver")
      .setDescription("Navega pelo marketplace para ver itens à venda")
      .addStringOption((option) =>
        option
          .setName("categoria")
          .setDescription("Categoria de itens para filtrar")
          .setRequired(false)
          .addChoices(
            { name: "🎰 Cassino", value: "casino" },
            { name: "🧪 Consumíveis", value: "consumiveis" },
            { name: "✨ Status VIP", value: "vip" },
            { name: "🌟 Itens Especiais", value: "especiais" },
            { name: "🔍 Todos", value: "all" }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("comprar")
      .setDescription("Compra um item listado no marketplace")
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("ID da listagem que você deseja comprar")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("minhas")
      .setDescription("Veja suas listagens ativas no marketplace")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("cancelar")
      .setDescription("Cancela uma de suas listagens no marketplace")
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("ID da listagem que você deseja cancelar")
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

// Para autocomplete das opções
export async function autocomplete(interaction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    const userId = interaction.user.id;

    // Para autocomplete de itens ao listar
    if (
      focusedOption.name === "item" &&
      interaction.options.getSubcommand() === "listar"
    ) {
      const inventory = await inventoryService.getUserInventory(userId);
      const userItems = [];

      // Se o usuário tem itens em seu inventário
      if (inventory && inventory.items) {
        for (const itemId in inventory.items) {
          const itemData = inventory.items[itemId];
          // Verifique se o usuário tem quantidade maior que 0
          if (itemData.quantity > 0) {
            // Obtenha detalhes do item
            const itemDetails = storeItemsService.getItemById(itemId);
            if (itemDetails) {
              userItems.push({
                name: `${itemDetails.icon} ${itemDetails.name} (x${itemData.quantity})`,
                value: itemId,
              });
            }
          }
        }
      }

      // Filtrar por termo de busca
      const filtered = userItems.filter((item) =>
        item.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );

      await interaction.respond(filtered.slice(0, 25));
    }

    // Para autocomplete de IDs ao comprar
    else if (
      focusedOption.name === "id" &&
      interaction.options.getSubcommand() === "comprar"
    ) {
      const listings = await getActiveListings("all");

      // Filtrar listagens que não são do próprio usuário
      const buyableListings = listings.filter(
        (listing) => listing.sellerId !== userId
      );

      const options = buyableListings.map((listing) => ({
        name: `${listing.icon} ${listing.name} - ${formatarDinheiro(
          listing.price
        )} (Vendedor: ${listing.sellerName})`,
        value: listing.id,
      }));

      const filtered = options.filter((option) =>
        option.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );

      await interaction.respond(filtered.slice(0, 25));
    }

    // Para autocomplete de IDs ao cancelar
    else if (
      focusedOption.name === "id" &&
      interaction.options.getSubcommand() === "cancelar"
    ) {
      const listings = await getUserListings(userId);

      const options = listings.map((listing) => ({
        name: `${listing.icon} ${listing.name} - ${formatarDinheiro(
          listing.price
        )}`,
        value: listing.id,
      }));

      const filtered = options.filter((option) =>
        option.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );

      await interaction.respond(filtered.slice(0, 25));
    }
  } catch (error) {
    console.error("Erro no autocomplete do marketplace:", error);
    await interaction.respond([]);
  }
}

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "listar":
        await handleListItem(interaction);
        break;
      case "ver":
        await handleViewMarketplace(interaction);
        break;
      case "comprar":
        await handleBuyItem(interaction);
        break;
      case "minhas":
        await handleViewMyListings(interaction);
        break;
      case "cancelar":
        await handleCancelListing(interaction);
        break;
      default:
        await interaction.editReply("Subcomando desconhecido.");
    }
  } catch (error) {
    console.error("Erro ao executar comando marketplace:", error);

    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Marketplace",
      mensagem:
        "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
    });

    await interaction.editReply({ embeds: [embedErro] });
  }
}

/**
 * Manipula o subcomando para listar um item para venda
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleListItem(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const itemId = interaction.options.getString("item");
  const price = interaction.options.getInteger("preco");
  const description = interaction.options.getString("descricao") || "";

  // Verificar se o item existe no inventário do usuário
  const hasItem = await inventoryService.hasItem(userId, itemId);

  if (!hasItem) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Item Não Encontrado",
      mensagem: "Você não possui este item em seu inventário.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Obter detalhes do item
  const itemDetails = storeItemsService.getItemById(itemId);

  if (!itemDetails) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Item Desconhecido",
      mensagem: "Este item não pode ser vendido no marketplace.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Verificar o preço mínimo (pelo menos 50% do preço original)
  const minPrice = Math.floor(itemDetails.price * 0.5);

  if (price < minPrice) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Preço Muito Baixo",
      mensagem: `O preço mínimo para este item é ${formatarDinheiro(
        minPrice
      )} (50% do valor original).`,
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Verificar a taxa de listagem (5% do preço de venda)
  const listingFee = Math.floor(price * 0.05);

  // Verificar se o usuário tem saldo para pagar a taxa
  const userData = await firebaseService.getUserData(userId);
  const saldo = userData.saldo || 0;

  if (saldo < listingFee) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Saldo Insuficiente",
      mensagem: `Você precisa de ${formatarDinheiro(
        listingFee
      )} para pagar a taxa de listagem (5% do preço de venda).`,
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Remover o item do inventário
  const removed = await inventoryService.removeItem(userId, itemId, 1);

  if (!removed) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Erro ao Remover Item",
      mensagem: "Não foi possível remover o item do seu inventário.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Cobrar a taxa de listagem
  const newBalance = await firebaseService.updateUserBalance(
    userId,
    -listingFee
  );

  // Gerar ID único para a listagem
  const listingId = generateListingId();

  // Salvar a listagem no banco de dados
  await createListing({
    id: listingId,
    itemId: itemId,
    sellerId: userId,
    sellerName: username,
    price: price,
    description: description,
    listingDate: Date.now(),
    name: itemDetails.name,
    icon: itemDetails.icon,
    category: itemDetails.category,
  });

  // Criar embed de confirmação
  const embedSucesso = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Item Listado com Sucesso")
    .setDescription(
      `Você listou **${itemDetails.icon} ${itemDetails.name}** para venda no marketplace.`
    )
    .addFields(
      {
        name: "💰 Preço de Venda",
        value: formatarDinheiro(price),
        inline: true,
      },
      {
        name: "💸 Taxa de Listagem (5%)",
        value: formatarDinheiro(listingFee),
        inline: true,
      },
      {
        name: "💵 Seu Saldo Atual",
        value: formatarDinheiro(newBalance),
        inline: true,
      },
      {
        name: "🔖 ID da Listagem",
        value: listingId,
        inline: false,
      }
    )
    .setFooter({
      text: "Os itens listados permanecem no marketplace até serem comprados ou cancelados.",
    })
    .setTimestamp();

  if (description) {
    embedSucesso.addFields({
      name: "📝 Descrição",
      value: description,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embedSucesso] });
}

/**
 * Manipula o subcomando para ver o marketplace
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleViewMarketplace(interaction) {
  const userId = interaction.user.id;
  const category = interaction.options.getString("categoria") || "all";

  // Obter listagens ativas filtradas por categoria
  const listings = await getActiveListings(category);

  // Se não houver listagens
  if (listings.length === 0) {
    const embedVazio = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle("🏪 Marketplace Vazio")
      .setDescription(
        category === "all"
          ? "Não há itens listados no marketplace no momento."
          : `Não há itens da categoria ${storeItemsService.getCategoryDisplayName(
              category
            )} listados no momento.`
      )
      .setFooter({ text: "Use /marketplace listar para vender seus itens!" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embedVazio] });
  }

  // Obter saldo do usuário
  const userData = await firebaseService.getUserData(userId);
  const saldo = userData.saldo || 0;

  // Agrupar por categoria para exibição
  const listingsByCategory = {};

  listings.forEach((listing) => {
    if (!listingsByCategory[listing.category]) {
      listingsByCategory[listing.category] = [];
    }
    listingsByCategory[listing.category].push(listing);
  });

  // Criar páginas para navegar (máximo 10 itens por página)
  const itemsPerPage = 10;
  const pages = [];
  let currentPage = [];
  let currentCount = 0;

  // Para cada categoria
  Object.keys(listingsByCategory).forEach((cat) => {
    // Skip se estamos filtrando por categoria e esta não é a categoria escolhida
    if (category !== "all" && cat !== category) return;

    listingsByCategory[cat].forEach((item) => {
      currentPage.push(item);
      currentCount++;

      if (currentCount === itemsPerPage) {
        pages.push([...currentPage]);
        currentPage = [];
        currentCount = 0;
      }
    });
  });

  // Adicionar página final se houver itens
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Estado da paginação
  let currentPageIndex = 0;

  // Função para criar o embed da página atual
  const createPageEmbed = (pageIndex) => {
    const page = pages[pageIndex];
    const embed = new EmbedBuilder()
      .setColor(0x4169e1)
      .setTitle("🏪 BlackEconomy Marketplace")
      .setDescription(
        `Navegue pelos itens listados por outros jogadores.\nSeu saldo atual: ${formatarDinheiro(
          saldo
        )}`
      )
      .setFooter({
        text: `Página ${pageIndex + 1} de ${pages.length} • Total: ${
          listings.length
        } itens`,
      })
      .setTimestamp();

    // Adicionar cada item da página ao embed
    let listedItems = "";

    page.forEach((listing) => {
      // Verificar se o usuário tem saldo para comprar
      const canAfford = saldo >= listing.price;
      const priceText = canAfford
        ? formatarDinheiro(listing.price)
        : `${formatarDinheiro(listing.price)} (Saldo insuficiente)`;

      // Formatação de cada item
      listedItems += `**${listing.icon} ${listing.name}** (ID: \`${listing.id}\`)\n`;
      listedItems += `💰 Preço: ${priceText}\n`;
      listedItems += `👤 Vendedor: ${listing.sellerName}\n`;

      if (listing.description) {
        listedItems += `📝 Nota: ${listing.description}\n`;
      }

      listedItems += `📅 Listado em: ${new Date(
        listing.listingDate
      ).toLocaleString("pt-BR")}\n\n`;
    });

    embed.addFields({
      name: "📦 Itens à Venda",
      value: listedItems || "Nenhum item encontrado.",
      inline: false,
    });

    return embed;
  };

  // Criar botões de navegação
  const createNavigationRow = (pageIndex) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
        .setDisabled(pageIndex === 0),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("Próxima")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("➡️")
        .setDisabled(pageIndex === pages.length - 1),
      new ButtonBuilder()
        .setCustomId("refresh_page")
        .setLabel("Atualizar")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄")
    );
  };

  // Criar botões de ação
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buy_item")
      .setLabel("Comprar Item")
      .setStyle(ButtonStyle.Success)
      .setEmoji("💰"),
    new ButtonBuilder()
      .setCustomId("list_item")
      .setLabel("Vender Item")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📦"),
    new ButtonBuilder()
      .setCustomId("my_listings")
      .setLabel("Minhas Listagens")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📋")
  );

  // Dropdown para filtrar por categoria
  const filterRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("filter_category")
      .setPlaceholder("Filtrar por categoria...")
      .addOptions([
        {
          label: "Todos os Itens",
          value: "all",
          description: "Ver todas as categorias",
          emoji: "🔍",
          default: category === "all",
        },
        {
          label: "Cassino",
          value: "casino",
          description: "Fichas e itens para jogos de azar",
          emoji: "🎰",
          default: category === "casino",
        },
        {
          label: "Consumíveis",
          value: "consumiveis",
          description: "Potenciadores temporários",
          emoji: "🧪",
          default: category === "consumiveis",
        },
        {
          label: "Status VIP",
          value: "vip",
          description: "Status especial com benefícios",
          emoji: "✨",
          default: category === "vip",
        },
        {
          label: "Itens Especiais",
          value: "especiais",
          description: "Itens raros e poderosos",
          emoji: "🌟",
          default: category === "especiais",
        },
      ])
  );

  // Enviar mensagem inicial
  const initialEmbed = createPageEmbed(currentPageIndex);
  const navigationRow = createNavigationRow(currentPageIndex);

  const reply = await interaction.editReply({
    embeds: [initialEmbed],
    components: [navigationRow, actionRow, filterRow],
  });

  // Coletor para eventos de botão e menu
  const collector = reply.createMessageComponentCollector({
    time: 300000, // 5 minutos
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i.reply({
        content: "Você não pode usar estes controles.",
        ephemeral: true,
      });
      return;
    }

    // Eventos de botão de navegação
    if (i.isButton()) {
      await i.deferUpdate();

      if (i.customId === "prev_page" && currentPageIndex > 0) {
        currentPageIndex--;
        await i.editReply({
          embeds: [createPageEmbed(currentPageIndex)],
          components: [
            createNavigationRow(currentPageIndex),
            actionRow,
            filterRow,
          ],
        });
      } else if (
        i.customId === "next_page" &&
        currentPageIndex < pages.length - 1
      ) {
        currentPageIndex++;
        await i.editReply({
          embeds: [createPageEmbed(currentPageIndex)],
          components: [
            createNavigationRow(currentPageIndex),
            actionRow,
            filterRow,
          ],
        });
      } else if (i.customId === "refresh_page") {
        // Atualizar listagens e reconstruir páginas
        const refreshedListings = await getActiveListings(category);

        if (refreshedListings.length === 0) {
          const embedVazio = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle("🏪 Marketplace Vazio")
            .setDescription("Não há itens listados no marketplace no momento.")
            .setFooter({
              text: "Use /marketplace listar para vender seus itens!",
            })
            .setTimestamp();

          await i.editReply({
            embeds: [embedVazio],
            components: [actionRow],
          });
          return;
        }

        // Reconstruir as páginas
        const refreshedPages = [];
        let refreshPage = [];
        let refreshCount = 0;

        // Agrupar por categoria
        const refreshedByCategory = {};
        refreshedListings.forEach((listing) => {
          if (!refreshedByCategory[listing.category]) {
            refreshedByCategory[listing.category] = [];
          }
          refreshedByCategory[listing.category].push(listing);
        });

        // Reconstroer páginas
        Object.keys(refreshedByCategory).forEach((cat) => {
          if (category !== "all" && cat !== category) return;

          refreshedByCategory[cat].forEach((item) => {
            refreshPage.push(item);
            refreshCount++;

            if (refreshCount === itemsPerPage) {
              refreshedPages.push([...refreshPage]);
              refreshPage = [];
              refreshCount = 0;
            }
          });
        });

        if (refreshPage.length > 0) {
          refreshedPages.push(refreshPage);
        }

        // Atualizar variáveis
        pages.length = 0;
        pages.push(...refreshedPages);
        currentPageIndex = Math.min(currentPageIndex, pages.length - 1);

        // Atualizar embed
        await i.editReply({
          embeds: [createPageEmbed(currentPageIndex)],
          components: [
            createNavigationRow(currentPageIndex),
            actionRow,
            filterRow,
          ],
        });
      } else if (i.customId === "buy_item") {
        // Redirecionar para o comando de compra
        await i.followUp({
          content:
            "Para comprar um item, use o comando `/marketplace comprar` seguido do ID da listagem.",
          ephemeral: true,
        });
      } else if (i.customId === "list_item") {
        // Redirecionar para o comando de listagem
        await i.followUp({
          content:
            "Para vender um item, use o comando `/marketplace listar` seguido do item e preço.",
          ephemeral: true,
        });
      } else if (i.customId === "my_listings") {
        // Redirecionar para minhas listagens
        const newInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => "minhas",
            getString: () => null,
            getInteger: () => null,
          },
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
        };

        await handleViewMyListings(newInteraction);
        collector.stop();
      }
    }
    // Evento de seleção de categoria
    else if (i.isStringSelectMenu() && i.customId === "filter_category") {
      await i.deferUpdate();

      // Atualizar com nova categoria
      const newCategory = i.values[0];
      const newInteraction = {
        ...interaction,
        options: {
          getSubcommand: () => "ver",
          getString: (name) => (name === "categoria" ? newCategory : null),
        },
        deferReply: async () => {},
        editReply: i.editReply.bind(i),
      };

      await handleViewMarketplace(newInteraction);
      collector.stop();
    }
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      // Desabilitar os componentes após o tempo limite
      const disabledNavigationRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(navigationRow.components[0]).setDisabled(true),
        ButtonBuilder.from(navigationRow.components[1]).setDisabled(true),
        ButtonBuilder.from(navigationRow.components[2]).setDisabled(true)
      );

      const disabledActionRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(actionRow.components[0]).setDisabled(true),
        ButtonBuilder.from(actionRow.components[1]).setDisabled(true),
        ButtonBuilder.from(actionRow.components[2]).setDisabled(true)
      );

      const disabledFilterRow = new ActionRowBuilder().addComponents(
        StringSelectMenuBuilder.from(filterRow.components[0])
          .setDisabled(true)
          .setPlaceholder("Menu expirado")
      );

      await interaction
        .editReply({
          components: [
            disabledNavigationRow,
            disabledActionRow,
            disabledFilterRow,
          ],
        })
        .catch(() => {});
    }
  });
}

/**
 * Manipula o subcomando para comprar um item
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleBuyItem(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const listingId = interaction.options.getString("id");

  // Buscar a listagem pelo ID
  const listing = await getListingById(listingId);

  if (!listing) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Listagem Não Encontrada",
      mensagem: "Esta listagem não existe ou já foi vendida.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Verificar se o usuário não está tentando comprar seu próprio item
  if (listing.sellerId === userId) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Operação Inválida",
      mensagem:
        "Você não pode comprar seu próprio item. Use /marketplace cancelar para cancelar sua listagem.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Verificar se o usuário tem saldo suficiente
  const userData = await firebaseService.getUserData(userId);
  const saldo = userData.saldo || 0;

  if (saldo < listing.price) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Saldo Insuficiente",
      mensagem: `Você tem apenas ${formatarDinheiro(
        saldo
      )}, mas o item custa ${formatarDinheiro(listing.price)}.`,
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Obter detalhes do item
  const itemDetails = storeItemsService.getItemById(listing.itemId);

  if (!itemDetails && !listing.itemId.startsWith("fichas_cassino_")) {
    const embedErro = embedUtils.criarEmbedErro({
      usuario: username,
      titulo: "Item Indisponível",
      mensagem: "Este item não está mais disponível no sistema.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }

  // Calcular taxa de marketplace (5% do preço de venda)
  const marketplaceFee = Math.floor(listing.price * 0.05);
  const sellerReceives = listing.price - marketplaceFee;

  // Processar a compra:

  // 1. Debitar o saldo do comprador
  const newBuyerBalance = await firebaseService.updateUserBalance(
    userId,
    -listing.price
  );

  // 2. Creditar o vendedor (menos a taxa)
  const newSellerBalance = await firebaseService.updateUserBalance(
    listing.sellerId,
    sellerReceives
  );

  // 3. Adicionar o item ao inventário do comprador
  if (listing.itemId.startsWith("fichas_cassino_")) {
    // Para fichas de cassino
    const quantity = parseInt(listing.itemId.split("_")[2]) || 0;
    await inventoryService.addCasinoChips(userId, quantity);
  } else {
    // Para outros itens
    await inventoryService.addItem(userId, listing.itemId);
  }

  // 4. Remover a listagem do marketplace
  await removeListing(listingId);

  // 5. Criar embed de confirmação
  const embedSucesso = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Compra Realizada com Sucesso")
    .setDescription(
      `Você comprou **${listing.icon} ${listing.name}** de **${listing.sellerName}**.`
    )
    .addFields(
      {
        name: "💰 Preço de Compra",
        value: formatarDinheiro(listing.price),
        inline: true,
      },
      {
        name: "💸 Taxa de Marketplace (5%)",
        value: formatarDinheiro(marketplaceFee),
        inline: true,
      }
    );

  if (listing.description) {
    embedSucesso.addFields({
      name: "📝 Descrição",
      value: listing.description,
      inline: false,
    });
  }
  try {
    return interaction.editReply({ embeds: [embedSucesso] });
  } catch (error) {
    console.error("Erro ao executar subcomando marketplace cancelar:", error);
    throw error;
  }
}
/**
 * Manipula o subcomando para ver as próprias listagens
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleViewMyListings(interaction) {
  try {
    const userId = interaction.user.id;

    // Obter listagens do usuário
    const listings = await getUserListings(userId);

    // Se não houver listagens
    if (listings.length === 0) {
      const embedVazio = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("📦 Nenhuma Listagem Ativa")
        .setDescription(
          "Você não tem itens listados no marketplace no momento."
        )
        .setFooter({ text: "Use /marketplace listar para vender seus itens!" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embedVazio] });
    }

    // Criar embed com listagens
    const embed = new EmbedBuilder()
      .setColor(0x4169e1) // Azul
      .setTitle("📦 Minhas Listagens no Marketplace")
      .setDescription(
        `Você tem **${listings.length}** ${
          listings.length === 1 ? "listagem ativa" : "listagens ativas"
        } no marketplace.`
      )
      .setFooter({
        text: "Use /marketplace cancelar [id] para remover uma listagem",
      })
      .setTimestamp();

    // Adicionar cada item listado ao embed
    let listedItems = "";

    listings.forEach((listing) => {
      listedItems += `**${listing.icon} ${listing.name}** (ID: \`${listing.id}\`)\n`;
      listedItems += `💰 Preço: ${formatarDinheiro(listing.price)}\n`;

      if (listing.description) {
        listedItems += `📝 Nota: ${listing.description}\n`;
      }

      listedItems += `📅 Listado em: ${new Date(
        listing.listingDate
      ).toLocaleString("pt-BR")}\n\n`;
    });

    embed.addFields({
      name: "📦 Suas Listagens",
      value: listedItems || "Nenhuma listagem encontrada.",
      inline: false,
    });

    // Criar botões de ação
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_listing")
        .setLabel("Cancelar Listagem")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
      new ButtonBuilder()
        .setCustomId("view_marketplace")
        .setLabel("Ver Marketplace")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🏪")
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [actionRow],
    });

    // Coletor para botões
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

      if (i.customId === "cancel_listing") {
        await i.reply({
          content:
            "Use o comando `/marketplace cancelar [id]` para cancelar uma listagem específica.",
          ephemeral: true,
        });
      } else if (i.customId === "view_marketplace") {
        await i.deferUpdate();

        // Criar uma nova interação redirecionando para ver o marketplace
        const newInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => "ver",
            getString: () => null,
          },
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
        };

        await handleViewMarketplace(newInteraction);
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        // Desativar botões após expirar
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(actionRow.components[0]).setDisabled(true),
          ButtonBuilder.from(actionRow.components[1]).setDisabled(true)
        );

        await interaction
          .editReply({ components: [disabledRow] })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error("Erro ao executar subcomando marketplace minhas:", error);
    throw error;
  }
}

/**
 * Manipula o subcomando para cancelar uma listagem
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleCancelListing(interaction) {
  try {
    const userId = interaction.user.id;
    const listingId = interaction.options.getString("id");

    // Buscar a listagem pelo ID
    const listing = await getListingById(listingId);

    if (!listing) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Listagem Não Encontrada",
        mensagem: "Esta listagem não existe ou já foi vendida.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se a listagem pertence ao usuário
    if (listing.sellerId !== userId) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Listagem Não Autorizada",
        mensagem: "Você não pode cancelar uma listagem que não é sua.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Devolver o item ao inventário do usuário
    if (listing.itemId.startsWith("fichas_cassino_")) {
      // Para fichas de cassino
      const quantity = parseInt(listing.itemId.split("_")[2]) || 0;
      await inventoryService.addCasinoChips(userId, quantity);
    } else {
      // Para outros itens
      await inventoryService.addItem(userId, listing.itemId);
    }

    // Remover a listagem
    await removeListing(listingId);

    // Criar embed de confirmação
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Listagem Cancelada com Sucesso")
      .setDescription(
        `Você cancelou a listagem de **${listing.icon} ${listing.name}** no marketplace.`
      )
      .addFields({
        name: "📦 Item Devolvido",
        value: `O item foi devolvido ao seu inventário.`,
        inline: false,
      })
      .setFooter({ text: "A taxa de listagem não é devolvida." })
      .setTimestamp();

    return interaction.editReply({ embeds: [embedSucesso] });
  } catch (error) {
    console.error("Erro ao executar subcomando marketplace cancelar:", error);
    throw error;
  }
}

/**
 * Manipula o subcomando para comprar um item
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleBuyItem(interaction) {
  try {
    const userId = interaction.user.id;
    const listingId = interaction.options.getString("id");

    // Buscar a listagem pelo ID
    const listing = await getListingById(listingId);

    if (!listing) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Listagem Não Encontrada",
        mensagem: "Esta listagem não existe ou já foi vendida.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o usuário não está tentando comprar seu próprio item
    if (listing.sellerId === userId) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Operação Inválida",
        mensagem:
          "Você não pode comprar seu próprio item. Use /marketplace cancelar para cancelar sua listagem.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o usuário tem saldo suficiente
    const userData = await firebaseService.getUserData(userId);
    const saldo = userData.saldo || 0;

    if (saldo < listing.price) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Saldo Insuficiente",
        mensagem: `Você tem apenas ${formatarDinheiro(
          saldo
        )}, mas o item custa ${formatarDinheiro(listing.price)}.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Calcular taxa de marketplace (5% do preço de venda)
    const marketplaceFee = Math.floor(listing.price * 0.05);
    const sellerReceives = listing.price - marketplaceFee;

    // Processar a compra:

    // 1. Debitar o saldo do comprador
    const newBuyerBalance = await firebaseService.updateUserBalance(
      userId,
      -listing.price
    );

    // 2. Creditar o vendedor (menos a taxa)
    const newSellerBalance = await firebaseService.updateUserBalance(
      listing.sellerId,
      sellerReceives
    );

    // 3. Adicionar o item ao inventário do comprador
    if (listing.itemId.startsWith("fichas_cassino_")) {
      // Para fichas de cassino
      const quantity = parseInt(listing.itemId.split("_")[2]) || 0;
      await inventoryService.addCasinoChips(userId, quantity);
    } else {
      // Para outros itens
      await inventoryService.addItem(userId, listing.itemId);
    }

    // 4. Remover a listagem do marketplace
    await removeListing(listingId);

    // 5. Criar embed de confirmação
    const embedSucesso = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Compra Realizada com Sucesso")
      .setDescription(
        `Você comprou **${listing.icon} ${listing.name}** de **${listing.sellerName}**.`
      )
      .addFields(
        {
          name: "💰 Preço de Compra",
          value: formatarDinheiro(listing.price),
          inline: true,
        },
        {
          name: "💵 Saldo Atual",
          value: formatarDinheiro(newBuyerBalance),
          inline: true,
        },
        {
          name: "📦 Item Adicionado",
          value: `${listing.icon} ${listing.name} foi adicionado ao seu inventário.`,
          inline: false,
        }
      )
      .setFooter({ text: "Use /inventario para ver seus itens" })
      .setTimestamp();

    // Criar botão para verificar inventário
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("check_inventory")
        .setLabel("Ver Inventário")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎒"),
      new ButtonBuilder()
        .setCustomId("back_marketplace")
        .setLabel("Voltar ao Marketplace")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏪")
    );

    const reply = await interaction.editReply({
      embeds: [embedSucesso],
      components: [row],
    });

    // Notificar o vendedor sobre a venda
    try {
      const sellerUser = await interaction.client.users.fetch(listing.sellerId);

      if (sellerUser) {
        const sellerEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("💰 Item Vendido no Marketplace")
          .setDescription(
            `**${interaction.user.username}** comprou seu item **${listing.icon} ${listing.name}**.`
          )
          .addFields(
            {
              name: "💰 Valor da Venda",
              value: formatarDinheiro(listing.price),
              inline: true,
            },
            {
              name: "💸 Taxa do Marketplace (5%)",
              value: formatarDinheiro(marketplaceFee),
              inline: true,
            },
            {
              name: "💵 Você Recebeu",
              value: formatarDinheiro(sellerReceives),
              inline: true,
            },
            {
              name: "💰 Seu Saldo Atual",
              value: formatarDinheiro(newSellerBalance),
              inline: true,
            }
          )
          .setFooter({
            text: "Use /marketplace listar para vender mais itens!",
          })
          .setTimestamp();

        sellerUser.send({ embeds: [sellerEmbed] }).catch(() => {
          // Silenciosamente falha se não conseguir enviar a mensagem privada
        });
      }
    } catch (error) {
      // Ignorar erros ao tentar notificar o vendedor
      console.error("Erro ao notificar vendedor:", error);
    }

    // Coletor para botões
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

      if (i.customId === "check_inventory") {
        await i.reply({
          content: "Use o comando `/inventario` para ver seus itens!",
          ephemeral: true,
        });
      } else if (i.customId === "back_marketplace") {
        await i.deferUpdate();

        // Criar uma nova interação redirecionando para ver o marketplace
        const newInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => "ver",
            getString: () => null,
          },
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
        };

        await handleViewMarketplace(newInteraction);
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        // Desativar botões após expirar
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true),
          ButtonBuilder.from(row.components[1]).setDisabled(true)
        );

        await interaction
          .editReply({ components: [disabledRow] })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error("Erro ao executar subcomando marketplace comprar:", error);
    throw error;
  }
}

// Funções utilitárias para o marketplace

/**
 * Gera um ID único para uma listagem
 * @returns {string} - ID gerado
 */
function generateListingId() {
  // Formato: ML-XXXXX onde X é dígito alfanumérico
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "ML-";

  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

/**
 * Cria uma nova listagem no marketplace
 * @param {Object} listing - Dados da listagem
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
async function createListing(listing) {
  try {
    const database = getDatabase();
    const listingRef = ref(database, `marketplace/listings/${listing.id}`);

    await set(listingRef, listing);
    return true;
  } catch (error) {
    console.error("Erro ao criar listagem:", error);
    return false;
  }
}

/**
 * Remove uma listagem do marketplace
 * @param {string} listingId - ID da listagem
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
async function removeListing(listingId) {
  try {
    const database = getDatabase();
    const listingRef = ref(database, `marketplace/listings/${listingId}`);

    await set(listingRef, null);
    return true;
  } catch (error) {
    console.error("Erro ao remover listagem:", error);
    return false;
  }
}

/**
 * Obtém uma listagem pelo ID
 * @param {string} listingId - ID da listagem
 * @returns {Promise<Object|null>} - Dados da listagem ou null
 */
async function getListingById(listingId) {
  try {
    const database = getDatabase();
    const listingRef = ref(database, `marketplace/listings/${listingId}`);
    const snapshot = await get(listingRef);

    if (snapshot.exists()) {
      return snapshot.val();
    }

    return null;
  } catch (error) {
    console.error("Erro ao obter listagem:", error);
    return null;
  }
}

/**
 * Obtém todas as listagens ativas filtradas por categoria
 * @param {string} category - Categoria para filtrar (ou "all" para todas)
 * @returns {Promise<Array>} - Array de listagens
 */
async function getActiveListings(category = "all") {
  try {
    const database = getDatabase();
    const listingsRef = ref(database, "marketplace/listings");
    const snapshot = await get(listingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    // Converter para array e filtrar por categoria
    const listings = [];

    snapshot.forEach((childSnapshot) => {
      const listing = childSnapshot.val();

      if (category === "all" || listing.category === category) {
        listings.push(listing);
      }
    });

    // Ordenar do mais recente para o mais antigo
    listings.sort((a, b) => b.listingDate - a.listingDate);

    return listings;
  } catch (error) {
    console.error("Erro ao obter listagens ativas:", error);
    return [];
  }
}

/**
 * Obtém as listagens de um usuário específico
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Array de listagens
 */
async function getUserListings(userId) {
  try {
    const database = getDatabase();
    const listingsRef = ref(database, "marketplace/listings");
    const snapshot = await get(listingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    // Filtrar listagens do usuário
    const listings = [];

    snapshot.forEach((childSnapshot) => {
      const listing = childSnapshot.val();

      if (listing.sellerId === userId) {
        listings.push(listing);
      }
    });

    // Ordenar do mais recente para o mais antigo
    listings.sort((a, b) => b.listingDate - a.listingDate);

    return listings;
  } catch (error) {
    console.error("Erro ao obter listagens do usuário:", error);
    return [];
  }
}

// Importar as funções do Firebase
import { getDatabase, ref, set, get } from "firebase/database";
