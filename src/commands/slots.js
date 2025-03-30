// slots.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import inventoryService from "../services/inventory.js";
import casinoService from "../services/casino.js";
import embedUtils from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("slots")
  .setDescription("Joga no caça-níqueis do cassino")
  .addIntegerOption((option) =>
    option
      .setName("aposta")
      .setDescription("Quantidade de fichas para apostar")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const aposta = interaction.options.getInteger("aposta");

    // Verificar se o usuário tem fichas suficientes
    const fichasAtuais = await inventoryService.getCasinoChips(userId);

    if (fichasAtuais < aposta) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Fichas Insuficientes",
        mensagem: `Você tem apenas ${fichasAtuais} fichas. Não é possível apostar ${aposta} fichas.`,
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Registrar a aposta
    const apostaRegistrada = await casinoService.registerBet(
      userId,
      aposta,
      "slots"
    );

    if (!apostaRegistrada) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro na Aposta",
        mensagem:
          "Ocorreu um erro ao registrar sua aposta. Tente novamente mais tarde.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    // Gerar o resultado dos slots
    const resultado = casinoService.generateSlotsResult(userId);

    // Calcular o ganho
    const ganho = aposta * resultado.multiplier;

    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(
      userId,
      aposta,
      ganho,
      "slots"
    );

    // Criar embed com o resultado
    const embed = new EmbedBuilder()
      .setColor(ganho > 0 ? 0x00ff00 : 0xff0000) // Verde para vitória, vermelho para derrota
      .setTitle("🎰 Caça-Níqueis")
      .setDescription(
        `
**[ ${resultado.reels.join(" | ")} ]**

${
  ganho > 0
    ? `**${resultado.winType}** Você ganhou **${ganho} fichas**!`
    : "Que pena! Você não ganhou nada."
}`
      )
      .addFields(
        { name: "💰 Aposta", value: `${aposta} fichas`, inline: true },
        {
          name: "🪙 Multiplicador",
          value: `${resultado.multiplier}x`,
          inline: true,
        },
        { name: "🎟️ Fichas Atuais", value: `${novasFichas}`, inline: true }
      )
      .setFooter({ text: `Jogado por ${interaction.user.username}` })
      .setTimestamp();

    // Criar botão para jogar novamente
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("slots_again")
        .setLabel("Jogar Novamente")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎰"),
      new ButtonBuilder()
        .setCustomId("slots_double")
        .setLabel(`Dobrar Aposta (${aposta * 2})`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji("💰")
        .setDisabled(novasFichas < aposta * 2)
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Criar coletor para o botão
    const collector = reply.createMessageComponentCollector({
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

      if (i.customId === "slots_again") {
        await i.deferUpdate();

        // Criar um novo comando de interação com a mesma aposta
        const newCommand = {
          options: new Map(),
        };

        newCommand.options.getInteger = (name) => {
          if (name === "aposta") return aposta;
          return null;
        };

        // Executar novamente
        await execute({
          ...interaction,
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
          options: newCommand.options,
        });

        collector.stop();
      } else if (i.customId === "slots_double") {
        await i.deferUpdate();

        // Criar um novo comando de interação com aposta dobrada
        const newCommand = {
          options: new Map(),
        };

        newCommand.options.getInteger = (name) => {
          if (name === "aposta") return aposta * 2;
          return null;
        };

        // Executar novamente
        await execute({
          ...interaction,
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
          options: newCommand.options,
        });

        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        // Desativar os botões após o tempo limite
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true),
          ButtonBuilder.from(row.components[1]).setDisabled(true)
        );

        await interaction
          .editReply({
            components: [disabledRow],
          })
          .catch(console.error);
      }
    });
  } catch (error) {
    console.error("Erro ao executar comando slots:", error);

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
