// exame.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import educationService from "../services/education.js";
import geminiClient from "../services/gemini.js";
import embedUtils from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("exame")
  .setDescription("Realiza um exame para avançar em seu nível educacional");

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Verificar se o usuário tem dados educacionais
    const educationData = await educationService.getUserEducation(userId);

    // Verificar se há um nível educacional atual
    if (!educationData.currentLevel) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Exame Não Disponível",
        mensagem:
          "Você não está matriculado em nenhum nível educacional. Use o comando `/nivel-educacional matricular` para se matricular.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    const currentLevel = educationData.currentLevel;
    const levelData = educationService.EDUCATION_LEVELS[currentLevel];
    const selectedArea = educationData.selectedArea;
    const areaName =
      selectedArea && levelData.areas
        ? levelData.areas[selectedArea].name
        : null;

    // Verificar se tem pontos suficientes para fazer o exame
    const currentPoints = educationData.currentPoints || 0;
    const requiredPoints = levelData.points * 0.5; // 50% dos pontos necessários

    if (currentPoints < requiredPoints) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Pontos Insuficientes",
        mensagem: `Você precisa de pelo menos ${requiredPoints} pontos para fazer o exame, mas tem apenas ${currentPoints} pontos. Continue estudando com o comando \`/estudar\`.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Criar embed de confirmação
    const embedConfirmacao = new EmbedBuilder()
      .setColor(0xffcc00) // Amarelo
      .setTitle("📝 Realizar Exame")
      .setDescription(
        `Você está prestes a realizar um exame para ${levelData.name}${
          areaName ? ` em ${areaName}` : ""
        }.\n\nSua chance de aprovação é de aproximadamente ${Math.min(
          95,
          50 + (currentPoints / levelData.points) * 50
        ).toFixed(0)}% com base em seu progresso atual (${currentPoints}/${
          levelData.points
        } pontos).`
      )
      .addFields(
        {
          name: "✅ Aprovação",
          value: "Se você passar, receberá +3 pontos de estudo.",
          inline: true,
        },
        {
          name: "❌ Reprovação",
          value: "Se você reprovar, perderá 1 ponto de estudo.",
          inline: true,
        }
      )
      .setFooter({ text: "Deseja prosseguir com o exame?" })
      .setTimestamp();

    // Criar botões de confirmação
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_exam")
        .setLabel("Fazer Exame")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId("cancel_exam")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    const response = await interaction.editReply({
      embeds: [embedConfirmacao],
      components: [row],
    });

    // Criar coletor para os botões
    const collector = response.createMessageComponentCollector({
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

      if (i.customId === "confirm_exam") {
        await i.deferUpdate();
        await handleExam(i, userId, levelData, areaName);
        collector.stop();
      } else if (i.customId === "cancel_exam") {
        // Cancelar exame
        const embedCancelado = new EmbedBuilder()
          .setColor(0x808080) // Cinza
          .setTitle("❌ Exame Cancelado")
          .setDescription("Você optou por não realizar o exame agora.")
          .setFooter({
            text: "Você pode tentar novamente quando estiver preparado.",
          })
          .setTimestamp();

        await i.update({ embeds: [embedCancelado], components: [] });
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        // Timeout sem interação
        const embedTimeout = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Tempo Esgotado",
          mensagem:
            "Você não confirmou o exame a tempo. Use o comando novamente quando estiver pronto.",
        });

        await interaction.editReply({
          embeds: [embedTimeout],
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("Erro ao executar comando exame:", error);

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
 * Manipula o processo de realização do exame
 * @param {Interaction} i - Interação do botão
 * @param {string} userId - ID do usuário
 * @param {Object} levelData - Dados do nível educacional
 * @param {string} areaName - Nome da área (opcional)
 */
async function handleExam(i, userId, levelData, areaName) {
  try {
    // Realizar o exame
    const result = await educationService.takeExam(userId);

    if (!result.success) {
      // Erro ao realizar exame
      const embedErro = embedUtils.criarEmbedErro({
        usuario: i.user.username,
        titulo: "Erro no Exame",
        mensagem:
          "Ocorreu um erro ao realizar o exame. Tente novamente mais tarde.",
      });

      return i.editReply({ embeds: [embedErro], components: [] });
    }

    // Gerar resposta criativa com a API Gemini
    let conteudo;
    try {
      conteudo = await geminiClient.generateResponse(
        `Crie uma resposta curta e criativa sobre ${
          result.passed ? "passar" : "reprovar"
        } em um exame de ${levelData.name}${
          areaName ? ` em ${areaName}` : ""
        }. A mensagem deve ser em português brasileiro, bem-humorada e ${
          result.passed ? "celebrativa" : "consoladora"
        }. Limite a resposta a 1-2 frases curtas.`
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = result.passed
        ? `Parabéns! Você passou no exame de ${levelData.name}!`
        : `Infelizmente você reprovou no exame de ${levelData.name}. Estude mais e tente novamente.`;
    }

    // Criar embed de resultado
    const embed = new EmbedBuilder()
      .setColor(result.passed ? 0x00ff00 : 0xff0000) // Verde para aprovação, vermelho para reprovação
      .setTitle(result.passed ? "✅ Exame Aprovado!" : "❌ Exame Reprovado")
      .setDescription(conteudo)
      .setThumbnail(i.user.displayAvatarURL())
      .addFields(
        {
          name: "📊 Resultado",
          value: result.passed
            ? `Aprovado! (+3 pontos de estudo)`
            : `Reprovado (-1 ponto de estudo)`,
          inline: true,
        },
        {
          name: "🎓 Curso",
          value: `${levelData.name}${areaName ? ` em ${areaName}` : ""}`,
          inline: true,
        },
        {
          name: "📈 Progresso Atual",
          value: `${result.currentPoints}/${
            levelData.points
          } pontos (${Math.floor(
            (result.currentPoints / levelData.points) * 100
          )}%)`,
          inline: false,
        }
      )
      .setFooter({
        text: result.levelCompleted
          ? "Você atingiu pontos suficientes para completar este nível! Use /nivel-educacional concluir para receber seu diploma."
          : "Próximo exame em 10 dias.",
      })
      .setTimestamp();

    // Adicionar barra de progresso visual
    const progressBarLength = 20;
    const progress = Math.floor(
      (result.currentPoints / levelData.points) * 100
    );
    const filledLength = Math.round((progress / 100) * progressBarLength);
    const progressBar =
      "█".repeat(filledLength) + "░".repeat(progressBarLength - filledLength);

    embed.addFields({
      name: "📈 Barra de Progresso",
      value: `${progressBar} ${progress}%`,
      inline: false,
    });

    // Se o nível estiver completado, adicionar mensagem
    if (result.levelCompleted) {
      embed.addFields({
        name: "🎓 Nível Completado!",
        value:
          "Você atingiu pontos suficientes para completar este nível educacional! Use o comando `/nivel-educacional concluir` para receber seu diploma.",
        inline: false,
      });
    }

    return i.editReply({ embeds: [embed], components: [] });
  } catch (error) {
    console.error("Erro ao processar exame:", error);
    throw error;
  }
}
