// roubar.js
import { SlashCommandBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import geminiClient from "../services/gemini.js";
import embedUtils from "../utils/embed.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
  .setName("roubar")
  .setDescription("Tenta roubar dinheiro de outro usuário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário que você quer roubar")
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("usuario");
    const userId = interaction.user.id;

    // Não permitir roubar a si mesmo
    if (targetUser.id === userId) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Tentativa Inválida",
        mensagem: "Você não pode roubar de si mesmo.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar se o bot não é alvo
    if (targetUser.bot) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Tentativa Inválida",
        mensagem: "Você não pode roubar de um bot.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Verificar cooldown
    const cooldownCheck = await firebaseService.checkCooldown(
      userId,
      "roubar",
      config.cooldown.roubar * 60000 || 60 * 60000 // 60 minutos padrão se não estiver configurado
    );

    if (cooldownCheck.emCooldown) {
      const embedCooldown = embedUtils.criarEmbedCooldown({
        usuario: interaction.user.username,
        comando: "roubar",
        tempoRestante: cooldownCheck.tempoRestante,
      });

      return interaction.editReply({ embeds: [embedCooldown] });
    }

    // Obter dados dos usuários
    const userData = await firebaseService.getUserData(userId);
    const targetData = await firebaseService.getUserData(targetUser.id);

    // Verificar se a vítima tem dinheiro
    if (targetData.saldo <= 0) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Vítima Sem Dinheiro",
        mensagem: `${targetUser.username} não tem dinheiro para ser roubado.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Calcular probabilidade de sucesso baseada no patrimônio líquido
    // Quanto maior seu patrimônio em relação à vítima, menor a chance de sucesso
    let probabilidadeSucesso =
      userData.saldo / (targetData.saldo + userData.saldo);

    // Limitar entre 20% e 80%
    probabilidadeSucesso = Math.max(0.2, Math.min(0.8, probabilidadeSucesso));

    // Determinar se o roubo foi bem-sucedido
    const sucesso = Math.random() <= 1 - probabilidadeSucesso;

    // Determinar o valor roubado/multa
    let valor = 0;

    if (sucesso) {
      // Se bem-sucedido, rouba uma quantia baseada na probabilidade de sucesso
      valor = Math.floor(targetData.saldo * (Math.random() * 0.3 + 0.1)); // 10-40% do dinheiro da vítima
      valor = Math.min(valor, targetData.saldo); // Não roubar mais do que a vítima tem
    } else {
      // Se falhar, paga uma multa baseada no crime
      const multaBase = config.economia.crime.perda.max * valor;
      valor = Math.floor(userData.saldo * (Math.random() * 0.2 + 0.1)); // 10-30% do seu dinheiro como multa
      valor = Math.min(valor, userData.saldo); // Não pagar mais do que tem
    }

    // Registrar cooldown
    await firebaseService.setCooldown(userId, "roubar");

    let novoSaldoLadrao, novoSaldoVitima;

    if (sucesso) {
      // Roubo bem-sucedido: transferir dinheiro da vítima para o ladrão
      novoSaldoVitima = await firebaseService.updateUserBalance(
        targetUser.id,
        -valor
      );
      novoSaldoLadrao = await firebaseService.updateUserBalance(userId, valor);
    } else {
      // Roubo falhou: ladrão paga multa
      novoSaldoLadrao = await firebaseService.updateUserBalance(userId, -valor);
    }

    // Gerar resposta criativa com a API Gemini
    let conteudo;
    try {
      conteudo = await geminiClient.gerarRespostaRoubo(
        valor,
        sucesso,
        targetUser.username
      );
    } catch (error) {
      console.error("Erro ao gerar resposta com Gemini:", error);
      conteudo = sucesso
        ? `Você roubou R$${valor.toFixed(2)} de ${targetUser.username}.`
        : `Você foi pego tentando roubar ${
            targetUser.username
          } e pagou uma multa de R$${valor.toFixed(2)}.`;
    }

    // Criar embed
    let embed;
    if (sucesso) {
      embed = embedUtils.criarEmbedRoubo({
        usuario: interaction.user.username,
        avatarURL: interaction.user.displayAvatarURL(),
        alvo: targetUser.username,
        alvoAvatarURL: targetUser.displayAvatarURL(),
        conteudo,
        valor,
        novoSaldoLadrao,
        novoSaldoVitima,
        sucesso: true,
      });
    } else {
      embed = embedUtils.criarEmbedRoubo({
        usuario: interaction.user.username,
        avatarURL: interaction.user.displayAvatarURL(),
        alvo: targetUser.username,
        alvoAvatarURL: targetUser.displayAvatarURL(),
        conteudo,
        valor,
        novoSaldoLadrao,
        sucesso: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando roubar:", error);

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
