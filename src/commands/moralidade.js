// moralidade.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import moralityService from "../services/morality.js";
import firebaseService from "../services/firebase.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("moralidade")
  .setDescription("Mostra seu nível de moralidade e reputação")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver a moralidade (opcional)")
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

    // Obter moralidade do usuário
    const morality = await moralityService.getMorality(userId);

    // Obter título baseado na moralidade
    const { title, emoji } = moralityService.getMoralityTitle(morality);

    // Obter estatísticas de ações morais
    const database = getDatabase();
    const statsRef = ref(database, `users/${userId}/moralStats`);
    const snapshot = await get(statsRef);
    const stats = snapshot.exists()
      ? snapshot.val()
      : {
          goodActions: 0,
          badActions: 0,
          neutralActions: 0,
          actions: {},
        };

    // Obter dados do usuário (saldo)
    const userData = await firebaseService.getUserData(userId);

    // Calcular efeitos da moralidade em diferentes ações
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

    // Criar a barra de progresso de moralidade (20 caracteres)
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

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(moralityService.getMoralityColor(morality))
      .setTitle(`${emoji} Reputação de ${targetUser.username}`)
      .setDescription(
        `**"${title}"**\n**Moralidade:** ${morality}\n\n**Vilão** ${progressBar} **Herói**`
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
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
          value: getTopActions(stats.actions),
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
          value: `Multiplicador: ${(crimeEffects.multiplier * 100).toFixed(
            0
          )}%${
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
      .setFooter({
        text: isOwnProfile
          ? "Sua moralidade muda com suas ações!"
          : "A moralidade muda com as ações!",
      })
      .setTimestamp();

    // Adicionar dica de como melhorar a moralidade
    if (morality < 0) {
      embed.addFields({
        name: "💡 Como melhorar sua reputação",
        value:
          "Trabalhe mais e cometa menos crimes para melhorar sua reputação na sociedade.",
        inline: false,
      });
    } else if (morality > 0) {
      embed.addFields({
        name: "💡 Mantenha sua boa reputação",
        value:
          "Continue trabalhando honestamente para manter sua boa reputação e receber bônus!",
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando moralidade:", error);
    return interaction.editReply(
      "Ocorreu um erro ao verificar sua moralidade. Tente novamente mais tarde."
    );
  }
}

/**
 * Formata as ações mais frequentes do usuário para exibição
 * @param {Object} actions - Objeto com contadores de ações
 * @returns {string} - String formatada para o embed
 */
function getTopActions(actions) {
  if (!actions) return "Nenhuma ação registrada";

  // Mapear ações para array
  const actionsArray = Object.entries(actions).map(([action, count]) => ({
    action,
    count,
  }));

  // Ordenar por contagem (decrescente)
  actionsArray.sort((a, b) => b.count - a.count);

  // Mapear emojis para ações
  const actionEmojis = {
    trabalhar: "💼",
    crime: "🔪",
    seduzir: "💋",
    roubar: "🔫",
    pix: "💸",
  };

  // Formatar as 3 ações mais frequentes
  return (
    actionsArray
      .slice(0, 3)
      .map(
        (item) =>
          `${actionEmojis[item.action] || "📋"} ${item.action}: ${item.count}x`
      )
      .join("\n") || "Nenhuma ação registrada"
  );
}

// Importar funções do Firebase (para não ter importação circular)
import { getDatabase, ref, get } from "firebase/database";
