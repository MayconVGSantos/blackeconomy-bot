// tempo-espera.js - Adaptado à estrutura real do Firebase
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";
import config from "../../config/config.js";
import { formatarTempoEspera } from "../utils/format.js";
import { getDatabase, ref, get } from "firebase/database";

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
        specialCheck: true, // Marcar para verificação especial
      },
      {
        name: "exame",
        emoji: "📝",
        customTime: 10 * 24 * 60 * 60 * 1000, // 10 dias em ms
        specialCheck: true, // Marcar para verificação especial
      },
    ];

    // Obter dados do usuário para verificações especiais
    const database = getDatabase();
    let userData = null;

    try {
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        userData = userSnapshot.val();
      }
    } catch (error) {
      console.error("Erro ao obter dados do usuário:", error);
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

        // Verificação especial para comandos como estudar e exame
        if (cmd.specialCheck) {
          return await checkSpecialCooldown(
            cmd,
            userId,
            userData,
            cooldownTimeMs
          );
        } else {
          // Para comandos regulares, usar verificação normal de cooldown
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
        }
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

/**
 * Função para verificar cooldowns especiais (estudar, exame)
 * @param {Object} cmd - Comando a ser verificado
 * @param {string} userId - ID do usuário
 * @param {Object} userData - Dados do usuário do Firebase
 * @param {number} cooldownTimeMs - Tempo de cooldown em ms
 * @returns {Promise<Object>} - Resultado da verificação
 */
async function checkSpecialCooldown(cmd, userId, userData, cooldownTimeMs) {
  try {
    if (!userData) {
      return {
        ...cmd,
        emCooldown: false,
        tempoRestante: 0,
        cooldownTotal: cooldownTimeMs,
      };
    }

    // Para o comando 'estudar', verificar lastStudyDate
    if (
      cmd.name === "estudar" &&
      userData.education &&
      userData.education.lastStudyDate
    ) {
      const lastUsed = userData.education.lastStudyDate;
      const now = Date.now();
      const timeElapsed = now - lastUsed;

      if (timeElapsed < cooldownTimeMs) {
        return {
          ...cmd,
          emCooldown: true,
          tempoRestante: cooldownTimeMs - timeElapsed,
          cooldownTotal: cooldownTimeMs,
        };
      }
    }

    // Para o comando 'exame', verificar baseado em examsTaken e examsPassed
    if (cmd.name === "exame" && userData.education) {
      // Verificar se já fez algum exame
      const examsTaken = userData.education.examsTaken || 0;
      const examsPassed = userData.education.examsPassed || 0;

      // Se não fez nenhum exame, está disponível
      if (examsTaken === 0) {
        return {
          ...cmd,
          emCooldown: false,
          tempoRestante: 0,
          cooldownTotal: cooldownTimeMs,
        };
      }

      // Se já fez exame, verificar o último através de lastExamDate, se existir
      if (userData.education.lastExamDate) {
        const lastUsed = userData.education.lastExamDate;
        const now = Date.now();
        const timeElapsed = now - lastUsed;

        if (timeElapsed < cooldownTimeMs) {
          return {
            ...cmd,
            emCooldown: true,
            tempoRestante: cooldownTimeMs - timeElapsed,
            cooldownTotal: cooldownTimeMs,
          };
        }
      }
    }

    // Se não encontrou condições de cooldown, está disponível
    return {
      ...cmd,
      emCooldown: false,
      tempoRestante: 0,
      cooldownTotal: cooldownTimeMs,
    };
  } catch (error) {
    console.error(
      `Erro ao verificar cooldown especial para ${cmd.name}:`,
      error
    );
    return {
      ...cmd,
      emCooldown: false,
      tempoRestante: 0,
      cooldownTotal: cooldownTimeMs,
    };
  }
}
