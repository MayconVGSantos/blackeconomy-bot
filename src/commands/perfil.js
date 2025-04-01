// perfil.js - Com formatação brasileira de moeda e informações aprimoradas
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
import moralityService from "../services/morality.js";
import educationService from "../services/education.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";
// Importando as funções do Firebase no início do arquivo
import { getDatabase, ref, get } from "firebase/database";

export const data = new SlashCommandBuilder()
  .setName("perfil")
  .setDescription("Veja seu perfil econômico ou de outro usuário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver o perfil (opcional)")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("categoria")
      .setDescription("Categoria de informações para mostrar")
      .setRequired(false)
      .addChoices(
        { name: "📊 Geral", value: "geral" },
        { name: "🎓 Educação", value: "educacao" },
        { name: "😇 Moralidade", value: "moralidade" },
        { name: "🎮 Cassino", value: "cassino" }
      )
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnProfile = userId === interaction.user.id;

    // Categoria selecionada
    const categoria = interaction.options.getString("categoria") || "geral";

    // Obter dados do usuário
    const userData = await firebaseService.getUserData(userId);

    // Obter posição no ranking
    const rankingInfo = await firebaseService.getUserRanking(userId);

    // Obter quantidade de fichas de cassino
    const casinoChips = await inventoryService.getCasinoChips(userId);

    // Obter moralidade
    const morality = await moralityService.getMorality(userId);
    const { title: moralityTitle, emoji: moralityEmoji } =
      moralityService.getMoralityTitle(morality);

    // Obter dados educacionais
    const educationInfo = await educationService.getFormattedEducationInfo(
      userId
    );

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

    // Criar o embed de acordo com a categoria selecionada
    let embed;

    switch (categoria) {
      case "educacao":
        embed = await createEducationEmbed(targetUser, educationInfo);
        break;
      case "moralidade":
        embed = await createMoralityEmbed(targetUser, morality, userData);
        break;
      case "cassino":
        embed = await createCasinoEmbed(targetUser, casinoChips, userId);
        break;
      case "geral":
      default:
        embed = createGeneralEmbed(
          targetUser,
          userData,
          rankingInfo,
          casinoChips,
          morality,
          moralityTitle,
          moralityEmoji,
          educationInfo,
          badge
        );
        break;
    }

    // Criar seletor de categorias
    const categoryRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("perfil_categoria")
        .setPlaceholder("Selecionar categoria")
        .addOptions([
          {
            label: "Geral",
            value: "geral",
            emoji: "📊",
            description: "Visualização geral do perfil",
          },
          {
            label: "Educação",
            value: "educacao",
            emoji: "🎓",
            description: "Informações educacionais",
          },
          {
            label: "Moralidade",
            value: "moralidade",
            emoji: "😇",
            description: "Status de reputação",
          },
          {
            label: "Cassino",
            value: "cassino",
            emoji: "🎮",
            description: "Estatísticas de jogos",
          },
        ])
    );

    // Adicionar botões para comandos relacionados
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("show_inventario")
        .setLabel("Ver Inventário")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎒"),
      new ButtonBuilder()
        .setCustomId("show_loja")
        .setLabel("Ir para Loja")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🛒"),
      new ButtonBuilder()
        .setCustomId("show_tempo")
        .setLabel("Ver Cooldowns")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏱️")
    );

    // Enviar a mensagem
    const reply = await interaction.editReply({
      embeds: [embed],
      components: [categoryRow, actionRow],
    });

    // Coletor para os componentes
    const collector = reply.createMessageComponentCollector({
      time: 180000, // 3 minutos
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "Você não pode usar estes componentes.",
          ephemeral: true,
        });
        return;
      }

      // Componentes de botão
      if (i.isButton()) {
        if (i.customId === "show_inventario") {
          await i.reply({
            content: "Use o comando `/inventario` para ver seu inventário!",
            ephemeral: true,
          });
        } else if (i.customId === "show_loja") {
          await i.reply({
            content: "Use o comando `/loja` para visitar a loja!",
            ephemeral: true,
          });
        } else if (i.customId === "show_tempo") {
          await i.reply({
            content: "Use o comando `/tempo-espera` para ver seus cooldowns!",
            ephemeral: true,
          });
        }
      }

      // Seletor de categoria
      if (i.isStringSelectMenu() && i.customId === "perfil_categoria") {
        await i.deferUpdate();

        const selectedCategory = i.values[0];
        let newEmbed;

        switch (selectedCategory) {
          case "educacao":
            newEmbed = await createEducationEmbed(targetUser, educationInfo);
            break;
          case "moralidade":
            newEmbed = await createMoralityEmbed(
              targetUser,
              morality,
              userData
            );
            break;
          case "cassino":
            newEmbed = await createCasinoEmbed(targetUser, casinoChips, userId);
            break;
          case "geral":
          default:
            newEmbed = createGeneralEmbed(
              targetUser,
              userData,
              rankingInfo,
              casinoChips,
              morality,
              moralityTitle,
              moralityEmoji,
              educationInfo,
              badge
            );
            break;
        }

        await i.editReply({ embeds: [newEmbed] });
      }
    });

    collector.on("end", async () => {
      // Desativar componentes quando expirarem
      const disabledCategoryRow = new ActionRowBuilder().addComponents(
        StringSelectMenuBuilder.from(categoryRow.components[0]).setDisabled(
          true
        )
      );

      const disabledActionRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(actionRow.components[0]).setDisabled(true),
        ButtonBuilder.from(actionRow.components[1]).setDisabled(true),
        ButtonBuilder.from(actionRow.components[2]).setDisabled(true)
      );

      await interaction
        .editReply({ components: [disabledCategoryRow, disabledActionRow] })
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

/**
 * Cria o embed da visão geral do perfil
 */
function createGeneralEmbed(
  targetUser,
  userData,
  rankingInfo,
  casinoChips,
  morality,
  moralityTitle,
  moralityEmoji,
  educationInfo,
  badge
) {
  // Criar embed principal
  const embed = new EmbedBuilder()
    .setColor(0x4b0082) // Índigo (cor mais rica)
    .setTitle(`${badge} Perfil de ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `Aqui está uma visão geral do seu perfil no BlackEconomy. Use o menu abaixo para ver mais detalhes.`
    )
    .addFields(
      {
        name: "💰 Patrimônio",
        value: formatarDinheiro(userData.saldo || 0),
        inline: true,
      },
      {
        name: "🎰 Fichas de Cassino",
        value: `${casinoChips} fichas`,
        inline: true,
      },
      {
        name: "🏆 Ranking Global",
        value: rankingInfo ? `#${rankingInfo.position}` : "Não classificado",
        inline: true,
      },
      {
        name: `${moralityEmoji} Reputação`,
        value: `${moralityTitle} (${morality})`,
        inline: true,
      }
    )
    .setFooter({
      text: `ID: ${targetUser.id} • Use o menu para ver mais detalhes`,
    })
    .setTimestamp();

  // Adicionar informação educacional se disponível
  if (educationInfo && educationInfo.current) {
    embed.addFields({
      name: "🎓 Educação Atual",
      value: `${educationInfo.current.icon} ${educationInfo.current.name}${
        educationInfo.current.areaName
          ? ` - ${educationInfo.current.areaName}`
          : ""
      } (${educationInfo.current.progress}%)`,
      inline: true,
    });
  } else if (
    educationInfo &&
    educationInfo.completed &&
    educationInfo.completed.length > 0
  ) {
    const lastCompleted =
      educationInfo.completed[educationInfo.completed.length - 1];
    embed.addFields({
      name: "🎓 Último Diploma",
      value: `${lastCompleted.icon} ${lastCompleted.name}${
        lastCompleted.areaName ? ` - ${lastCompleted.areaName}` : ""
      }`,
      inline: true,
    });
  } else {
    embed.addFields({
      name: "🎓 Educação",
      value: "Sem estudos iniciados",
      inline: true,
    });
  }

  // Número de diplomas
  if (
    educationInfo &&
    educationInfo.completed &&
    educationInfo.completed.length > 0
  ) {
    embed.addFields({
      name: "🏫 Diplomas",
      value: `${educationInfo.completed.length} formação(ões) concluída(s)`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Cria o embed de informações educacionais
 */
async function createEducationEmbed(targetUser, educationInfo) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db) // Azul para educação
    .setTitle(`🎓 Perfil Educacional de ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }));

  // Verificar se educationInfo existe e possui estrutura válida
  if (!educationInfo) {
    embed.setDescription(
      "Não foi possível obter dados educacionais. Tente novamente mais tarde."
    );
    return embed;
  }

  // Adicionar informação de curso atual
  if (educationInfo.current) {
    const current = educationInfo.current;

    let description = `${current.icon} **Cursando**: ${current.name}`;
    if (current.areaName) {
      description += ` - ${current.areaName}`;
    }
    description += `\n📊 **Progresso**: ${current.currentPoints}/${current.requiredPoints} pontos (${current.progress}%)`;

    // Adicionar barra de progresso visual
    const progressBarLength = 20;
    const filledLength = Math.round(
      (current.progress / 100) * progressBarLength
    );
    const progressBar =
      "█".repeat(filledLength) + "░".repeat(progressBarLength - filledLength);

    description += `\n${progressBar}`;

    embed.setDescription(description);

    // Adicionar informações de próximo exame, se houver
    if (educationInfo.nextExamDate) {
      const examDate = new Date(educationInfo.nextExamDate);
      const now = new Date();
      const examDue = examDate <= now;

      embed.addFields({
        name: examDue ? "⚠️ Exame Pendente" : "📝 Próximo Exame",
        value: examDue
          ? "Você precisa fazer um exame! Use o comando `/exame`."
          : `Agendado para ${examDate.toLocaleDateString("pt-BR")}`,
        inline: false,
      });
    }
  } else {
    embed.setDescription(
      "Você não está matriculado em nenhum nível educacional. Use `/nivel-educacional matricular` para se matricular em um curso."
    );
  }

  // Adicionar informações de bolsa, se houver
  if (educationInfo.scholarship) {
    const grantedDate = new Date(
      educationInfo.scholarship.grantedAt
    ).toLocaleDateString("pt-BR");

    embed.addFields({
      name: "🎯 Bolsa de Estudos",
      value: `Desconto de ${educationInfo.scholarship.discount}% em matrículas (Concedida em ${grantedDate})`,
      inline: false,
    });
  }

  // Adicionar formações concluídas
  if (educationInfo.completed && educationInfo.completed.length > 0) {
    let completedText = educationInfo.completed
      .map((level) => {
        if (!level || !level.completedAt) return null;

        const completionDate = new Date(level.completedAt).toLocaleDateString(
          "pt-BR"
        );
        let text = `${level.icon || "🎓"} ${level.name || "Formação"}`;
        if (level.areaName) {
          text += ` - ${level.areaName}`;
        }
        text += ` (${completionDate})`;
        return text;
      })
      .filter((text) => text !== null)
      .join("\n");

    embed.addFields({
      name: "🏆 Formações Concluídas",
      value: completedText || "Nenhuma formação concluída ainda.",
      inline: false,
    });
  } else {
    embed.addFields({
      name: "🏆 Formações Concluídas",
      value: "Nenhuma formação concluída ainda.",
      inline: false,
    });
  }

  embed
    .setFooter({ text: `Use /nivel-educacional para gerenciar sua educação` })
    .setTimestamp();

  return embed;
}

/**
 * Cria o embed de informações de moralidade
 */
async function createMoralityEmbed(targetUser, morality, userData) {
  // Obter informações detalhadas de moralidade
  const { title, emoji } = moralityService.getMoralityTitle(morality);
  const color = moralityService.getMoralityColor(morality);

  // Efeitos de moralidade em diferentes ações
  const trabalharEffects = moralityService.calculateMoralityEffects(
    morality,
    "trabalhar"
  );
  const crimeEffects = moralityService.calculateMoralityEffects(
    morality,
    "crime"
  );
  const roubarEffects = moralityService.calculateMoralityEffects(
    morality,
    "roubar"
  );

  // Obter estatísticas de ações morais
  let stats = {
    goodActions: 0,
    badActions: 0,
    neutralActions: 0,
    actions: {},
  };

  try {
    const database = getDatabase();
    const statsRef = ref(database, `users/${targetUser.id}/moralStats`);
    const snapshot = await get(statsRef);

    if (snapshot && snapshot.exists()) {
      stats = snapshot.val() || stats;
    }
  } catch (error) {
    console.error("Erro ao acessar estatísticas de moralidade:", error);
  }

  // Criar a barra de progresso de moralidade
  let progressBar = "";
  const progressBarLength = 20;

  // Normalizar a moralidade para 0-20
  const normalizedValue = Math.round(
    ((morality + 100) / 200) * progressBarLength
  );

  // Para valores positivos (10-20)
  if (normalizedValue > 10) {
    progressBar += "▓".repeat(10); // Parte neutra sempre preenchida
    progressBar += "█".repeat(normalizedValue - 10); // Parte positiva
    progressBar += "░".repeat(progressBarLength - normalizedValue); // Restante vazio
  }
  // Para valores negativos (0-10)
  else {
    progressBar += "█".repeat(normalizedValue); // Parte preenchida
    progressBar += "░".repeat(10 - normalizedValue); // Parte neutra vazia
    progressBar += "░".repeat(10); // Parte positiva vazia
  }

  // Formatar as ações mais frequentes
  let topActions = "Nenhuma ação registrada";
  if (stats.actions && Object.keys(stats.actions).length > 0) {
    // Mapear emojis para ações
    const actionEmojis = {
      trabalhar: "💼",
      crime: "🔪",
      seduzir: "💋",
      roubar: "🔫",
      pix: "💸",
    };

    // Obter top 3 ações
    const actionsArray = Object.entries(stats.actions)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (actionsArray && actionsArray.length > 0) {
      topActions = actionsArray
        .map(
          (item) =>
            `${actionEmojis[item.action] || "📋"} ${item.action}: ${
              item.count
            }x`
        )
        .join("\n");
    }
  }

  // Criar embed
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} Reputação de ${targetUser.username}`)
    .setDescription(
      `**"${title}"**\n**Moralidade:** ${morality}\n\n**Vilão** ${progressBar} **Herói**`
    )
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: "💰 Patrimônio",
        value: formatarDinheiro(userData.saldo || 0),
        inline: true,
      },
      {
        name: "📊 Estatísticas Morais",
        value: `Ações Boas: ${stats.goodActions || 0}\nAções Ruins: ${
          stats.badActions || 0
        }\nAções Neutras: ${stats.neutralActions || 0}`,
        inline: true,
      },
      {
        name: "🏆 Ações Mais Frequentes",
        value: topActions,
        inline: false,
      },
      {
        name: "💼 Efeito em Trabalhar",
        value: `Multiplicador: ${(trabalharEffects.multiplier * 100).toFixed(
          0
        )}%${
          trabalharEffects.description
            ? `\n(${trabalharEffects.description})`
            : ""
        }`,
        inline: true,
      },
      {
        name: "🔪 Efeito em Crime",
        value: `Multiplicador: ${(crimeEffects.multiplier * 100).toFixed(0)}%${
          crimeEffects.description ? `\n(${crimeEffects.description})` : ""
        }`,
        inline: true,
      },
      {
        name: "🔫 Efeito em Roubar",
        value:
          roubarEffects.successChanceBonus > 0
            ? `+${(roubarEffects.successChanceBonus * 100).toFixed(
                1
              )}% chance de sucesso`
            : "Sem bônus",
        inline: true,
      }
    )
    .setFooter({ text: `Use /moralidade para mais detalhes` })
    .setTimestamp();

  return embed;
}

/**
 * Cria o embed de informações de cassino
 */
async function createCasinoEmbed(targetUser, casinoChips, userId) {
  // Valores padrão para as estatísticas
  let stats = {
    gamesPlayed: 0,
    totalBets: 0,
    winnings: 0,
    losses: 0,
  };

  try {
    const database = getDatabase();
    const statsRef = ref(database, `users/${userId}/stats/casino`);
    const snapshot = await get(statsRef);

    if (snapshot && snapshot.exists()) {
      stats = snapshot.val() || stats;
    }
  } catch (error) {
    console.error("Erro ao acessar estatísticas de cassino:", error);
  }

  // Calcular estatísticas derivadas com segurança
  const totalGamesPlayed = stats.gamesPlayed || 0;
  const totalBets = stats.totalBets || 0;
  const totalWinnings = stats.winnings || 0;
  const totalLosses = stats.losses || 0;
  const netProfit = totalWinnings - totalLosses;

  // Calcular ROI e winRate com proteção contra divisão por zero
  let roi = "0.0";
  if (totalBets > 0) {
    roi = ((netProfit / totalBets) * 100).toFixed(1);
  }

  let winRate = "0.0";
  if (totalBets > 0) {
    winRate = ((totalWinnings / totalBets) * 100).toFixed(1);
  }

  // Criar embed
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f) // Dourado para cassino
    .setTitle(`🎰 Perfil de Cassino de ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `Estatísticas de jogo e informações sobre suas atividades no cassino.`
    )
    .addFields(
      {
        name: "🎟️ Fichas Atuais",
        value: `${casinoChips} fichas`,
        inline: true,
      },
      {
        name: "💸 Valor Estimado",
        value: formatarDinheiro(casinoChips * 10),
        inline: true,
      },
      {
        name: "🎮 Jogos Jogados",
        value: `${totalGamesPlayed}`,
        inline: true,
      },
      {
        name: "💰 Total Apostado",
        value: `${totalBets} fichas`,
        inline: true,
      },
      {
        name: "💵 Total Ganho",
        value: `${totalWinnings} fichas`,
        inline: true,
      },
      {
        name: "📉 Total Perdido",
        value: `${totalLosses} fichas`,
        inline: true,
      },
      {
        name: "📊 Lucro/Prejuízo",
        value: `${netProfit > 0 ? "+" : ""}${netProfit} fichas`,
        inline: true,
      },
      {
        name: "📈 ROI",
        value: `${roi}%`,
        inline: true,
      },
      {
        name: "🎯 Taxa de Vitória",
        value: `${winRate}%`,
        inline: true,
      }
    )
    .setFooter({
      text: `Use os comandos de cassino para jogar: /blackjack, /dados, /roleta, /slots`,
    })
    .setTimestamp();

  return embed;
}
