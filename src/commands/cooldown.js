// cooldown.js - Comando para verificar todos os cooldowns
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
  .setName("cooldown")
  .setDescription("Mostra o tempo restante para usar novamente cada comando")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription(
        "Usuário para verificar cooldowns (somente para administradores)"
      )
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verificar se está consultando outro usuário
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const isOwnCooldown = targetUser.id === interaction.user.id;

    // Se estiver verificando cooldown de outro usuário, verificar permissões
    if (!isOwnCooldown) {
      // Verificar se o usuário é administrador
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = member.permissions.has("Administrator");

      if (!isAdmin) {
        return interaction.editReply({
          content:
            "Você não tem permissão para verificar cooldowns de outros usuários.",
          ephemeral: true,
        });
      }
    }

    // Lista de comandos com cooldown
    const commandsWithCooldown = [
      { name: "trabalhar", emoji: "💼", configKey: "trabalhar" },
      { name: "seduzir", emoji: "💋", configKey: "seduzir" },
      { name: "crime", emoji: "🔪", configKey: "crime" },
      { name: "roubar", emoji: "🔫", configKey: "roubar" },
      // Adicione outros comandos com cooldown aqui
    ];

    // Verificar cooldown para cada comando
    const cooldownResults = await Promise.all(
      commandsWithCooldown.map(async (cmd) => {
        const cooldownTimeMinutes = config.cooldown[cmd.configKey] || 0;
        const cooldownTimeMs = cooldownTimeMinutes * 60000;

        const result = await firebaseService.checkCooldown(
          targetUser.id,
          cmd.name,
          cooldownTimeMs
        );

        return {
          ...cmd,
          emCooldown: result.emCooldown,
          tempoRestante: result.tempoRestante,
          cooldownTotal: cooldownTimeMs,
        };
      })
    );

    // Criar embed para exibir os resultados
    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle(`⏱️ Cooldowns de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    // Adicionar campo para cada comando
    cooldownResults.forEach((cmd) => {
      const minutes = Math.floor(cmd.tempoRestante / 60000);
      const seconds = Math.floor((cmd.tempoRestante % 60000) / 1000);

      let status;
      if (cmd.emCooldown) {
        status = `⏳ Em cooldown: **${minutes}m ${seconds}s** restantes`;
      } else {
        status = "✅ Disponível agora!";
      }

      const cooldownMinutes = Math.floor(cmd.cooldownTotal / 60000);

      embed.addFields({
        name: `${cmd.emoji} /${cmd.name}`,
        value: `${status}\nCooldown total: ${cooldownMinutes} minutos`,
        inline: true,
      });
    });

    // Enviar o embed
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando cooldown:", error);
    return interaction.editReply(
      "Ocorreu um erro ao verificar os cooldowns. Tente novamente mais tarde."
    );
  }
}
