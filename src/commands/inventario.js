// inventario.js - Com formatação brasileira
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import inventoryService from "../services/inventory.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("inventario")
  .setDescription("Mostra os itens em seu inventário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver o inventário (opcional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnInventory = targetUser.id === interaction.user.id;

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

    // Verificar se há outros itens no inventário (para compatibilidade futura)
    const hasOtherItems =
      inventory.items && Object.keys(inventory.items).length > 0;

    // Criar embed do inventário
    const embed = new EmbedBuilder()
      .setColor(0x0099ff) // Azul
      .setTitle(`🎒 Inventário de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields({
        name: "🎰 Fichas de Cassino",
        value: `${casinoChips} fichas`,
        inline: true,
      })
      .setFooter({
        text: `ID: ${userId} • ${new Date().toLocaleString("pt-BR")}`,
      })
      .setTimestamp();

    // Adicionar descrição explicativa
    const description =
      casinoChips > 0
        ? `Você possui **${casinoChips} fichas** de cassino que podem ser usadas para jogar nos jogos: 🎮 /blackjack, 🎲 /dados, 🎡 /roleta, 🎰 /slots`
        : `Você não possui fichas de cassino. Compre fichas na loja com o comando /loja ou ganhe dinheiro com os comandos /trabalhar, /crime e /seduzir.`;

    embed.setDescription(description);

    // Adicionar valor estimado
    embed.addFields({
      name: "💸 Valor Estimado",
      value: formatarDinheiro(casinoChips * 10),
      inline: true,
    });

    // Criar botões para ações rápidas
    const row = new ActionRowBuilder();

    // Sempre adicionar botão para a loja
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("go_to_shop")
        .setLabel("Comprar Fichas")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🛒")
    );

    // Adicionar botão para trocar fichas por dinheiro apenas se tiver fichas
    if (casinoChips > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("exchange_chips")
          .setLabel("Trocar por Dinheiro")
          .setStyle(ButtonStyle.Success)
          .setEmoji("💱")
      );
    }

    // Enviar a mensagem
    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Coletor para botões
    const collector = reply.createMessageComponentCollector({
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "Você não pode usar estes botões.",
          ephemeral: true,
        });
        return;
      }

      if (i.customId === "go_to_shop") {
        await i.reply({
          content: "Use o comando `/loja` para comprar fichas de cassino!",
          ephemeral: true,
        });
      } else if (i.customId === "exchange_chips") {
        await i.reply({
          content:
            "Use o comando `/trocar-fichas [quantidade]` para trocar suas fichas por dinheiro!",
          ephemeral: true,
        });
      }
    });

    collector.on("end", async () => {
      // Desativar botões quando expirar
      const disabledRow = new ActionRowBuilder();

      for (const component of row.components) {
        disabledRow.addComponents(
          ButtonBuilder.from(component).setDisabled(true)
        );
      }

      await interaction
        .editReply({ components: [disabledRow] })
        .catch(() => {});
    });
  } catch (error) {
    console.error("Erro ao executar comando inventario:", error);

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
