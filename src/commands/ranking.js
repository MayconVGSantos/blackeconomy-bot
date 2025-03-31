// ranking-avancado.js - Sistema de Rankings Globais e por Servidor
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getDatabase, ref, get, query, orderByChild } from "firebase/database";
import { formatarDinheiro } from "../utils/format.js";
import moralityService from "../services/morality.js";

export const data = new SlashCommandBuilder()
  .setName("ranking")
  .setDescription("Mostra diferentes rankings do bot")
  .addStringOption((option) =>
    option
      .setName("tipo")
      .setDescription("Tipo de ranking a ser exibido")
      .setRequired(false)
      .addChoices(
        { name: "🌎 Global - Todos os servidores", value: "global" },
        { name: "🏠 Local - Este servidor", value: "servidor" },
        { name: "😇 Heróis - Moralidade positiva", value: "herois" },
        { name: "😈 Vilões - Moralidade negativa", value: "viloes" }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("pagina")
      .setDescription("Número da página")
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    // Obter o tipo de ranking solicitado (padrão: global)
    const tipoRanking = interaction.options.getString("tipo") || "global";

    // Obter a página solicitada (padrão: 1)
    const pagina = interaction.options.getInteger("pagina") || 1;
    const itensPorPagina = 10;

    // Executar o tipo de ranking selecionado
    switch (tipoRanking) {
      case "global":
        await exibirRankingGlobal(interaction, pagina, itensPorPagina);
        break;
      case "servidor":
        await exibirRankingServidor(interaction, pagina, itensPorPagina);
        break;
      case "herois":
        await exibirRankingMoralidade(
          interaction,
          pagina,
          itensPorPagina,
          true
        );
        break;
      case "viloes":
        await exibirRankingMoralidade(
          interaction,
          pagina,
          itensPorPagina,
          false
        );
        break;
      default:
        await exibirRankingGlobal(interaction, pagina, itensPorPagina);
        break;
    }
  } catch (error) {
    console.error("Erro ao executar comando ranking:", error);
    // Verificar se a interação já foi respondida antes de tentar editá-la
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(
        "Ocorreu um erro ao carregar o ranking. Tente novamente mais tarde."
      );
    } else {
      await interaction.reply({
        content:
          "Ocorreu um erro ao carregar o ranking. Tente novamente mais tarde.",
        ephemeral: true,
      });
    }
  }
}

/**
 * Exibe o ranking global (todos os servidores)
 * @param {Interaction} interaction - Interação do Discord
 * @param {number} pagina - Número da página
 * @param {number} itensPorPagina - Itens por página
 * @returns {Promise<void>}
 */
async function exibirRankingGlobal(interaction, pagina, itensPorPagina) {
  try {
    // Verifica se a interação foi respondida
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const database = getDatabase();
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return interaction.editReply("Não há usuários registrados no sistema.");
    }

    // Converter em array e ordenar por saldo (decrescente)
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      users.push({
        userId: userData.userId || childSnapshot.key,
        saldo: userData.saldo || 0,
      });
    });

    // Ordenar por saldo (decrescente)
    users.sort((a, b) => b.saldo - a.saldo);

    const totalUsuarios = users.length;
    const totalPaginas = Math.ceil(totalUsuarios / itensPorPagina);

    if (pagina > totalPaginas) {
      return interaction.editReply(
        `Página inválida. O ranking possui apenas ${totalPaginas} página(s).`
      );
    }

    // Aplicar paginação
    const startIndex = (pagina - 1) * itensPorPagina;
    const endIndex = Math.min(startIndex + itensPorPagina, totalUsuarios);
    const pageUsers = users.slice(startIndex, endIndex);

    if (pageUsers.length === 0) {
      return interaction.editReply(
        "Nenhum usuário encontrado para esta página do ranking."
      );
    }

    // Resolver nomes de usuários
    const formattedRanking = await Promise.all(
      pageUsers.map(async (user, index) => {
        let displayName;
        try {
          const discordUser = await interaction.client.users.fetch(user.userId);
          displayName = discordUser.username;
        } catch (error) {
          displayName = `Usuário #${user.userId.substring(0, 6)}...`;
        }

        // Calcular a posição real no ranking
        const position = startIndex + index + 1;

        // Adicionar medalhas para os 3 primeiros do ranking geral
        let medal = "";
        if (position === 1) medal = "🥇 ";
        if (position === 2) medal = "🥈 ";
        if (position === 3) medal = "🥉 ";

        return `${medal}**${position}.** ${displayName} - ${formatarDinheiro(
          user.saldo
        )}`;
      })
    );

    // Encontrar a posição do usuário atual
    const userIndex = users.findIndex(
      (user) => user.userId === interaction.user.id
    );
    let posicaoTexto = "";

    if (userIndex !== -1) {
      const userSaldo = users[userIndex].saldo;
      posicaoTexto = `\n\nSua posição: **#${
        userIndex + 1
      }** - ${formatarDinheiro(userSaldo)}`;
    }

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Dourado
      .setTitle("🌎 Ranking Global de Riqueza 💰")
      .setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`)
      .setFooter({
        text: `Página ${pagina} de ${
          totalPaginas || 1
        } • Total de ${totalUsuarios} usuários globalmente`,
      })
      .setTimestamp();

    // Criar menu para alternar entre tipos de ranking
    const row = createRankingMenuRow();
    const buttonRow = createNavigationButtons(pagina, totalPaginas);

    // Enviar mensagem com o menu
    await interaction.editReply({
      embeds: [embed],
      components: [row, buttonRow],
    });

    // Configurar coletor para o menu e botões
    setupComponentCollector(interaction, "global", pagina, totalPaginas);
  } catch (error) {
    console.error("Erro ao exibir ranking global:", error);
    return interaction.editReply(
      "Ocorreu um erro ao carregar o ranking global. Tente novamente mais tarde."
    );
  }
}

/**
 * Exibe o ranking do servidor atual
 * @param {Interaction} interaction - Interação do Discord
 * @param {number} pagina - Número da página
 * @param {number} itensPorPagina - Itens por página
 * @returns {Promise<void>}
 */
async function exibirRankingServidor(interaction, pagina, itensPorPagina) {
  try {
    // Verifica se a interação foi respondida
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const database = getDatabase();
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    const serverId = interaction.guildId;

    if (!snapshot.exists()) {
      return interaction.editReply("Não há usuários registrados no sistema.");
    }

    // Buscar membros do servidor
    const serverMembers = await interaction.guild.members.fetch();
    const serverMemberIds = serverMembers.map((member) => member.id);

    // Converter em array e filtrar apenas usuários do servidor atual
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      const userId = userData.userId || childSnapshot.key;

      // Verificar se o usuário está no servidor atual
      if (serverMemberIds.includes(userId)) {
        users.push({
          userId: userId,
          saldo: userData.saldo || 0,
        });
      }
    });

    // Ordenar por saldo (decrescente)
    users.sort((a, b) => b.saldo - a.saldo);

    const totalUsuarios = users.length;
    const totalPaginas = Math.ceil(totalUsuarios / itensPorPagina);

    if (pagina > totalPaginas) {
      return interaction.editReply(
        `Página inválida. O ranking possui apenas ${totalPaginas} página(s).`
      );
    }

    // Aplicar paginação
    const startIndex = (pagina - 1) * itensPorPagina;
    const endIndex = Math.min(startIndex + itensPorPagina, totalUsuarios);
    const pageUsers = users.slice(startIndex, endIndex);

    if (pageUsers.length === 0) {
      return interaction.editReply(
        "Nenhum usuário encontrado para esta página do ranking."
      );
    }

    // Resolver nomes de usuários
    const formattedRanking = await Promise.all(
      pageUsers.map(async (user, index) => {
        let displayName;
        try {
          const member = serverMembers.get(user.userId);
          displayName = member.nickname || member.user.username;
        } catch (error) {
          displayName = `Usuário #${user.userId.substring(0, 6)}...`;
        }

        // Calcular a posição real no ranking
        const position = startIndex + index + 1;

        // Adicionar medalhas para os 3 primeiros do ranking
        let medal = "";
        if (position === 1) medal = "🥇 ";
        if (position === 2) medal = "🥈 ";
        if (position === 3) medal = "🥉 ";

        return `${medal}**${position}.** ${displayName} - ${formatarDinheiro(
          user.saldo
        )}`;
      })
    );

    // Encontrar a posição do usuário atual
    const userIndex = users.findIndex(
      (user) => user.userId === interaction.user.id
    );
    let posicaoTexto = "";

    if (userIndex !== -1) {
      const userSaldo = users[userIndex].saldo;
      posicaoTexto = `\n\nSua posição: **#${
        userIndex + 1
      }** - ${formatarDinheiro(userSaldo)}`;
    }

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Azul
      .setTitle(`🏠 Ranking do Servidor: ${interaction.guild.name}`)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`)
      .setFooter({
        text: `Página ${pagina} de ${
          totalPaginas || 1
        } • Total de ${totalUsuarios} usuários neste servidor`,
      })
      .setTimestamp();

    // Criar menu para alternar entre tipos de ranking
    const row = createRankingMenuRow();
    const buttonRow = createNavigationButtons(pagina, totalPaginas);

    // Enviar mensagem com o menu
    await interaction.editReply({
      embeds: [embed],
      components: [row, buttonRow],
    });

    // Configurar coletor para o menu e botões
    setupComponentCollector(interaction, "servidor", pagina, totalPaginas);
  } catch (error) {
    console.error("Erro ao exibir ranking do servidor:", error);
    return interaction.editReply(
      "Ocorreu um erro ao carregar o ranking do servidor. Tente novamente mais tarde."
    );
  }
}

/**
 * Exibe o ranking de moralidade (heróis ou vilões)
 * @param {Interaction} interaction - Interação do Discord
 * @param {number} pagina - Número da página
 * @param {number} itensPorPagina - Itens por página
 * @param {boolean} herois - True para heróis, false para vilões
 * @returns {Promise<void>}
 */
async function exibirRankingMoralidade(
  interaction,
  pagina,
  itensPorPagina,
  herois
) {
  try {
    // Verifica se a interação foi respondida
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const database = getDatabase();
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return interaction.editReply("Não há usuários registrados no sistema.");
    }

    // Converter em array
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      const userId = userData.userId || childSnapshot.key;
      const morality = userData.morality || 0;
      const saldo = userData.saldo || 0;

      // Filtrar apenas heróis ou vilões com base no parâmetro
      const isHeroi = morality > 0;
      if ((herois && isHeroi) || (!herois && !isHeroi)) {
        users.push({
          userId,
          saldo,
          morality,
        });
      }
    });

    // Ordenação específica para cada tipo de ranking
    if (herois) {
      // Para heróis: ordenar por moralidade (decrescente) e depois por saldo (decrescente)
      users.sort((a, b) => {
        if (b.morality !== a.morality) return b.morality - a.morality;
        return b.saldo - a.saldo;
      });
    } else {
      // Para vilões: ordenar por moralidade (crescente) e depois por saldo (decrescente)
      users.sort((a, b) => {
        if (a.morality !== b.morality) return a.morality - b.morality;
        return b.saldo - a.saldo;
      });
    }

    const totalUsuarios = users.length;
    const totalPaginas = Math.ceil(totalUsuarios / itensPorPagina);

    if (pagina > totalPaginas) {
      return interaction.editReply(
        `Página inválida. O ranking possui apenas ${totalPaginas} página(s).`
      );
    }

    // Aplicar paginação
    const startIndex = (pagina - 1) * itensPorPagina;
    const endIndex = Math.min(startIndex + itensPorPagina, totalUsuarios);
    const pageUsers = users.slice(startIndex, endIndex);

    if (pageUsers.length === 0) {
      return interaction.editReply(
        `Nenhum ${
          herois ? "herói" : "vilão"
        } encontrado para esta página do ranking.`
      );
    }

    // Resolver nomes de usuários
    const formattedRanking = await Promise.all(
      pageUsers.map(async (user, index) => {
        let displayName;
        try {
          const discordUser = await interaction.client.users.fetch(user.userId);
          displayName = discordUser.username;
        } catch (error) {
          displayName = `Usuário #${user.userId.substring(0, 6)}...`;
        }

        // Calcular a posição real no ranking
        const position = startIndex + index + 1;

        // Adicionar medalhas para os 3 primeiros do ranking
        let medal = "";
        if (position === 1) medal = "🥇 ";
        if (position === 2) medal = "🥈 ";
        if (position === 3) medal = "🥉 ";

        // Obter título de moralidade
        const { title, emoji } = moralityService.getMoralityTitle(
          user.morality
        );

        return `${medal}**${position}.** ${emoji} ${displayName} - ${formatarDinheiro(
          user.saldo
        )} - Moral: ${user.morality} (${title})`;
      })
    );

    // Encontrar a posição do usuário atual, se aplicável
    let posicaoTexto = "";
    const userMorality = await moralityService.getMorality(interaction.user.id);
    const isUserEligible =
      (herois && userMorality > 0) || (!herois && userMorality <= 0);

    if (isUserEligible) {
      const userIndex = users.findIndex(
        (user) => user.userId === interaction.user.id
      );

      if (userIndex !== -1) {
        const userData = users[userIndex];
        const { title, emoji } = moralityService.getMoralityTitle(
          userData.morality
        );
        posicaoTexto = `\n\nSua posição: **#${
          userIndex + 1
        }** - ${formatarDinheiro(userData.saldo)} - Moral: ${
          userData.morality
        } (${title} ${emoji})`;
      }
    }

    // Criar embed com cores diferentes para heróis e vilões
    const embed = new EmbedBuilder()
      .setColor(herois ? 0x00ff00 : 0xff0000) // Verde para heróis, vermelho para vilões
      .setTitle(
        `${herois ? "😇 Ranking de Heróis" : "😈 Ranking de Vilões"} 💰`
      )
      .setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`)
      .setFooter({
        text: `Página ${pagina} de ${
          totalPaginas || 1
        } • Total de ${totalUsuarios} ${herois ? "heróis" : "vilões"}`,
      })
      .setTimestamp();

    // Criar menu para alternar entre tipos de ranking
    const row = createRankingMenuRow();
    const buttonRow = createNavigationButtons(pagina, totalPaginas);

    // Enviar mensagem com o menu
    await interaction.editReply({
      embeds: [embed],
      components: [row, buttonRow],
    });

    // Configurar coletor para o menu e botões
    setupComponentCollector(
      interaction,
      herois ? "herois" : "viloes",
      pagina,
      totalPaginas
    );
  } catch (error) {
    console.error("Erro ao exibir ranking de moralidade:", error);
    return interaction.editReply(
      "Ocorreu um erro ao carregar o ranking de moralidade. Tente novamente mais tarde."
    );
  }
}

/**
 * Cria o menu dropdown para seleção de tipos de ranking
 * @returns {ActionRowBuilder} - Linha com o menu
 */
function createRankingMenuRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ranking_menu")
      .setPlaceholder("Selecione o tipo de ranking")
      .addOptions([
        {
          label: "Ranking Global",
          description: "Todos os usuários do bot",
          value: "global",
          emoji: "🌎",
        },
        {
          label: "Ranking do Servidor",
          description: "Apenas usuários deste servidor",
          value: "servidor",
          emoji: "🏠",
        },
        {
          label: "Ranking de Heróis",
          description: "Usuários com moralidade positiva",
          value: "herois",
          emoji: "😇",
        },
        {
          label: "Ranking de Vilões",
          description: "Usuários com moralidade negativa",
          value: "viloes",
          emoji: "😈",
        },
      ])
  );
}

/**
 * Cria botões de navegação para o ranking
 * @param {number} currentPage - Página atual
 * @param {number} totalPages - Total de páginas
 * @returns {ActionRowBuilder} - Linha com botões
 */
function createNavigationButtons(currentPage, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ranking_prev")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
      .setDisabled(currentPage <= 1),

    new ButtonBuilder()
      .setCustomId("ranking_page")
      .setLabel(`Página ${currentPage} de ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("ranking_next")
      .setLabel("Próxima")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("➡️")
      .setDisabled(currentPage >= totalPages)
  );
}

/**
 * Configura o coletor de componentes para o menu e botões
 * @param {Interaction} interaction - Interação do Discord
 * @param {string} currentType - Tipo atual de ranking
 * @param {number} currentPage - Página atual
 * @param {number} totalPages - Total de páginas
 */
function setupComponentCollector(
  interaction,
  currentType,
  currentPage,
  totalPages
) {
  // Usa a própria mensagem de resposta para criar o coletor (mais seguro)
  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === interaction.user.id &&
      i.message.interaction?.id === interaction.id,
    time: 300000, // 5 minutos
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    if (i.customId === "ranking_menu") {
      const newType = i.values[0];
      // Executar com nova seleção e página 1
      try {
        collector.stop();
        switch (newType) {
          case "global":
            await exibirRankingGlobal(interaction, 1, 10);
            break;
          case "servidor":
            await exibirRankingServidor(interaction, 1, 10);
            break;
          case "herois":
            await exibirRankingMoralidade(interaction, 1, 10, true);
            break;
          case "viloes":
            await exibirRankingMoralidade(interaction, 1, 10, false);
            break;
        }
      } catch (error) {
        console.error("Erro ao mudar o tipo de ranking:", error);
      }
    } else if (i.customId === "ranking_prev" && currentPage > 1) {
      try {
        collector.stop();

        // Executar com página anterior
        switch (currentType) {
          case "global":
            await exibirRankingGlobal(interaction, currentPage - 1, 10);
            break;
          case "servidor":
            await exibirRankingServidor(interaction, currentPage - 1, 10);
            break;
          case "herois":
            await exibirRankingMoralidade(
              interaction,
              currentPage - 1,
              10,
              true
            );
            break;
          case "viloes":
            await exibirRankingMoralidade(
              interaction,
              currentPage - 1,
              10,
              false
            );
            break;
        }
      } catch (error) {
        console.error("Erro ao navegar para a página anterior:", error);
      }
    } else if (i.customId === "ranking_next" && currentPage < totalPages) {
      try {
        collector.stop();

        // Executar com próxima página
        switch (currentType) {
          case "global":
            await exibirRankingGlobal(interaction, currentPage + 1, 10);
            break;
          case "servidor":
            await exibirRankingServidor(interaction, currentPage + 1, 10);
            break;
          case "herois":
            await exibirRankingMoralidade(
              interaction,
              currentPage + 1,
              10,
              true
            );
            break;
          case "viloes":
            await exibirRankingMoralidade(
              interaction,
              currentPage + 1,
              10,
              false
            );
            break;
        }
      } catch (error) {
        console.error("Erro ao navegar para a próxima página:", error);
      }
    }
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      // Desativar componentes quando expirar o tempo
      try {
        const fetchedReply = await interaction.fetchReply();

        // Mesmos componentes, mas desativados
        const disabledRow = new ActionRowBuilder().addComponents(
          StringSelectMenuBuilder.from(
            (await interaction.fetchReply()).components[0].components[0]
          ).setDisabled(true)
        );

        const disabledButtonRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(
            (await interaction.fetchReply()).components[1].components[0]
          ).setDisabled(true),
          ButtonBuilder.from(
            (await interaction.fetchReply()).components[1].components[1]
          ).setDisabled(true),
          ButtonBuilder.from(
            (await interaction.fetchReply()).components[1].components[2]
          ).setDisabled(true)
        );

        await interaction.editReply({
          components: [disabledRow, disabledButtonRow],
        });
      } catch (error) {
        console.error(
          "Erro ao desativar componentes após tempo esgotado:",
          error
        );
      }
    }
  });
}
