// nivel-educacional.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import educationService from "../services/education.js";
import firebaseService from "../services/firebase.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("nivel-educacional")
  .setDescription(
    "Mostra seu nível educacional atual ou se matricula em um novo"
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Mostra seu nível educacional atual e progresso")
      .addUserOption((option) =>
        option
          .setName("usuario")
          .setDescription("Usuário para ver o nível educacional (opcional)")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("matricular")
      .setDescription("Matricula-se em um novo nível educacional")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("concluir")
      .setDescription("Conclui seu nível educacional atual e recebe o diploma")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("bolsa")
      .setDescription("Solicita uma bolsa de estudos (requer alta moralidade)")
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "info":
        await handleInfoSubcommand(interaction);
        break;
      case "matricular":
        await handleMatricularSubcommand(interaction);
        break;
      case "concluir":
        await handleConcluirSubcommand(interaction);
        break;
      case "bolsa":
        await handleBolsaSubcommand(interaction);
        break;
      default:
        // Caso padrão, mostra informações
        await handleInfoSubcommand(interaction);
    }
  } catch (error) {
    console.error("Erro ao executar comando nivel-educacional:", error);

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

/**
 * Manipula o subcomando info
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleInfoSubcommand(interaction) {
  try {
    // Determinar usuário alvo
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const isOwnProfile = targetUser.id === interaction.user.id;

    // Obter informações educacionais
    const educationInfo = await educationService.getFormattedEducationInfo(
      targetUser.id
    );

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle(`🎓 Perfil Educacional de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    // Adicionar informações de nível atual
    if (educationInfo.current) {
      const current = educationInfo.current;

      let description = `${current.icon} **Cursando**: ${current.name}`;
      if (current.areaName) {
        description += ` - ${current.areaName}`;
      }
      description += `\n📊 **Progresso**: ${current.currentPoints}/${current.requiredPoints} pontos (${current.progress}%)`;

      // Adicionar barra de progresso visual
      const progressBarLength = 20;
      const filledLength = Math.round(
        (current.progress / 100) * progressBarLength
      );
      const progressBar =
        "█".repeat(filledLength) + "░".repeat(progressBarLength - filledLength);

      description += `\n${progressBar}`;

      embed.setDescription(description);
    } else {
      embed.setDescription(
        isOwnProfile
          ? "📝 Você não está matriculado em nenhum nível educacional. Use `/nivel-educacional matricular` para se matricular."
          : "📝 Este usuário não está matriculado em nenhum nível educacional."
      );
    }

    // Adicionar níveis completados
    if (educationInfo.completed.length > 0) {
      let completedText = educationInfo.completed
        .map((level) => {
          const completionDate = new Date(level.completedAt).toLocaleDateString(
            "pt-BR"
          );
          let text = `${level.icon} ${level.name}`;
          if (level.areaName) {
            text += ` - ${level.areaName}`;
          }
          text += ` (${completionDate})`;
          return text;
        })
        .join("\n");

      embed.addFields({
        name: "🏆 Formações Concluídas",
        value: completedText,
        inline: false,
      });
    } else {
      embed.addFields({
        name: "🏆 Formações Concluídas",
        value: "Nenhuma formação concluída ainda.",
        inline: false,
      });
    }

    // Adicionar informações de bolsa de estudo, se houver
    if (educationInfo.scholarship) {
      const grantedDate = new Date(
        educationInfo.scholarship.grantedAt
      ).toLocaleDateString("pt-BR");

      embed.addFields({
        name: "🎯 Bolsa de Estudos",
        value: `Desconto de ${educationInfo.scholarship.discount}% em matrículas (Concedida em ${grantedDate})`,
        inline: false,
      });
    }

    // Adicionar informações de próximo exame, se houver
    if (educationInfo.nextExamDate) {
      const examDate = new Date(educationInfo.nextExamDate);
      const now = new Date();
      const examDue = examDate <= now;

      embed.addFields({
        name: examDue ? "⚠️ Exame Pendente" : "📝 Próximo Exame",
        value: examDue
          ? "Você precisa fazer um exame! Use o comando `/exame`."
          : `Agendado para ${examDate.toLocaleDateString("pt-BR")}`,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao processar subcomando info:", error);
    throw error;
  }
}

/**
 * Manipula o subcomando matricular
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleMatricularSubcommand(interaction) {
  try {
    const userId = interaction.user.id;

    // Verificar se o usuário já tem um nível educacional atual
    const educationInfo = await educationService.getFormattedEducationInfo(
      userId
    );

    if (educationInfo.current) {
      // Já está matriculado em um nível
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Matrícula Não Permitida",
        mensagem: `Você já está matriculado em ${educationInfo.current.name}${
          educationInfo.current.areaName
            ? ` - ${educationInfo.current.areaName}`
            : ""
        }. Conclua este nível primeiro com \`/nivel-educacional concluir\` antes de se matricular em outro.`,
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Obter níveis disponíveis para matrícula
    const availableLevels = await educationService.getNextAvailableLevels(
      userId
    );

    if (availableLevels.length === 0) {
      // Não há níveis disponíveis
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Matrícula Não Disponível",
        mensagem:
          "Não há níveis educacionais disponíveis para você no momento.",
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Obter saldo do usuário
    const userData = await firebaseService.getUserData(userId);
    const userBalance = userData.saldo || 0;

    // Obter informações de bolsa de estudo
    const hasScholarship = educationInfo.scholarship !== null;
    const scholarshipDiscount = hasScholarship
      ? educationInfo.scholarship.discount / 100
      : 0;

    // Criar embed de seleção
    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle("🎓 Matrícula Educacional")
      .setDescription(
        `Escolha um nível educacional para se matricular. Seu saldo atual: ${formatarDinheiro(
          userBalance
        )}${
          hasScholarship
            ? `\n🎯 Você tem uma bolsa de estudos com ${educationInfo.scholarship.discount}% de desconto!`
            : ""
        }`
      )
      .setFooter({ text: "Selecione um nível no menu abaixo." })
      .setTimestamp();

    // Criar opções do menu
    const levelOptions = availableLevels.map((level) => {
      // Calcular custo com desconto de bolsa, se houver
      const cost = hasScholarship
        ? Math.floor(level.cost * (1 - scholarshipDiscount))
        : level.cost;

      return {
        label: level.name,
        value: level.id,
        description: `Custo: ${formatarDinheiro(cost)} - ${
          level.points
        } dias de estudo`,
        emoji: level.icon,
        default: false,
      };
    });

    // Criar menu de seleção
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_education_level")
        .setPlaceholder("Selecione um nível educacional")
        .addOptions(levelOptions)
    );

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Criar coletor para a seleção
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: "Você não pode usar este menu.",
          ephemeral: true,
        });
        return;
      }

      // Obter o nível selecionado
      const selectedLevelId = i.values[0];
      const selectedLevel = availableLevels.find(
        (level) => level.id === selectedLevelId
      );

      if (!selectedLevel) {
        await i.update({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: interaction.user.username,
              titulo: "Erro na Seleção",
              mensagem: "Nível educacional inválido.",
            }),
          ],
          components: [],
        });
        return;
      }

      await i.deferUpdate();

      // Se o nível tem áreas específicas, mostrar menu de áreas
      if (selectedLevel.areas && Object.keys(selectedLevel.areas).length > 0) {
        await handleAreaSelection(
          i,
          userId,
          selectedLevel,
          hasScholarship,
          scholarshipDiscount
        );
        collector.stop();
        return;
      }

      // Caso contrário, matricular diretamente
      const cost = hasScholarship
        ? Math.floor(selectedLevel.cost * (1 - scholarshipDiscount))
        : selectedLevel.cost;

      // Verificar saldo
      if (userBalance < cost) {
        await i.editReply({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: interaction.user.username,
              titulo: "Saldo Insuficiente",
              mensagem: `Você precisa de ${formatarDinheiro(
                cost
              )} para se matricular em ${
                selectedLevel.name
              }. Seu saldo atual é ${formatarDinheiro(userBalance)}.`,
            }),
          ],
          components: [],
        });
        collector.stop();
        return;
      }

      // Matricular
      const success = await educationService.startEducationLevel(
        userId,
        selectedLevelId
      );

      if (!success) {
        await i.editReply({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: interaction.user.username,
              titulo: "Erro na Matrícula",
              mensagem:
                "Não foi possível realizar a matrícula. Verifique os requisitos e seu saldo.",
            }),
          ],
          components: [],
        });
        collector.stop();
        return;
      }

      // Sucesso na matrícula
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00) // Verde
        .setTitle("✅ Matrícula Realizada com Sucesso!")
        .setDescription(
          `Você se matriculou com sucesso em ${selectedLevel.icon} **${
            selectedLevel.name
          }**.\n\nCusto: ${formatarDinheiro(cost)}\nDuração: ${
            selectedLevel.points
          } dias de estudo`
        )
        .setFooter({
          text: "Use o comando /estudar para começar seus estudos!",
        })
        .setTimestamp();

      await i.editReply({
        embeds: [successEmbed],
        components: [],
      });
      collector.stop();
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        // Timeout sem seleção
        const timeoutEmbed = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Tempo Esgotado",
          mensagem:
            "Você não selecionou um nível educacional a tempo. Use o comando novamente se quiser se matricular.",
        });

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("Erro ao processar subcomando matricular:", error);
    throw error;
  }
}

/**
 * Manipula a seleção de área para níveis com especializações
 * @param {Interaction} i - Interação do componente
 * @param {string} userId - ID do usuário
 * @param {Object} selectedLevel - Nível selecionado
 * @param {boolean} hasScholarship - Se o usuário tem bolsa
 * @param {number} scholarshipDiscount - Desconto da bolsa (0-1)
 */
async function handleAreaSelection(
  i,
  userId,
  selectedLevel,
  hasScholarship,
  scholarshipDiscount
) {
  try {
    // Obter saldo do usuário
    const userData = await firebaseService.getUserData(userId);
    const userBalance = userData.saldo || 0;

    // Criar embed para seleção de área
    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle(`🎓 Selecione uma Especialização para ${selectedLevel.name}`)
      .setDescription(
        `Escolha uma área de especialização. Seu saldo atual: ${formatarDinheiro(
          userBalance
        )}`
      )
      .setFooter({ text: "Selecione uma especialização no menu abaixo." })
      .setTimestamp();

    // Criar opções do menu
    const areaOptions = Object.entries(selectedLevel.areas || {})
      .map(([areaId, areaData]) => {
        // Validar que areaData tem a estrutura esperada
        if (!areaData || typeof areaData !== "object") {
          console.error(`Dados inválidos para área ${areaId}:`, areaData);
          return null;
        }

        // Extrair os campos necessários com segurança
        const areaCost =
          areaData && typeof areaData === "object" && "cost" in areaData
            ? areaData.cost
            : selectedLevel.cost;

        const areaName =
          areaData && typeof areaData === "object" && "name" in areaData
            ? areaData.name
            : `Área ${areaId}`;

        // Calcular custo com desconto de bolsa, se houver
        const cost = hasScholarship
          ? Math.floor(areaCost * (1 - scholarshipDiscount))
          : areaCost;

        return {
          label: areaName,
          value: areaId,
          description: `Custo: ${formatarDinheiro(cost)} - ${
            selectedLevel.points
          } dias de estudo`,
          default: false,
        };
      })
      .filter((option) => option !== null);

    // Criar menu de seleção
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_education_area")
        .setPlaceholder("Selecione uma especialização")
        .addOptions(areaOptions)
    );

    const response = await i.editReply({
      embeds: [embed],
      components: [row],
    });

    // Criar coletor para a seleção
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (areaInteraction) => {
      if (areaInteraction.user.id !== userId) {
        await areaInteraction.reply({
          content: "Você não pode usar este menu.",
          ephemeral: true,
        });
        return;
      }

      // Obter a área selecionada
      const selectedAreaId = areaInteraction.values[0];
      const selectedArea = selectedLevel.areas[selectedAreaId];

      if (!selectedArea) {
        await areaInteraction.update({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: areaInteraction.user.username,
              titulo: "Erro na Seleção",
              mensagem: "Área inválida.",
            }),
          ],
          components: [],
        });
        return;
      }

      await areaInteraction.deferUpdate();

      // Calcular custo com desconto de bolsa, se houver
      const cost = hasScholarship
        ? Math.floor(selectedArea.cost * (1 - scholarshipDiscount))
        : selectedArea.cost;

      // Verificar saldo
      if (userBalance < cost) {
        await areaInteraction.editReply({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: areaInteraction.user.username,
              titulo: "Saldo Insuficiente",
              mensagem: `Você precisa de ${formatarDinheiro(
                cost
              )} para se matricular em ${
                selectedArea.name
              }. Seu saldo atual é ${formatarDinheiro(userBalance)}.`,
            }),
          ],
          components: [],
        });
        return;
      }

      // Matricular com área específica
      const success = await educationService.startEducationLevel(
        userId,
        selectedLevel.id,
        selectedAreaId
      );

      if (!success) {
        await areaInteraction.editReply({
          embeds: [
            embedUtils.criarEmbedErro({
              usuario: areaInteraction.user.username,
              titulo: "Erro na Matrícula",
              mensagem:
                "Não foi possível realizar a matrícula. Verifique os requisitos e seu saldo.",
            }),
          ],
          components: [],
        });
        return;
      }

      // Sucesso na matrícula
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00) // Verde
        .setTitle("✅ Matrícula Realizada com Sucesso!")
        .setDescription(
          `Você se matriculou com sucesso em ${selectedLevel.icon} **${
            selectedLevel.name
          } - ${selectedArea.name}**.\n\nCusto: ${formatarDinheiro(
            cost
          )}\nDuração: ${selectedLevel.points} dias de estudo`
        )
        .setFooter({
          text: "Use o comando /estudar para começar seus estudos!",
        })
        .setTimestamp();

      await areaInteraction.editReply({
        embeds: [successEmbed],
        components: [],
      });
      collector.stop();
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        // Timeout sem seleção
        const timeoutEmbed = embedUtils.criarEmbedErro({
          usuario: i.user.username,
          titulo: "Tempo Esgotado",
          mensagem:
            "Você não selecionou uma especialização a tempo. Use o comando novamente se quiser se matricular.",
        });

        await i.editReply({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("Erro ao processar seleção de área:", error);
    throw error;
  }
}

/**
 * Manipula o subcomando concluir
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleConcluirSubcommand(interaction) {
  try {
    const userId = interaction.user.id;

    // Verificar se o usuário tem um nível educacional atual
    const educationInfo = await educationService.getFormattedEducationInfo(
      userId
    );

    if (!educationInfo.current) {
      // Não está matriculado em nenhum nível
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Conclusão Não Permitida",
        mensagem:
          "Você não está matriculado em nenhum nível educacional. Use `/nivel-educacional matricular` para se matricular.",
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Verificar se atingiu os pontos necessários
    if (
      educationInfo.current.currentPoints < educationInfo.current.requiredPoints
    ) {
      // Não atingiu os pontos necessários
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Pontos Insuficientes",
        mensagem: `Você precisa de ${educationInfo.current.requiredPoints} pontos para concluir ${educationInfo.current.name}, mas tem apenas ${educationInfo.current.currentPoints} pontos (${educationInfo.current.progress}%). Continue estudando diariamente com o comando \`/estudar\`.`,
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Concluir o nível atual
    const result = await educationService.completeCurrentLevel(userId);

    if (!result.success) {
      // Erro ao concluir
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro na Conclusão",
        mensagem:
          "Não foi possível concluir seu nível educacional atual. Tente novamente mais tarde.",
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Criar embed de sucesso
    const embed = new EmbedBuilder()
      .setColor(0x00ff00) // Verde
      .setTitle("🎓 Formatura Concluída!")
      .setDescription(
        `Parabéns! Você concluiu com sucesso sua formação em ${
          result.completedLevel.name
        }${
          result.completedLevel.areaName
            ? ` - ${result.completedLevel.areaName}`
            : ""
        }!`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: "📜 Diploma",
          value: `Você recebeu o diploma de ${result.completedLevel.name}${
            result.completedLevel.areaName
              ? ` em ${result.completedLevel.areaName}`
              : ""
          }`,
          inline: false,
        },
        {
          name: "📚 Próximos Passos",
          value:
            "Use `/nivel-educacional matricular` para se matricular em um novo nível educacional ou `/nivel-educacional info` para ver seu perfil atualizado.",
          inline: false,
        }
      )
      .setFooter({ text: "Use sua formação para acessar novas profissões!" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao processar subcomando concluir:", error);
    throw error;
  }
}

/**
 * Manipula o subcomando bolsa
 * @param {Interaction} interaction - Interação do Discord
 */
async function handleBolsaSubcommand(interaction) {
  try {
    const userId = interaction.user.id;

    // Verificar se o usuário já tem uma bolsa
    const educationInfo = await educationService.getFormattedEducationInfo(
      userId
    );

    if (educationInfo.scholarship) {
      // Já tem uma bolsa
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Bolsa Já Concedida",
        mensagem: `Você já possui uma bolsa de estudos com ${educationInfo.scholarship.discount}% de desconto.`,
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Verificar elegibilidade para bolsa
    const { eligible, discount } =
      await educationService.checkScholarshipEligibility(userId);

    if (!eligible) {
      // Não é elegível
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Não Elegível para Bolsa",
        mensagem:
          "Você não é elegível para uma bolsa de estudos. Bolsas são concedidas a jogadores com alta moralidade (acima de 30).",
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // Confirmar se deseja solicitar a bolsa
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle("🎯 Solicitar Bolsa de Estudos")
      .setDescription(
        `Você é elegível para uma bolsa de estudos com **${discount}% de desconto** em todas as matrículas educacionais.\n\nDeseja solicitar essa bolsa agora?`
      )
      .setFooter({ text: "Use os botões abaixo para confirmar." })
      .setTimestamp();

    // Criar botões de confirmação
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_scholarship")
        .setLabel("Solicitar Bolsa")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId("cancel_scholarship")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    const response = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    });

    // Criar coletor para botões
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: "Você não pode usar estes botões.",
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();

      if (i.customId === "confirm_scholarship") {
        // Solicitar bolsa
        const result = await educationService.applyForScholarship(userId);

        if (!result.success) {
          // Erro ao solicitar
          const errorEmbed = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Erro na Solicitação",
            mensagem:
              result.message ||
              "Não foi possível solicitar a bolsa de estudos. Tente novamente mais tarde.",
          });

          await i.editReply({
            embeds: [errorEmbed],
            components: [],
          });
          collector.stop();
          return;
        }

        // Sucesso na solicitação
        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff00) // Verde
          .setTitle("✅ Bolsa de Estudos Concedida!")
          .setDescription(
            `Sua solicitação de bolsa de estudos foi aprovada!\n\nVocê agora tem **${result.discount}% de desconto** em todas as matrículas educacionais.`
          )
          .setFooter({
            text: "Use /nivel-educacional matricular para usar sua bolsa.",
          })
          .setTimestamp();

        await i.editReply({
          embeds: [successEmbed],
          components: [],
        });
        collector.stop();
      } else if (i.customId === "cancel_scholarship") {
        // Cancelar solicitação
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x808080) // Cinza
          .setTitle("❌ Solicitação Cancelada")
          .setDescription("Você cancelou a solicitação de bolsa de estudos.")
          .setFooter({ text: "Você pode solicitar novamente mais tarde." })
          .setTimestamp();

        await i.editReply({
          embeds: [cancelEmbed],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        // Timeout sem interação
        const timeoutEmbed = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Tempo Esgotado",
          mensagem:
            "Você não confirmou a solicitação a tempo. Use o comando novamente se quiser solicitar uma bolsa.",
        });

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("Erro ao processar subcomando bolsa:", error);
    throw error;
  }
}
