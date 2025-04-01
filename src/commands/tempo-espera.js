// tempo-espera.js - Corrigido para resolver o problema com o cooldown do comando estudar
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import config from "../../config/config.js";
import { formatarTempoEspera } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("tempo-espera")
  .setDescription("Mostra o tempo restante para usar novamente cada comando")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription(
        "Usuário para verificar tempos de espera (somente para administradores)"
      )
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Verificar se está consultando outro usuário
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnCooldown = userId === interaction.user.id;

    // Se estiver verificando cooldown de outro usuário, verificar permissões
    if (!isOwnCooldown) {
      // Verificar se o usuário é administrador
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = member.permissions.has("Administrator");

      if (!isAdmin) {
        return interaction.editReply({
          content:
            "Você não tem permissão para verificar tempos de espera de outros usuários.",
          ephemeral: true,
        });
      }
    }

    // Lista completa de comandos com cooldown
    const commandsWithCooldown = [
      { name: "trabalhar", emoji: "💼", configKey: "trabalhar" },
      { name: "seduzir", emoji: "💋", configKey: "seduzir" },
      { name: "crime", emoji: "🔪", configKey: "crime" },
      { name: "roubar", emoji: "🔫", configKey: "roubar" },
      {
        name: "diario",
        emoji: "🎁",
        customTime: 86400000, // 24h em ms
      },
      {
        name: "semanal",
        emoji: "📅",
        customTime: 604800000, // 7 dias em ms
      },
      {
        name: "estudar",
        emoji: "📚",
        customTime: 86400000, // 24h em ms
      },
      {
        name: "exame",
        emoji: "📝",
        customTime: 10 * 24 * 60 * 60 * 1000, // 10 dias em ms
      },
    ];

    // Verificação especial para o comando estudar
    // Consultando diretamente o último uso do comando estudar
    let estudarLastUsage = null;
    try {
      const database = getDatabase();
      const cooldownRef = ref(database, `users/${userId}/cooldowns/estudar`);
      const snapshot = await get(cooldownRef);
      if (snapshot.exists()) {
        estudarLastUsage = snapshot.val();
      }
    } catch (error) {
      console.error("Erro ao verificar último uso do comando estudar:", error);
    }

    // Verificar cooldown para cada comando
    const cooldownResults = await Promise.all(
      commandsWithCooldown.map(async (cmd) => {
        // Determinar o tempo de cooldown
        let cooldownTimeMs;
        if (cmd.customTime) {
          cooldownTimeMs = cmd.customTime;
        } else {
          const cooldownTimeMinutes = config.cooldown[cmd.configKey] || 0;
          cooldownTimeMs = cooldownTimeMinutes * 60000;
        }

        // Usar a verificação especial para o comando estudar
        if (cmd.name === "estudar" && estudarLastUsage) {
          const now = Date.now();
          const timeElapsed = now - estudarLastUsage;
          const tempoRestante = cooldownTimeMs - timeElapsed;

          // Se ainda está em cooldown
          if (tempoRestante > 0) {
            return {
              ...cmd,
              emCooldown: true,
              tempoRestante: tempoRestante,
              cooldownTotal: cooldownTimeMs,
            };
          }
        }

        // Para os outros comandos, usar a verificação normal
        const result = await firebaseService.checkCooldown(
          userId,
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
      .setTitle(`⏱️ Tempos de Espera de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription("Aqui estão os tempos restantes para usar cada comando:")
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    // Adicionar campo para cada comando
    for (const cmd of cooldownResults) {
      let statusText;

      if (cmd.emCooldown) {
        const tempoFormatado = formatarTempoEspera(cmd.tempoRestante);
        statusText = `⏳ Disponível em:\n${tempoFormatado}`;
      } else {
        statusText = "✅ Disponível agora!";
      }

      embed.addFields({
        name: `${cmd.emoji} /${cmd.name}`,
        value: statusText,
        inline: true,
      });
    }

    // Enviar o embed
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando tempo-espera:", error);
    return interaction.editReply(
      "Ocorreu um erro ao verificar os tempos de espera. Tente novamente mais tarde."
    );
  }
}

// Importações necessárias para a verificação especial
import { getDatabase, ref, get } from "firebase/database";
