// trabalhar.js - Com sistema de moralidade integrado
import { SlashCommandBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import geminiClient from "../services/gemini.js";
import economicsUtils from "../utils/economics.js";
import embedUtils from "../utils/embed.js";
import moralityService from "../services/morality.js";
import config from "../../config/config.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("trabalhar")
  .setDescription("Trabalhe para ganhar dinheiro");

export async function execute(interaction) {
  try {
    await interaction.deferReply(); // Defer a resposta para evitar timeout

    const userId = interaction.user.id;

    // Verificar cooldown
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "trabalhar",
      config.cooldown.trabalhar * 60000
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "trabalhar",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter a moralidade atual do usuário
    const morality = await moralityService.getMorality(userId);

    // Calcular valor base ganho
    const valorBase = economicsUtils.calcularValorTrabalhar();

    // Aplicar efeitos de moralidade ao valor (heróis têm bônus)
    const moralityEffects = moralityService.calculateMoralityEffects(
      morality,
      "trabalhar"
    );

    // Ajustar o valor com o multiplicador de moralidade
    const valor = Math.floor(valorBase * moralityEffects.multiplier);

    // Determinar se houve bônus ou penalidade por moralidade
    let moralityDescription = "";
    if (moralityEffects.description) {
      moralityDescription = `\n${moralityEffects.description}`;
    }

    // Atualizar a moralidade (trabalho honesto é positivo)
    await moralityService.updateMoralityForAction(userId, "trabalhar");

    // Atualizar saldo no Firebase
    const novoSaldo = await firebaseService.updateUserBalance(userId, valor);

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "trabalhar");

    // Gerar resposta criativa com a Gemini API
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaTrabalhar(valor);

      // Adicionar efeito de moralidade à resposta se houver
      if (moralityDescription) {
        conteudo += moralityDescription;
      }
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = `Você trabalhou duro e ganhou ${formatarDinheiro(
        valor
      )}.${moralityDescription}`;
    }

    // Criar embed
    const embed = embedUtils.criarEmbedEconomia({
      usuario: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
      conteudo,
      valor,
      novoSaldo,
      comando: "trabalhar",
    });

    // Adicionar informações de moralidade ao embed
    const { title, emoji } = moralityService.getMoralityTitle(morality);
    embed.addFields({
      name: `${emoji} Reputação`,
      value: `${title} (${morality})`,
      inline: true,
    });

    // Adicionar informações de bônus se aplicável
    if (moralityEffects.multiplier > 1) {
      const bonusPercentage = ((moralityEffects.multiplier - 1) * 100).toFixed(
        0
      );
      embed.addFields({
        name: "✨ Bônus de Reputação",
        value: `+${bonusPercentage}% por ser honesto`,
        inline: true,
      });
    } else if (moralityEffects.multiplier < 1) {
      const penaltyPercentage = (
        (1 - moralityEffects.multiplier) *
        100
      ).toFixed(0);
      embed.addFields({
        name: "⚠️ Penalidade de Reputação",
        value: `-${penaltyPercentage}% por má conduta`,
        inline: true,
      });
    }

    // Enviar resposta
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando trabalhar:", error);

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
