// perfil.js - Versão melhorada
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

    // Calcular estatísticas de uso de comandos, se disponível
    let commandStats = {};
    try {
      if (userData.cooldowns) {
        commandStats = {
          trabalhar: userData.cooldowns.trabalhar
            ? new Date(userData.cooldowns.trabalhar).toLocaleString("pt-BR")
            : "Nunca usado",
          crime: userData.cooldowns.crime
            ? new Date(userData.cooldowns.crime).toLocaleString("pt-BR")
            : "Nunca usado",
          seduzir: userData.cooldowns.seduzir
            ? new Date(userData.cooldowns.seduzir).toLocaleString("pt-BR")
            : "Nunca usado",
        };
      }
    } catch (error) {
      console.error("Erro ao processar estatísticas de comandos:", error);
    }

    // Calcular estatísticas do cassino, se disponível
    let casinoStats = {
      gamesPlayed: 0,
      winnings: 0,
      losses: 0,
      balance: 0,
    };

    try {
      if (userData.stats && userData.stats.casino) {
        casinoStats = {
          gamesPlayed: userData.stats.casino.gamesPlayed || 0,
          winnings: userData.stats.casino.winnings || 0,
          losses: userData.stats.casino.losses || 0,
          balance:
            (userData.stats.casino.winnings || 0) -
            (userData.stats.casino.losses || 0),
        };
      }
    } catch (error) {
      console.error("Erro ao processar estatísticas de cassino:", error);
    }

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
          value: `R$${userData.saldo.toFixed(2)}`,
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
      .setFooter({
        text: `ID: ${userId} • Membro desde ${new Date(
          userData.createdAt || Date.now()
        ).toLocaleDateString("pt-BR")}`,
      })
      .setTimestamp();

    // Adicionar estatísticas de cassino se o usuário já jogou alguma vez
    if (casinoStats.gamesPlayed > 0) {
      embed.addFields({
        name: "🎮 Estatísticas do Cassino",
        value: `**Partidas:** ${
          casinoStats.gamesPlayed
        }\n**Ganhos:** R$${casinoStats.winnings.toFixed(
          2
        )}\n**Perdas:** R$${casinoStats.losses.toFixed(
          2
        )}\n**Saldo:** R$${casinoStats.balance.toFixed(2)}`,
        inline: false,
      });
    }

    // Adicionar última atividade se for o próprio usuário
    if (isOwnProfile && Object.keys(commandStats).length > 0) {
      embed.addFields({
        name: "📊 Última Atividade",
        value: `💼 Trabalho: ${commandStats.trabalhar}\n🔪 Crime: ${commandStats.crime}\n💋 Sedução: ${commandStats.seduzir}`,
        inline: false,
      });
    }

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
