// diario.js - Recompensa diária em fichas e dinheiro
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import inventoryService from "../services/inventory.js";
import geminiClient from "../services/gemini.js";
import embedUtils from "../utils/embed.js";
import moralityService from "../services/morality.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("diario")
  .setDescription("Colete sua recompensa diária de fichas e dinheiro");

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Verificar cooldown (24 horas = 86400000 ms)
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "diario",
      86400000
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "diario",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter dados do usuário
    const userData = await firebaseService.getUserData(userId);

    // Verificar racha de dias (streak)
    const now = new Date();
    const ontem = new Date(now);
    ontem.setDate(ontem.getDate() - 1);

    // Formato de data: AAAA-MM-DD para comparação simples
    const hoje = now.toISOString().split("T")[0];
    const ontemFormatado = ontem.toISOString().split("T")[0];

    const ultimaColeta = userData.ultimaColetaDiaria || "";
    let streak = userData.streakDiaria || 0;

    // Verificar se o usuário coletou ontem para manter o streak
    if (ultimaColeta === ontemFormatado) {
      streak++;
    } else if (ultimaColeta !== hoje) {
      // Se não coletou hoje e nem ontem, resetar o streak
      streak = 1;
    }

    // Calcular recompensas
    // Recompensa em dinheiro: 100 + (15 * streak), max 400
    const recompensaDinheiro = Math.min(100 + 15 * streak, 400);

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
      tipo: "diario",
      valor: streak,
      ultimaColeta: hoje,
    });

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "diario");

    // Obter mensagem criativa da API Gemini
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaDiario(
        recompensaDinheiro,
        streak
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = `Você coletou sua recompensa diária: ${formatarDinheiro(
        recompensaDinheiro + bonusMoralidade
      )}. Volte amanhã para manter seu streak de ${streak} dias!`;
    }

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0x4dff4d) // Verde claro
      .setTitle("🎁 Recompensa Diária")
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
          name: "⏱️ Dias Consecutivos",
          value: `${streak} dia${streak !== 1 ? "s" : ""} de coleta`,
          inline: true,
        },
        {
          name: "🔥 Streak Atual",
          value: `${streak} dia${streak !== 1 ? "s" : ""}`,
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
      .setFooter({ text: `Próxima coleta disponível em 24 horas` })
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
    console.error("Erro ao executar comando diario:", error);

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
