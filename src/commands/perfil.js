// perfil.js - Com formatação brasileira de moeda
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import firebaseService from "../services/firebase.js";
import inventoryService from "../services/inventory.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("perfil")
  .setDescription("Veja seu perfil econômico ou de outro usuário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver o perfil (opcional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnProfile = userId === interaction.user.id;

    // Obter dados do usuário
    const userData = await firebaseService.getUserData(userId);

    // Obter posição no ranking
    const rankingInfo = await firebaseService.getUserRanking(userId);

    // Obter quantidade de fichas de cassino
    const casinoChips = await inventoryService.getCasinoChips(userId);

    // Determinar emblema baseado no saldo
    let badge = "🥉"; // Bronze (padrão)
    if (userData.saldo >= 100000) {
      badge = "👑"; // Coroa (100k+)
    } else if (userData.saldo >= 50000) {
      badge = "💎"; // Diamante (50k+)
    } else if (userData.saldo >= 20000) {
      badge = "🥇"; // Ouro (20k+)
    } else if (userData.saldo >= 5000) {
      badge = "🥈"; // Prata (5k+)
    }

    // Criar embed principal
    const embed = new EmbedBuilder()
      .setColor(0x4b0082) // Índigo (cor mais rica)
      .setTitle(`${badge} Perfil de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: "💰 Patrimônio",
          value: formatarDinheiro(userData.saldo),
          inline: true,
        },
        {
          name: "🎰 Fichas de Cassino",
          value: `${casinoChips} fichas`,
          inline: true,
        },
        {
          name: "🏆 Ranking",
          value: rankingInfo ? `#${rankingInfo.position}` : "Não classificado",
          inline: true,
        }
      )
      .setFooter({ text: `ID: ${userId}` })
      .setTimestamp();

    // Adicionar botões para comandos relacionados
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("show_inventario")
        .setLabel("Ver Inventário")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎒"),
      new ButtonBuilder()
        .setCustomId("show_loja")
        .setLabel("Ir para Loja")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🛒")
    );

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

      if (i.customId === "show_inventario") {
        // Executar comando de inventário
        await i.reply({
          content: "Use o comando `/inventario` para ver seu inventário!",
          ephemeral: true,
        });
      } else if (i.customId === "show_loja") {
        // Executar comando de loja
        await i.reply({
          content: "Use o comando `/loja` para visitar a loja!",
          ephemeral: true,
        });
      }
    });

    collector.on("end", async () => {
      // Desativar botões quando expirar
      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(row.components[0]).setDisabled(true),
        ButtonBuilder.from(row.components[1]).setDisabled(true)
      );

      await interaction
        .editReply({ components: [disabledRow] })
        .catch(() => {});
    });
  } catch (error) {
    console.error("Erro ao executar comando perfil:", error);

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
