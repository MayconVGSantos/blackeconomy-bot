// tempo-espera.js - Versão final com tratamento correto de estudar e exame
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
  let replied = false;

  try {
    // Primeiro, defira a resposta e marque como respondido
    try {
      await interaction.deferReply();
      replied = true;
    } catch (deferError) {
      console.error("Erro ao deferir resposta:", deferError);
      // Se não conseguir deferir, tente responder diretamente
      if (!replied) {
        try {
          await interaction.reply("Processando tempos de espera...");
          replied = true;
        } catch (replyError) {
          console.error("Não foi possível responder à interação:", replyError);
          // Se chegamos aqui, a interação provavelmente expirou ou já foi respondida
          return;
        }
      }
    }

    // Verificar se está consultando outro usuário
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const isOwnCooldown = userId === interaction.user.id;

    // Se estiver verificando cooldown de outro usuário, verificar permissões
    if (!isOwnCooldown) {
      // Verificar se o usuário é administrador
      try {
        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );
        const isAdmin = member.permissions.has("Administrator");

        if (!isAdmin) {
          try {
            return await safeEditReply(interaction, replied, {
              content:
                "Você não tem permissão para verificar tempos de espera de outros usuários.",
              ephemeral: true,
            });
          } catch (error) {
            console.error("Erro ao enviar mensagem de permissão:", error);
            return;
          }
        }
      } catch (error) {
        console.error("Erro ao verificar permissões:", error);
        try {
          return await safeEditReply(interaction, replied, {
            content:
              "Não foi possível verificar suas permissões. Tente novamente.",
            ephemeral: true,
          });
        } catch (editError) {
          console.error(
            "Erro ao enviar mensagem de erro de permissão:",
            editError
          );
          return;
        }
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
    const cooldownPromises = commandsWithCooldown.map(async (cmd) => {
      try {
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
          // Usar o método do firebaseService para verificar o cooldown
          const cooldownRef = ref(
            database,
            `users/${userId}/cooldowns/${cmd.name}`
          );
          const snapshot = await get(cooldownRef);

          let result = { emCooldown: false, tempoRestante: 0 };

          if (snapshot.exists()) {
            const lastUsed = snapshot.val();
            const now = Date.now();
            const timeElapsed = now - lastUsed;

            if (timeElapsed < cooldownTimeMs) {
              result = {
                emCooldown: true,
                tempoRestante: cooldownTimeMs - timeElapsed,
              };
            }
          }

          return {
            ...cmd,
            emCooldown: result.emCooldown,
            tempoRestante: result.tempoRestante,
            cooldownTotal: cooldownTimeMs,
          };
        }
      } catch (error) {
        console.error(`Erro ao verificar cooldown para ${cmd.name}:`, error);
        // Retornar um resultado padrão em caso de erro
        return {
          ...cmd,
          emCooldown: false,
          tempoRestante: 0,
          cooldownTotal: 0,
          error: true,
        };
      }
    });

    // Esperar que todas as verificações sejam concluídas
    const cooldownResults = await Promise.all(cooldownPromises);

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

      if (cmd.error) {
        statusText = "❓ Status desconhecido";
      } else if (cmd.emCooldown) {
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
    try {
      return await safeEditReply(interaction, replied, { embeds: [embed] });
    } catch (error) {
      console.error("Erro ao enviar resposta final:", error);
    }
  } catch (error) {
    console.error("Erro ao executar comando tempo-espera:", error);

    try {
      return await safeEditReply(interaction, replied, {
        content:
          "Ocorreu um erro ao verificar os tempos de espera. Tente novamente mais tarde.",
      });
    } catch (finalError) {
      console.error("Erro ao enviar mensagem de erro final:", finalError);
    }
  }
}

/**
 * Função auxiliar para responder com segurança, tratando erros de interação
 * @param {Interaction} interaction - A interação do Discord
 * @param {boolean} replied - Se a interação já foi respondida
 * @param {Object} options - Opções da resposta
 * @returns {Promise<void>}
 */
async function safeEditReply(interaction, replied, options) {
  try {
    if (replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    console.error("Erro ao responder interação:", error);
    // Se chegamos aqui, provavelmente a interação expirou
    throw error; // Propagar o erro para tratamento adicional se necessário
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
    // Verificar se os dados do usuário existem
    if (!userData) {
      return {
        ...cmd,
        emCooldown: false,
        tempoRestante: 0,
        cooldownTotal: cooldownTimeMs,
      };
    }

    // Verificar se os dados educacionais existem
    if (!userData.education) {
      return {
        ...cmd,
        emCooldown: false,
        tempoRestante: 0,
        cooldownTotal: cooldownTimeMs,
      };
    }

    // Para o comando 'estudar', verificar lastStudyDate
    if (cmd.name === "estudar" && userData.education.lastStudyDate) {
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

    // Para o comando 'exame', verificar nextExamDate
    if (cmd.name === "exame") {
      // Se nextExamDate existe e é um timestamp futuro, usar isso para determinar o cooldown
      if (userData.education.nextExamDate) {
        const nextExamDate = userData.education.nextExamDate;
        const now = Date.now();

        // Se a data do próximo exame está no futuro
        if (nextExamDate > now) {
          const tempoRestante = nextExamDate - now;
          return {
            ...cmd,
            emCooldown: true,
            tempoRestante: tempoRestante,
            cooldownTotal: cooldownTimeMs, // Usar o tempo padrão para referência
          };
        }
      }

      // Se não há nextExamDate ou já está no passado, verificar se já pode fazer exame
      // com base no nível educacional e outros requisitos
      const examsTaken = userData.education.examsTaken || 0;
      const examsPassed = userData.education.examsPassed || 0;

      // Normalmente, após passar em um exame, teria um cooldown antes do próximo
      // Se não há nextExamDate definido, verificar lastStudyDate como fallback
      if (userData.education.lastStudyDate) {
        const lastStudy = userData.education.lastStudyDate;
        const now = Date.now();

        // Se o usuário passou no último exame e está no período de cooldown
        if (examsPassed > 0 && examsPassed === examsTaken) {
          const timeElapsed = now - lastStudy;

          // Se estudou recentemente, pode ainda não estar pronto para o exame
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
