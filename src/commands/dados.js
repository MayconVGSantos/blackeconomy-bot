// dados.js
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
  .setName("dados")
  .setDescription("Joga dados no cassino")
  .addIntegerOption((option) =>
    option
      .setName("aposta")
      .setDescription("Quantidade de fichas para apostar")
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName("numero")
      .setDescription(
        "Número que você aposta que sairá na soma dos dados (2-12)"
      )
      .setRequired(true)
      .setMinValue(2)
      .setMaxValue(12)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const aposta = interaction.options.getInteger("aposta");
    const numeroApostado = interaction.options.getInteger("numero");

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
      "dados"
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

    // Gerar o resultado dos dados
    const resultado = casinoService.rollDice();
    const somaDados = resultado.total;

    // Determinar se ganhou ou perdeu
    const ganhou = somaDados === numeroApostado;

    // Calcular o valor do ganho com base na probabilidade
    let multiplicador = 0;
    let ganho = 0;

    if (ganhou) {
      // Definir multiplicadores baseados na probabilidade de cada número
      const multiplicadores = {
        2: 35, // 1/36 chance (2.78%)
        3: 17, // 2/36 chance (5.56%)
        4: 11, // 3/36 chance (8.33%)
        5: 8, // 4/36 chance (11.11%)
        6: 6, // 5/36 chance (13.89%)
        7: 5, // 6/36 chance (16.67%) - mais comum
        8: 6, // 5/36 chance (13.89%)
        9: 8, // 4/36 chance (11.11%)
        10: 11, // 3/36 chance (8.33%)
        11: 17, // 2/36 chance (5.56%)
        12: 35, // 1/36 chance (2.78%)
      };

      multiplicador = multiplicadores[numeroApostado] || 6; // Padrão é 6x
      ganho = aposta * multiplicador;
    }

    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(
      userId,
      aposta,
      ganho,
      "dados"
    );

    // Criar mensagem de resultado
    let mensagemResultado;

    if (ganhou) {
      mensagemResultado = `**🎉 VOCÊ GANHOU!** A soma dos dados foi **${somaDados}**, igual ao seu número apostado!\nGanhou **${ganho} fichas** (${multiplicador}x sua aposta)!`;
    } else {
      mensagemResultado = `**❌ VOCÊ PERDEU!** A soma dos dados foi **${somaDados}**, diferente do seu número apostado (**${numeroApostado}**).\nPerdeu ${aposta} fichas.`;
    }

    // Criar o embed
    const embed = new EmbedBuilder()
      .setColor(ganhou ? 0x00ff00 : 0xff0000) // Verde para vitória, vermelho para derrota
      .setTitle("🎲 Jogo de Dados 🎲")
      .setDescription(mensagemResultado)
      .addFields(
        {
          name: "🎯 Número Apostado",
          value: `${numeroApostado}`,
          inline: true,
        },
        {
          name: "🎲 Dados",
          value: `${resultado.dice1} + ${resultado.dice2} = ${somaDados}`,
          inline: true,
        },
        { name: "💰 Aposta", value: `${aposta} fichas`, inline: true },
        { name: "🎟️ Fichas Atuais", value: `${novasFichas}`, inline: true }
      )
      .setFooter({ text: `Jogado por ${interaction.user.username}` })
      .setTimestamp();

    // Criar botões para jogar novamente
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dados_again")
        .setLabel("Jogar Novamente")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎲"),
      new ButtonBuilder()
        .setCustomId("dados_mesmo_numero")
        .setLabel(`Mesmo Número (${numeroApostado})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎯"),
      new ButtonBuilder()
        .setCustomId("dados_dobrar")
        .setLabel(`Dobrar Aposta (${aposta * 2})`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji("💰")
        .setDisabled(novasFichas < aposta * 2)
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Criar coletor para os botões
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

      await i.deferUpdate();

      if (i.customId === "dados_again") {
        // Jogar novamente com a mesma aposta
        const newCommand = {
          options: new Map(),
        };

        newCommand.options.getInteger = (name) => {
          if (name === "aposta") return aposta;
          if (name === "numero") return Math.floor(Math.random() * 11) + 2; // Número aleatório entre 2 e 12
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
      } else if (i.customId === "dados_mesmo_numero") {
        // Jogar novamente com o mesmo número
        const newCommand = {
          options: new Map(),
        };

        newCommand.options.getInteger = (name) => {
          if (name === "aposta") return aposta;
          if (name === "numero") return numeroApostado;
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
      } else if (i.customId === "dados_dobrar") {
        // Jogar novamente com aposta dobrada
        const newCommand = {
          options: new Map(),
        };

        newCommand.options.getInteger = (name) => {
          if (name === "aposta") return aposta * 2;
          if (name === "numero") return numeroApostado;
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
          ButtonBuilder.from(row.components[1]).setDisabled(true),
          ButtonBuilder.from(row.components[2]).setDisabled(true)
        );

        await interaction
          .editReply({
            components: [disabledRow],
          })
          .catch(console.error);
      }
    });
  } catch (error) {
    console.error("Erro ao executar comando dados:", error);

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
