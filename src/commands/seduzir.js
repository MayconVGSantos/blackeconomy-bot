// seduzir.js
import { SlashCommandBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import geminiClient from "../services/gemini.js";
import economicsUtils from "../utils/economics.js";
import embedUtils from "../utils/embed.js";
import config from "../../config/config.js";

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

    // Calcular valor e resultado
    const { valor, ganhou } = economicsUtils.calcularValorSeduzir();

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
        ? `Você seduziu alguém e ganhou R$${Math.abs(valor).toFixed(2)}.`
        : `Você tentou seduzir alguém, mas falhou e perdeu R$${Math.abs(
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
      comando: "seduzir",
    });

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
