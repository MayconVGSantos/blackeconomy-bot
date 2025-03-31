// seduzir.js - Com sistema de moralidade integrado
import { SlashCommandBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import geminiClient from "../services/gemini.js";
import economicsUtils from "../utils/economics.js";
import embedUtils from "../utils/embed.js";
import moralityService from "../services/morality.js";
import config from "../../config/config.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("seduzir")
  .setDescription("Tente seduzir alguém para ganhar dinheiro");

export async function execute(interaction) {
  try {
    await interaction.deferReply(); // Defer a resposta para evitar timeout

    const userId = interaction.user.id;

    // Verificar cooldown
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "seduzir",
      config.cooldown.seduzir * 60000
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "seduzir",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter a moralidade atual do usuário
    const morality = await moralityService.getMorality(userId);

    // Calcular valor e resultado
    const { valor: valorBase, ganhou } = economicsUtils.calcularValorSeduzir();

    // Aplicar efeitos de moralidade (efeito neutro para seduzir, então usa o valor base)
    let valor = valorBase;

    // Atualizar a moralidade (seduzir é levemente negativo)
    await moralityService.updateMoralityForAction(userId, "seduzir", ganhou);

    // Atualizar saldo no Firebase
    const novoSaldo = await firebaseService.updateUserBalance(userId, valor);

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "seduzir");

    // Gerar resposta criativa com a Gemini API
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaSeduzir(
        Math.abs(valor),
        ganhou
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = ganhou
        ? `Você seduziu alguém e ganhou ${formatarDinheiro(Math.abs(valor))}.`
        : `Você tentou seduzir alguém, mas falhou e perdeu ${formatarDinheiro(
            Math.abs(valor)
          )}.`;
    }

    // Criar embed
    const embed = embedUtils.criarEmbedEconomia({
      usuario: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
      conteudo,
      valor,
      novoSaldo,
      ganhou,
      comando: "seduzir",
    });

    // Adicionar informações de moralidade ao embed
    const { title, emoji } = moralityService.getMoralityTitle(morality);
    embed.addFields({
      name: `${emoji} Reputação`,
      value: `${title} (${morality})`,
      inline: true,
    });

    // Diminuição de moralidade notificação (opcional)
    if (morality > 20) {
      embed.addFields({
        name: `⚠️ Aviso de Reputação`,
        value: `Seduzir pessoas por dinheiro afeta levemente sua reputação.`,
        inline: false,
      });
    }

    // Enviar resposta
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando seduzir:", error);

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
