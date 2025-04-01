// inventario.js - Com exibição detalhada de itens
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
import { formatarDinheiro, formatarTempoEspera } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("inventario")
  .setDescription("Mostra os itens em seu inventário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver o inventário (opcional)")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("categoria")
      .setDescription("Categoria específica de itens para visualizar")
      .setRequired(false)
      .addChoices(
        { name: "🎰 Cassino", value: "casino" },
        { name: "🧪 Consumíveis", value: "consumiveis" },
        { name: "✨ VIP", value: "vip" },
        { name: "📦 Todos os Itens", value: "all" }
      )
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnInventory = targetUser.id === interaction.user.id;

    // Categoria selecionada (se houver)
    const selectedCategory =
      interaction.options.getString("categoria") || "all";

    // Obter inventário do usuário
    const inventory = await inventoryService.getUserInventory(userId);

    if (!inventory) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Inventário Não Encontrado",
        mensagem: `Não foi possível encontrar o inventário ${
          isOwnInventory ? "do seu usuário" : "deste usuário"
        }.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Obter a quantidade de fichas de cassino
    const casinoChips = inventory.fichas_cassino || 0;

    // Criar embed do inventário
    const embed = new EmbedBuilder()
      .setColor(0x0099ff) // Azul
      .setTitle(`🎒 Inventário de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    // Adicionar descrição explicativa
    let description = isOwnInventory
      ? "Aqui está o seu inventário de itens. Use os botões abaixo para navegar."
      : `Aqui está o inventário de ${targetUser.username}.`;

    if (selectedCategory !== "all") {
      description += `\nFiltrando pela categoria: **${storeItemsService.getCategoryDisplayName(
        selectedCategory
      )}**`;
    }

    embed.setDescription(description);

    // Adicionar informações das fichas de cassino
    if (selectedCategory === "all" || selectedCategory === "casino") {
      embed.addFields({
        name: "🎰 Fichas de Cassino",
        value: `${casinoChips} fichas`,
        inline: true,
      });

      // Adicionar valor estimado
      embed.addFields({
        name: "💸 Valor Estimado",
        value: formatarDinheiro(casinoChips * 10),
        inline: true,
      });
    }

    // Processar itens do inventário
    let hasItems = false;
    console.log(
      `Processando inventário. Categoria selecionada: ${selectedCategory}`
    );
    console.log("Itens no inventário:", inventory.items);

    let itemsByCategory = {};
    if (inventory.items && Object.keys(inventory.items).length > 0) {
      // Agrupar itens por categoria
      // Processar cada item no inventário
      for (const itemId in inventory.items) {
        console.log(
          `Verificando item: ${itemId}, Quantidade: ${inventory.items[itemId].quantity}`
        );

        // Verificar se o item existe e tem quantidade maior que 0
        if (inventory.items[itemId].quantity <= 0) {
          console.log(`Item ${itemId} tem quantidade 0, pulando`);
          continue;
        }

        // Obter detalhes do item da loja
        const itemDetails = storeItemsService.getItemById(itemId);
        console.log("Detalhes do item:", itemDetails);

        if (!itemDetails) {
          console.log(`Item ${itemId} não encontrado na loja, pulando`);
          continue;
        }

        // Filtrar por categoria selecionada
        if (
          selectedCategory !== "all" &&
          itemDetails.category !== selectedCategory
        ) {
          console.log(
            `Item ${itemId} não pertence à categoria ${selectedCategory}, pulando`
          );
          continue;
        }

        // Inicializar categoria se necessário
        if (!itemsByCategory[itemDetails.category]) {
          itemsByCategory[itemDetails.category] = [];
        }

        // Adicionar item à categoria
        itemsByCategory[itemDetails.category].push({
          id: itemId,
          name: itemDetails.name,
          icon: itemDetails.icon,
          quantity: inventory.items[itemId].quantity,
          description: itemDetails.description,
          usavel: itemDetails.usavel,
          lastUsed: inventory.items[itemId].lastUsed,
        });

        hasItems = true;
      }
      console.log("Itens agrupados por categoria:", itemsByCategory);
    }

    // Adicionar campos ao embed para cada categoria de item
    for (const category in itemsByCategory) {
      // Obter nome de exibição e ícone da categoria
      const categoryDisplayName =
        storeItemsService.getCategoryDisplayName(category);

      // Formatar itens desta categoria
      const itemsText = itemsByCategory[category]
        .map((item) => {
          // Verificar se está em cooldown
          let cooldownText = "";
          let statusIcon = "";

          if (item.lastUsed && item.usavel) {
            const now = Date.now();
            const timeElapsed = now - item.lastUsed;

            // Obter detalhes do item da loja para verificar cooldown
            const storeItem = storeItemsService.getItemById(item.id);
            if (
              storeItem &&
              storeItem.cooldown &&
              timeElapsed < storeItem.cooldown
            ) {
              const timeRemaining = storeItem.cooldown - timeElapsed;
              cooldownText = ` (🕒 Em espera: ${formatarTempoEspera(
                timeRemaining
              )})`;
              statusIcon = "🕒";
            } else if (
              storeItem &&
              storeItem.duration &&
              timeElapsed < storeItem.duration
            ) {
              // Item ainda está ativo
              const timeRemaining = storeItem.duration - timeElapsed;
              cooldownText = ` (✨ Ativo por mais: ${formatarTempoEspera(
                timeRemaining
              )})`;
              statusIcon = "✨";
            } else {
              statusIcon = item.usavel ? "✅" : "📦";
            }
          } else {
            statusIcon = item.usavel ? "✅" : "📦";
          }

          return `${statusIcon} **${item.icon} ${item.name}** x${item.quantity}${cooldownText}\n└ *${item.description}*`;
        })
        .join("\n\n");

      // Adicionar campo para esta categoria
      embed.addFields({
        name: `${storeItemsService.getCategoryIcon(
          category
        )} ${categoryDisplayName} (${itemsByCategory[category].length})`,
        value: itemsText || "Nenhum item nesta categoria.",
        inline: false,
      });
    }

    // Verificar se o usuário tem algum item (além das fichas)
    if (!hasItems) {
      const noItemsMessage = isOwnInventory
        ? "Você não possui nenhum item em seu inventário. Use o comando `/loja` para comprar itens!"
        : `${targetUser.username} não possui nenhum item em seu inventário.`;

      embed.addFields({
        name: "📦 Inventário vazio",
        value: noItemsMessage,
        inline: false,
      });
    }

    // Criar botões para ações rápidas
    const row = new ActionRowBuilder();

    // Sempre adicionar botão para a loja
    if (isOwnInventory) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("go_to_shop")
          .setLabel("Comprar Itens")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🛒")
      );
    }

    // Adicionar botão para trocar fichas por dinheiro apenas se tiver fichas
    if (casinoChips > 0 && isOwnInventory) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("exchange_chips")
          .setLabel("Trocar Fichas")
          .setStyle(ButtonStyle.Success)
          .setEmoji("💱")
      );
    }

    // Adicionar botão para usar item se tiver itens usáveis e for o próprio inventário
    if (hasItems && isOwnInventory) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("use_item")
          .setLabel("Usar Item")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔮")
      );
    }

    // Criar menu para filtrar categorias
    const filterMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("filter_category")
        .setPlaceholder("Filtrar por categoria...")
        .addOptions([
          {
            label: "Todos os Itens",
            value: "all",
            description: "Mostrar todo o inventário",
            emoji: "📦",
            default: selectedCategory === "all",
          },
          {
            label: "Fichas de Cassino",
            value: "casino",
            description: "Mostrar apenas fichas de cassino",
            emoji: "🎰",
            default: selectedCategory === "casino",
          },
          {
            label: "Consumíveis",
            value: "consumiveis",
            description: "Mostrar apenas itens consumíveis",
            emoji: "🧪",
            default: selectedCategory === "consumiveis",
          },
          {
            label: "VIP",
            value: "vip",
            description: "Mostrar apenas itens VIP",
            emoji: "✨",
            default: selectedCategory === "vip",
          },
        ])
    );

    // Enviar a mensagem
    const components = [];
    if (row.components.length > 0) {
      components.push(row);
    }
    components.push(filterMenu);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    // Coletor para botões e menus
    const collector = reply.createMessageComponentCollector({
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "Você não pode usar estes controles.",
          ephemeral: true,
        });
        return;
      }

      // Processar interações de botões
      if (i.isButton()) {
        if (i.customId === "go_to_shop") {
          await i.reply({
            content:
              "Use o comando `/loja` para comprar fichas de cassino e outros itens!",
            ephemeral: true,
          });
        } else if (i.customId === "exchange_chips") {
          await i.reply({
            content:
              "Use o comando `/trocar-fichas [quantidade]` para trocar suas fichas por dinheiro!",
            ephemeral: true,
          });
        } else if (i.customId === "use_item") {
          await i.reply({
            content:
              "Use o comando `/usar [item]` para utilizar um item do seu inventário!",
            ephemeral: true,
          });
        }
      }
      // Processar interações de menu de seleção
      else if (i.isStringSelectMenu() && i.customId === "filter_category") {
        const newCategory = i.values[0];
        await i.deferUpdate();

        // Criar uma nova interação com a categoria selecionada
        const newInteraction = {
          ...interaction,
          options: {
            ...interaction.options,
            getString: (name) => {
              if (name === "categoria") return newCategory;
              return interaction.options.getString(name);
            },
            getUser: (name) => interaction.options.getUser(name),
          },
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
        };

        // Executar novamente com a nova categoria
        await execute(newInteraction);
        collector.stop();
      }
    });

    try {
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          // Desativar componentes quando expirar
          const disabledComponents = components.map((row) => {
            const disabledRow = new ActionRowBuilder();

            row.components.forEach((component) => {
              if (component.type === ComponentType.Button) {
                disabledRow.addComponents(
                  ButtonBuilder.from(component).setDisabled(true)
                );
              } else if (component.type === ComponentType.StringSelect) {
                disabledRow.addComponents(
                  StringSelectMenuBuilder.from(component)
                    .setDisabled(true)
                    .setPlaceholder("Menu expirado")
                );
              }
            });

            return disabledRow;
          });

          try {
            await interaction.editReply({ components: disabledComponents });
          } catch (editError) {
            console.error("Erro ao editar resposta:", editError);
          }
        }
      });
    } catch (error) {
      console.error("Erro ao executar coletor do comando inventario:", error);

      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro no Comando",
        mensagem:
          "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }
  } catch (error) {
    console.error("Erro ao executar comando inventario:", error);

    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Comando",
      mensagem:
        "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }
}
