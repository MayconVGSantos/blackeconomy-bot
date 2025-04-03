// @ts-nocheck
// inventario.js - Versão simplificada sem loja ou usar
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
} from "discord.js";
import inventoryService from "../services/inventory.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("inventario")
  .setDescription("Mostra as fichas de cassino em seu inventário")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para ver o inventário (opcional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnInventory = userId === interaction.user.id;

    // Obter quantidade de fichas de cassino
    const casinoChips = await inventoryService.getCasinoChips(userId);

    // Criar embed do inventário
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🎒 Inventário de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    // Adicionar descrição explicativa
    let description = isOwnInventory
      ? "Aqui está o seu inventário de fichas de cassino."
      : `Aqui está o inventário de ${targetUser.username}.`;
    
    embed.setDescription(description);

    // Adicionar informações das fichas de cassino
    embed.addFields({
      name: "🎰 Fichas de Cassino",
      value: `${casinoChips} fichas`,
      inline: true,
    });
    embed.addFields({
      name: "💸 Valor Estimado",
      value: formatarDinheiro(casinoChips * 10),
      inline: true,
    });

    if (casinoChips <= 0) {
      const noItemsMessage = isOwnInventory
        ? "Você não possui nenhuma ficha de cassino em seu inventário."
        : `${targetUser.username} não possui nenhuma ficha de cassino em seu inventário.`;
      embed.addFields({
        name: "📦 Inventário vazio",
        value: noItemsMessage,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando inventario:", error);
    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Comando",
      mensagem:
        "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
    });
    return interaction.editReply({ embeds: [embedErro] });
  }
}