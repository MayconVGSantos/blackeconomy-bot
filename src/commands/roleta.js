// roleta.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
} from "discord.js";
import inventoryService from "../services/inventory.js";
import casinoService from "../services/casino.js";
import embedUtils from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("roleta")
  .setDescription("Joga roleta no cassino")
  .addIntegerOption((option) =>
    option
      .setName("aposta")
      .setDescription("Quantidade de fichas para apostar")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((option) =>
    option
      .setName("tipo")
      .setDescription("Tipo de aposta")
      .setRequired(true)
      .addChoices(
        { name: "Número Exato (36x)", value: "numero" },
        { name: "Cor (Vermelho/Preto) (2x)", value: "cor" },
        { name: "Par/Ímpar (2x)", value: "paridade" },
        { name: "Dúzia (3x)", value: "duzia" },
        { name: "Coluna (3x)", value: "coluna" }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("numero")
      .setDescription("Número específico (0-36) se apostando em número exato")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(36)
  )
  .addStringOption((option) =>
    option
      .setName("cor")
      .setDescription('Cor para apostar se escolheu tipo "cor"')
      .setRequired(false)
      .addChoices(
        { name: "Vermelho", value: "red" },
        { name: "Preto", value: "black" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("paridade")
      .setDescription('Par ou ímpar para apostar se escolheu tipo "paridade"')
      .setRequired(false)
      .addChoices(
        { name: "Par", value: "par" },
        { name: "Ímpar", value: "impar" }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("duzia")
      .setDescription('Dúzia para apostar (1, 2 ou 3) se escolheu tipo "duzia"')
      .setRequired(false)
      .addChoices(
        { name: "1ª Dúzia (1-12)", value: 1 },
        { name: "2ª Dúzia (13-24)", value: 2 },
        { name: "3ª Dúzia (25-36)", value: 3 }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("coluna")
      .setDescription(
        'Coluna para apostar (1, 2 ou 3) se escolheu tipo "coluna"'
      )
      .setRequired(false)
      .addChoices(
        { name: "1ª Coluna (1, 4, 7...)", value: 1 },
        { name: "2ª Coluna (2, 5, 8...)", value: 2 },
        { name: "3ª Coluna (3, 6, 9...)", value: 3 }
      )
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const aposta = interaction.options.getInteger("aposta");
    const tipoAposta = interaction.options.getString("tipo");

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

    // Obter valores da aposta com base no tipo
    let valorAposta;
    let descricaoAposta;

    switch (tipoAposta) {
      case "numero":
        valorAposta = interaction.options.getInteger("numero");
        if (valorAposta === null) {
          const embedErro = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Parâmetro Faltando",
            mensagem: "Você precisa especificar um número para apostar.",
          });
          return interaction.editReply({ embeds: [embedErro] });
        }
        descricaoAposta = `Número: ${valorAposta}`;
        break;

      case "cor":
        valorAposta = interaction.options.getString("cor");
        if (!valorAposta) {
          const embedErro = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Parâmetro Faltando",
            mensagem: "Você precisa especificar uma cor para apostar.",
          });
          return interaction.editReply({ embeds: [embedErro] });
        }
        descricaoAposta = `Cor: ${
          valorAposta === "red" ? "🔴 Vermelho" : "⚫ Preto"
        }`;
        break;

      case "paridade":
        valorAposta = interaction.options.getString("paridade");
        if (!valorAposta) {
          const embedErro = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Parâmetro Faltando",
            mensagem: "Você precisa especificar par ou ímpar para apostar.",
          });
          return interaction.editReply({ embeds: [embedErro] });
        }
        descricaoAposta = `${valorAposta === "par" ? "Par" : "Ímpar"}`;
        break;

      case "duzia":
        valorAposta = interaction.options.getInteger("duzia");
        if (!valorAposta) {
          const embedErro = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Parâmetro Faltando",
            mensagem: "Você precisa especificar uma dúzia para apostar.",
          });
          return interaction.editReply({ embeds: [embedErro] });
        }
        const duziaRanges = {
          1: "1-12",
          2: "13-24",
          3: "25-36",
        };
        descricaoAposta = `${valorAposta}ª Dúzia (${duziaRanges[valorAposta]})`;
        break;

      case "coluna":
        valorAposta = interaction.options.getInteger("coluna");
        if (!valorAposta) {
          const embedErro = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Parâmetro Faltando",
            mensagem: "Você precisa especificar uma coluna para apostar.",
          });
          return interaction.editReply({ embeds: [embedErro] });
        }
        descricaoAposta = `${valorAposta}ª Coluna`;
        break;
    }

    // Registrar a aposta
    const apostaRegistrada = await casinoService.registerBet(
      userId,
      aposta,
      "roleta"
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

    // Girar a roleta e obter o resultado
    const resultado = casinoService.spinRoulette();

    // Determinar se ganhou ou perdeu
    let ganhou = false;
    let multiplicador = 1;

    switch (tipoAposta) {
      case "numero":
        ganhou = resultado.number === valorAposta;
        multiplicador = casinoService.MULTIPLICADORES.roleta.numero;
        break;

      case "cor":
        ganhou = resultado.color === valorAposta;
        multiplicador = casinoService.MULTIPLICADORES.roleta.cor;
        break;

      case "paridade":
        // 0 não é nem par nem ímpar na roleta
        if (resultado.number === 0) {
          ganhou = false;
        } else {
          const ehPar = resultado.number % 2 === 0;
          ganhou =
            (valorAposta === "par" && ehPar) ||
            (valorAposta === "impar" && !ehPar);
        }
        multiplicador = casinoService.MULTIPLICADORES.roleta.parImpar;
        break;

      case "duzia":
        ganhou = resultado.dozen === valorAposta;
        multiplicador = casinoService.MULTIPLICADORES.roleta.duziaColuna;
        break;

      case "coluna":
        ganhou = resultado.column === valorAposta;
        multiplicador = casinoService.MULTIPLICADORES.roleta.duziaColuna;
        break;
    }

    // Calcular o ganho
    const ganho = ganhou ? aposta * multiplicador : 0;

    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(
      userId,
      aposta,
      ganho,
      "roleta"
    );

    // Formatar mensagem de resultado
    let mensagemResultado;
    let corNumero;
    let resultadoParidade;

    // Determinar cor do número para exibição
    if (resultado.number === 0) {
      corNumero = "🟢"; // Verde para zero
    } else if (resultado.color === "red") {
      corNumero = "🔴"; // Vermelho
    } else {
      corNumero = "⚫"; // Preto
    }

    // Determinar paridade do resultado
    if (resultado.number === 0) {
      resultadoParidade = "Zero";
    } else if (resultado.number % 2 === 0) {
      resultadoParidade = "Par";
    } else {
      resultadoParidade = "Ímpar";
    }

    if (ganhou) {
      mensagemResultado = `**🎉 VOCÊ GANHOU!** A roleta parou em **${corNumero} ${resultado.number}**.\nSua aposta: **${descricaoAposta}**\nGanhou **${ganho} fichas** (${multiplicador}x sua aposta)!`;
    } else {
      mensagemResultado = `**❌ VOCÊ PERDEU!** A roleta parou em **${corNumero} ${resultado.number}**.\nSua aposta: **${descricaoAposta}**\nPerdeu ${aposta} fichas.`;
    }

    // Criar informações detalhadas do resultado
    const detalhesResultado = [
      `Número: ${corNumero} ${resultado.number}`,
      `Cor: ${
        resultado.color === "red"
          ? "🔴 Vermelho"
          : resultado.color === "black"
          ? "⚫ Preto"
          : "🟢 Verde"
      }`,
      `Paridade: ${resultadoParidade}`,
      `Dúzia: ${resultado.dozen ? `${resultado.dozen}ª` : "Zero"}`,
      `Coluna: ${resultado.column ? `${resultado.column}ª` : "Zero"}`,
    ].join("\n");

    // Criar o embed
    const embed = new EmbedBuilder()
      .setColor(ganhou ? 0x00ff00 : 0xff0000) // Verde para vitória, vermelho para derrota
      .setTitle("🎡 Roleta 🎡")
      .setDescription(mensagemResultado)
      .addFields(
        { name: "🎯 Resultado", value: detalhesResultado, inline: false },
        {
          name: "💰 Aposta",
          value: `${aposta} fichas em ${descricaoAposta}`,
          inline: true,
        },
        { name: "🎟️ Fichas Atuais", value: `${novasFichas}`, inline: true }
      )
      .setFooter({ text: `Jogado por ${interaction.user.username}` })
      .setTimestamp();

    // Criar botões para jogar novamente
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("roleta_again")
        .setLabel("Mesma Aposta")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎡"),
      new ButtonBuilder()
        .setCustomId("roleta_dobrar")
        .setLabel(`Dobrar (${aposta * 2})`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji("💰")
        .setDisabled(novasFichas < aposta * 2)
    );

    // Adicionar menu de seleção para nova aposta
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("roleta_nova_aposta")
        .setPlaceholder("Selecione uma nova aposta...")
        .addOptions([
          {
            label: "Apostar na cor vermelha",
            value: "cor_red",
            emoji: "🔴",
            description: "Aposte nas casas vermelhas (2x)",
          },
          {
            label: "Apostar na cor preta",
            value: "cor_black",
            emoji: "⚫",
            description: "Aposte nas casas pretas (2x)",
          },
          {
            label: "Apostar em par",
            value: "par",
            emoji: "2️⃣",
            description: "Aposte nos números pares (2x)",
          },
          {
            label: "Apostar em ímpar",
            value: "impar",
            emoji: "1️⃣",
            description: "Aposte nos números ímpares (2x)",
          },
          {
            label: "Apostar no zero",
            value: "zero",
            emoji: "0️⃣",
            description: "Aposte no número zero (36x)",
          },
          {
            label: "Apostar na 1ª dúzia",
            value: "duzia_1",
            emoji: "🔢",
            description: "Aposte nos números 1-12 (3x)",
          },
          {
            label: "Apostar na 2ª dúzia",
            value: "duzia_2",
            emoji: "🔢",
            description: "Aposte nos números 13-24 (3x)",
          },
          {
            label: "Apostar na 3ª dúzia",
            value: "duzia_3",
            emoji: "🔢",
            description: "Aposte nos números 25-36 (3x)",
          },
        ])
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row, selectRow],
    });

    // Criar coletor para os botões e menu
    const collector = reply.createMessageComponentCollector({
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: "Você não pode usar estes controles.",
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();

      // Para botões
      if (i.componentType === ComponentType.Button) {
        if (i.customId === "roleta_again") {
          // Jogar novamente com a mesma aposta
          const newCommand = {
            options: new Map(),
          };

          // Recriar as opções da aposta original
          newCommand.options.getInteger = (name) => {
            if (name === "aposta") return aposta;
            if (name === "numero" && tipoAposta === "numero")
              return valorAposta;
            if (name === "duzia" && tipoAposta === "duzia") return valorAposta;
            if (name === "coluna" && tipoAposta === "coluna")
              return valorAposta;
            return null;
          };

          newCommand.options.getString = (name) => {
            if (name === "tipo") return tipoAposta;
            if (name === "cor" && tipoAposta === "cor") return valorAposta;
            if (name === "paridade" && tipoAposta === "paridade")
              return valorAposta;
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
        } else if (i.customId === "roleta_dobrar") {
          // Jogar novamente com aposta dobrada
          const newCommand = {
            options: new Map(),
          };

          // Recriar as opções da aposta original
          newCommand.options.getInteger = (name) => {
            if (name === "aposta") return aposta * 2;
            if (name === "numero" && tipoAposta === "numero")
              return valorAposta;
            if (name === "duzia" && tipoAposta === "duzia") return valorAposta;
            if (name === "coluna" && tipoAposta === "coluna")
              return valorAposta;
            return null;
          };

          newCommand.options.getString = (name) => {
            if (name === "tipo") return tipoAposta;
            if (name === "cor" && tipoAposta === "cor") return valorAposta;
            if (name === "paridade" && tipoAposta === "paridade")
              return valorAposta;
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
      }
      // Para menu de seleção
      else if (i.componentType === ComponentType.StringSelect) {
        if (i.customId === "roleta_nova_aposta") {
          const opcaoSelecionada = i.values[0];

          // Criar um novo comando de interação com a nova aposta
          const newCommand = {
            options: new Map(),
          };

          // Configurar as opções com base na seleção
          newCommand.options.getInteger = (name) => {
            if (name === "aposta") return aposta;

            if (opcaoSelecionada === "zero" && name === "numero") return 0;

            if (opcaoSelecionada.startsWith("duzia_") && name === "duzia") {
              return parseInt(opcaoSelecionada.split("_")[1]);
            }

            return null;
          };

          newCommand.options.getString = (name) => {
            if (name === "tipo") {
              if (opcaoSelecionada === "zero") return "numero";
              if (opcaoSelecionada.startsWith("cor_")) return "cor";
              if (opcaoSelecionada === "par" || opcaoSelecionada === "impar")
                return "paridade";
              if (opcaoSelecionada.startsWith("duzia_")) return "duzia";
              return null;
            }

            if (name === "cor" && opcaoSelecionada.startsWith("cor_")) {
              return opcaoSelecionada.split("_")[1]; // red ou black
            }

            if (
              name === "paridade" &&
              (opcaoSelecionada === "par" || opcaoSelecionada === "impar")
            ) {
              return opcaoSelecionada;
            }

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
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        // Desativar os componentes após o tempo limite
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true),
          ButtonBuilder.from(row.components[1]).setDisabled(true)
        );

        const disabledSelectRow = new ActionRowBuilder().addComponents(
          StringSelectMenuBuilder.from(selectRow.components[0])
            .setDisabled(true)
            .setPlaceholder("Menu expirado")
        );

        await interaction
          .editReply({
            components: [disabledRow, disabledSelectRow],
          })
          .catch(console.error);
      }
    });
  } catch (error) {
    console.error("Erro ao executar comando roleta:", error);

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
