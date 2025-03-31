// estudar.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import educationService from "../services/education.js";
import geminiClient from "../services/gemini.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";
import moralityService from "../services/morality.js";

export const data = new SlashCommandBuilder()
  .setName("estudar")
  .setDescription("Estuda para avançar em seu nível educacional");

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Verificar se o usuário já tem dados educacionais
    const educationData = await educationService.getUserEducation(userId);

    // Verificar se há um nível educacional atual
    if (!educationData.currentLevel) {
      const availableLevels = await educationService.getNextAvailableLevels(
        userId
      );

      // Criar embed de informação
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📚 Sistema Educacional")
        .setDescription(
          "Você não está matriculado em nenhum nível educacional. Use o comando `/nivel-educacional` para ver os níveis disponíveis e se matricular."
        )
        .addFields({
          name: "🎓 Próximos Níveis Disponíveis",
          value:
            availableLevels.length > 0
              ? availableLevels
                  .map(
                    (level) =>
                      `${level.icon} ${level.name} - Custo: ${formatarDinheiro(
                        level.cost
                      )}`
                  )
                  .join("\n")
              : "Nenhum nível disponível no momento.",
          inline: false,
        })
        .setFooter({ text: `Requisitado por ${interaction.user.username}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // Tentar estudar
    const result = await educationService.study(userId);

    if (!result.success) {
      if (result.error === "cooldown") {
        // Calcular tempo restante de forma legível
        const hours = Math.floor(result.timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor(
          (result.timeRemaining % (60 * 60 * 1000)) / (60 * 1000)
        );

        const embedCooldown = embedUtils.criarEmbedCooldown({
          usuario: interaction.user.username,
          comando: "estudar",
          tempoRestante: result.timeRemaining,
        });

        return interaction.editReply({ embeds: [embedCooldown] });
      }

      // Outro erro
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro ao Estudar",
        mensagem:
          "Ocorreu um erro ao processar seu estudo. Tente novamente mais tarde.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Obter informações sobre o nível educacional atual
    const levelData = educationService.EDUCATION_LEVELS[result.currentLevel];
    const requiredPoints = levelData.points;
    const selectedArea = educationData.selectedArea;

    // Gerar resposta criativa com a API Gemini
    let conteudo;
    try {
      conteudo = await geminiClient.generateResponse(
        `Crie uma resposta curta, engraçada e motivacional para um estudante que ganhou ${
          result.studyPoints
        } pontos de estudo para ${levelData.name}${
          selectedArea && levelData.areas
            ? ` em ${levelData.areas[selectedArea].name}`
            : ""
        }. A mensagem deve ser em português brasileiro e limite a resposta a 1-2 frases curtas.`
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = `Você estudou e ganhou ${result.studyPoints} pontos!`;
    }

    // Criar embed de resultado
    const embed = new EmbedBuilder()
      .setColor(0x4dff4d) // Verde claro
      .setTitle(`📚 ${levelData.icon} Estudo Diário`)
      .setDescription(conteudo)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "📝 Pontos Ganhos",
          value: `+${result.studyPoints}`,
          inline: true,
        },
        {
          name: "📊 Progresso",
          value: `${
            result.currentPoints
          }/${requiredPoints} pontos (${Math.floor(
            (result.currentPoints / requiredPoints) * 100
          )}%)`,
          inline: true,
        },
        {
          name: "🔥 Sequência de Estudo",
          value: `${result.streak} dia${result.streak !== 1 ? "s" : ""}`,
          inline: true,
        }
      )
      .setFooter({
        text: result.examRequired
          ? "⚠️ Você precisa fazer um exame! Use o comando /exame"
          : "Próximo estudo disponível em 24 horas",
      })
      .setTimestamp();

    // Adicionar barra de progresso visual
    const progressBarLength = 20;
    const filledLength = Math.round(
      (result.currentPoints / requiredPoints) * progressBarLength
    );
    const progressBar =
      "█".repeat(filledLength) + "░".repeat(progressBarLength - filledLength);

    embed.addFields({
      name: "📈 Barra de Progresso",
      value: `${progressBar} ${Math.floor(
        (result.currentPoints / requiredPoints) * 100
      )}%`,
      inline: false,
    });

    // Se o nível estiver completado, adicionar mensagem
    if (result.levelCompleted) {
      embed.addFields({
        name: "🎓 Nível Completado!",
        value:
          "Você atingiu pontos suficientes para completar este nível educacional! Use o comando `/nivel-educacional` para receber seu diploma.",
        inline: false,
      });
    }

    // Se um exame for necessário, adicionar aviso
    if (result.examRequired) {
      embed.addFields({
        name: "⚠️ Exame Necessário",
        value:
          "Você atingiu o ponto de fazer um exame! Use o comando `/exame` para avançar em seus estudos.",
        inline: false,
      });
    }

    // Adicionar informações de moralidade
    const morality = await moralityService.getMorality(userId);
    const { title, emoji } = moralityService.getMoralityTitle(morality);

    embed.addFields({
      name: `${emoji} Reputação`,
      value: `${title} (${morality})`,
      inline: true,
    });

    // Enviar resposta
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando estudar:", error);

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
