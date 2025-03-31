// semanal.js - Recompensa semanal com quantidade maior de fichas e dinheiro
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import inventoryService from "../services/inventory.js";
import geminiClient from "../services/gemini.js";
import embedUtils from "../utils/embed.js";
import moralityService from "../services/morality.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("semanal")
  .setDescription(
    "Colete sua recompensa semanal de fichas e dinheiro (maior que a diária)"
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Verificar cooldown (7 dias = 604800000 ms)
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "semanal",
      604800000
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "semanal",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter dados do usuário
    const userData = await firebaseService.getUserData(userId);

    // Verificar streak de semanas
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);

    // Obter semana atual (número da semana no ano)
    const getWeekNumber = (d) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
      const week1 = new Date(date.getFullYear(), 0, 4);
      return (
        1 +
        Math.round(
          ((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
      );
    };

    const semanaAtual = `${now.getFullYear()}-${getWeekNumber(now)}`;
    const semanaAnterior = `${lastWeek.getFullYear()}-${getWeekNumber(
      lastWeek
    )}`;

    const ultimaColeta = userData.ultimaColetaSemanal || "";
    let streak = userData.streakSemanal || 0;

    // Verificar se o usuário coletou na semana anterior para manter o streak
    if (ultimaColeta === semanaAnterior) {
      streak++;
    } else if (ultimaColeta !== semanaAtual) {
      // Se não coletou nesta semana ainda, resetar streak
      streak = 1;
    }

    // Calcular recompensas
    // Recompensa base em dinheiro: 500 + (100 * streak), max 1500
    const recompensaDinheiro = Math.min(500 + 100 * streak, 1500);

    // Não dá mais fichas de cassino
    const recompensaFichas = 0;

    // Bônus de moralidade
    const morality = await moralityService.getMorality(userId);
    let bonusMoralidade = 0;
    let descricaoBonusMoralidade = "";

    // Heróis recebem até 25% extra, vilões nada
    if (morality > 0) {
      // Calcular bônus baseado na moralidade (até 25% para moralidade 100)
      bonusMoralidade = Math.floor(recompensaDinheiro * (morality / 400));
      if (bonusMoralidade > 0) {
        descricaoBonusMoralidade = `(+${formatarDinheiro(
          bonusMoralidade
        )} por boa reputação)`;
      }
    }

    // Aplicar recompensas
    const novoSaldo = await firebaseService.updateUserBalance(
      userId,
      recompensaDinheiro + bonusMoralidade
    );

    // Obter as fichas atuais sem adicionar novas
    const novasFichas = await inventoryService.getCasinoChips(userId);

    // Atualizar dados de streak
    await firebaseService.updateStreak(userId, {
      tipo: "semanal",
      valor: streak,
      ultimaColeta: semanaAtual,
    });

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "semanal");

    // Obter mensagem criativa da API Gemini
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaSemanal(
        recompensaDinheiro,
        streak
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = `Você coletou sua recompensa semanal: ${formatarDinheiro(
        recompensaDinheiro + bonusMoralidade
      )}. Volte na próxima semana para manter seu streak de ${streak} semanas!`;
    }

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Dourado
      .setTitle("🎁 Recompensa Semanal")
      .setDescription(conteudo)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "💰 Dinheiro Recebido",
          value: `${formatarDinheiro(
            recompensaDinheiro
          )} ${descricaoBonusMoralidade}`,
          inline: true,
        },
        {
          name: "📅 Semanas Consecutivas",
          value: `${streak} semana${streak !== 1 ? "s" : ""} de coleta`,
          inline: true,
        },
        {
          name: "🔥 Streak Atual",
          value: `${streak} semana${streak !== 1 ? "s" : ""}`,
          inline: true,
        },
        {
          name: "💰 Saldo Atual",
          value: formatarDinheiro(novoSaldo),
          inline: true,
        },
        {
          name: "🎰 Fichas Atuais",
          value: `${novasFichas} fichas`,
          inline: true,
        }
      )
      .setFooter({ text: `Próxima coleta disponível em 7 dias` })
      .setTimestamp();

    // Adicionar informações de moralidade
    const { title, emoji } = moralityService.getMoralityTitle(morality);
    embed.addFields({
      name: `${emoji} Reputação`,
      value: `${title} (${morality})`,
      inline: true,
    });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando semanal:", error);

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
