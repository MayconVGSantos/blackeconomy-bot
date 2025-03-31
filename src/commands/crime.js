// crime.js - Com sistema de moralidade integrado
import { SlashCommandBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import geminiClient from "../services/gemini.js";
import economicsUtils from "../utils/economics.js";
import embedUtils from "../utils/embed.js";
import moralityService from "../services/morality.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
  .setName("crime")
  .setDescription("Cometa um crime para tentar ganhar dinheiro");

export async function execute(interaction) {
  try {
    await interaction.deferReply(); // Defer a resposta para evitar timeout

    const userId = interaction.user.id;

    // Verificar cooldown
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "crime",
      config.cooldown.crime * 60000
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "crime",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter a moralidade atual do usuário
    const morality = await moralityService.getMorality(userId);

    // Calcular valor e resultado
    const { valor: valorBase, ganhou } = economicsUtils.calcularValorCrime();

    // Aplicar efeitos de moralidade ao valor e chance de sucesso
    let valor = valorBase;
    let moralityEffects = null;
    let moralityDescription = "";

    if (ganhou) {
      // Calcular efeitos de moralidade para o crime (vilões têm bônus)
      moralityEffects = moralityService.calculateMoralityEffects(
        morality,
        "crime"
      );

      // Ajustar o valor com o multiplicador de moralidade
      valor = Math.floor(valorBase * moralityEffects.multiplier);

      if (moralityEffects.description) {
        moralityDescription = `\n${moralityEffects.description}`;
      }
    }

    // Atualizar a moralidade (crime é negativo)
    await moralityService.updateMoralityForAction(userId, "crime", ganhou);

    // Atualizar saldo no Firebase
    const novoSaldo = await firebaseService.updateUserBalance(userId, valor);

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "crime");

    // Gerar resposta criativa com a Gemini API
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaCrime(Math.abs(valor), ganhou);

      // Adicionar efeito de moralidade à resposta se houver
      if (moralityDescription) {
        conteudo += moralityDescription;
      }
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = ganhou
        ? `Você cometeu um crime e lucrou R$${Math.abs(valor).toFixed(
            2
          )}.${moralityDescription}`
        : `Você tentou cometer um crime, mas foi pego e perdeu R$${Math.abs(
            valor
          ).toFixed(2)}.`;
    }

    // Criar embed
    const embed = embedUtils.criarEmbedEconomia({
      usuario: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
      conteudo,
      valor,
      novoSaldo,
      ganhou,
      comando: "crime",
    });

    // Adicionar informações de moralidade ao embed
    const { title, emoji } = moralityService.getMoralityTitle(morality);
    embed.addFields({
      name: `${emoji} Reputação`,
      value: `${title} (${morality})`,
      inline: true,
    });

    // Enviar resposta
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando crime:", error);

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
