// trocar-fichas.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import inventoryService from "../services/inventory.js";
import casinoService from "../services/casino.js";
import embedUtils from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("trocar-fichas")
  .setDescription("Troca fichas de cassino por dinheiro")
  .addIntegerOption((option) =>
    option
      .setName("quantidade")
      .setDescription("Quantidade de fichas para trocar")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const quantidade = interaction.options.getInteger("quantidade");

    // Verificar se o usuário tem fichas suficientes
    const fichasAtuais = await inventoryService.getCasinoChips(userId);

    if (fichasAtuais < quantidade) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Fichas Insuficientes",
        mensagem: `Você tem apenas ${fichasAtuais} fichas. Não é possível trocar ${quantidade} fichas.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Trocar as fichas por dinheiro
    const resultado = await casinoService.exchangeChipsForMoney(
      userId,
      quantidade
    );

    if (!resultado.success) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro na Troca",
        mensagem:
          resultado.error ||
          "Ocorreu um erro ao trocar suas fichas por dinheiro.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Criar embed de sucesso
    const embed = new EmbedBuilder()
      .setColor(0x00ff00) // Verde
      .setTitle("💱 Fichas Trocadas com Sucesso")
      .setDescription(
        `Você trocou **${quantidade} fichas** por **R$${resultado.amount.toFixed(
          2
        )}**.`
      )
      .addFields(
        {
          name: "📊 Taxa de Conversão",
          value: `1 ficha = R$10.00`,
          inline: true,
        },
        {
          name: "💸 Taxa Cobrada",
          value: `R$${resultado.taxa.toFixed(2)} (10%)`,
          inline: true,
        },
        {
          name: "🪙 Fichas Restantes",
          value: `${resultado.newChips}`,
          inline: true,
        },
        {
          name: "💰 Novo Saldo",
          value: `R$${resultado.newBalance.toFixed(2)}`,
          inline: true,
        }
      )
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando trocar-fichas:", error);

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
