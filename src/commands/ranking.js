// ranking.js - Versão super simplificada do comando de ranking
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase, ref, get } from "firebase/database";
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
        { name: "🏠 Local - Apenas este servidor", value: "servidor" },
        { name: "😇 Heróis - Moralidade > 0", value: "herois" },
        { name: "😈 Vilões - Moralidade < 0", value: "viloes" }
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
  // Usamos try/catch para capturar erros, mas respondemos apenas no final
  try {
    // Resposta imediata para evitar timeout
    await interaction.deferReply();

    // Obter configurações básicas
    const tipoRanking = interaction.options.getString("tipo") || "global";
    const pagina = interaction.options.getInteger("pagina") || 1;
    const itensPorPagina = 10;

    // Acessar banco de dados
    const database = getDatabase();
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return await interaction.editReply(
        "Não há usuários registrados no sistema."
      );
    }

    // Arrays para armazenar usuários filtrados
    let users = [];

    // Filtrar usuários com base no tipo de ranking
    if (tipoRanking === "servidor") {
      // Obter membros do servidor
      const serverMembers = await interaction.guild.members.fetch();
      const serverMemberIds = Array.from(serverMembers.keys());

      // Filtrar apenas usuários do servidor
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        const userId = userData.userId || childSnapshot.key;

        if (serverMemberIds.includes(userId)) {
          users.push({
            userId: userId,
            saldo: userData.saldo || 0,
            morality: userData.morality || 0,
          });
        }
      });
    } else if (tipoRanking === "herois") {
      // Filtrar apenas usuários com moralidade positiva
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        const morality = userData.morality || 0;

        if (morality > 0) {
          users.push({
            userId: userData.userId || childSnapshot.key,
            saldo: userData.saldo || 0,
            morality: morality,
          });
        }
      });
    } else if (tipoRanking === "viloes") {
      // Filtrar apenas usuários com moralidade negativa
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        const morality = userData.morality || 0;

        if (morality < 0) {
          users.push({
            userId: userData.userId || childSnapshot.key,
            saldo: userData.saldo || 0,
            morality: morality,
          });
        }
      });
    } else {
      // Ranking global - todos os usuários
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        users.push({
          userId: userData.userId || childSnapshot.key,
          saldo: userData.saldo || 0,
          morality: userData.morality || 0,
        });
      });
    }

    // Verificar se o ranking está vazio após filtrar
    if (users.length === 0) {
      let mensagem = "Não há usuários para exibir neste ranking.";

      if (tipoRanking === "herois") {
        mensagem =
          "Não há usuários com moralidade positiva no sistema ainda. Use o comando `/trabalhar` para aumentar sua moralidade e se tornar um herói!";
      } else if (tipoRanking === "viloes") {
        mensagem =
          "Não há usuários com moralidade negativa no sistema ainda. Use o comando `/crime` para diminuir sua moralidade e se tornar um vilão!";
      }

      return await interaction.editReply(mensagem);
    }

    // Ordenar usuários com base no tipo de ranking
    if (tipoRanking === "herois") {
      // Ordenar primeiro por moralidade (maior primeiro) e depois por saldo
      users.sort((a, b) => {
        if (b.morality !== a.morality) return b.morality - a.morality;
        return b.saldo - a.saldo;
      });
    } else if (tipoRanking === "viloes") {
      // Ordenar primeiro por moralidade (menor primeiro) e depois por saldo
      users.sort((a, b) => {
        if (a.morality !== b.morality) return a.morality - b.morality;
        return b.saldo - a.saldo;
      });
    } else {
      // Ordenar apenas por saldo (maior primeiro)
      users.sort((a, b) => b.saldo - a.saldo);
    }

    // Calcular paginação
    const totalUsuarios = users.length;
    const totalPaginas = Math.ceil(totalUsuarios / itensPorPagina);

    // Verificar se a página solicitada é válida
    if (pagina > totalPaginas) {
      return await interaction.editReply(
        `Página inválida. O ranking possui apenas ${totalPaginas} página(s).`
      );
    }

    // Aplicar paginação
    const startIndex = (pagina - 1) * itensPorPagina;
    const endIndex = Math.min(startIndex + itensPorPagina, totalUsuarios);
    const pageUsers = users.slice(startIndex, endIndex);

    // Construir o ranking formatado
    let formattedRanking = [];

    for (let i = 0; i < pageUsers.length; i++) {
      const user = pageUsers[i];
      const position = startIndex + i + 1;

      // Obter username
      let displayName;
      try {
        const discordUser = await interaction.client.users.fetch(user.userId);
        displayName = discordUser.username;
      } catch (error) {
        // Fallback se não conseguir obter o usuário
        displayName = `Usuário #${user.userId.substring(0, 6)}...`;
      }

      // Adicionar medalhas para os 3 primeiros
      let medal = "";
      if (position === 1) medal = "🥇 ";
      if (position === 2) medal = "🥈 ";
      if (position === 3) medal = "🥉 ";

      // Formatar linha baseada no tipo de ranking
      if (tipoRanking === "herois" || tipoRanking === "viloes") {
        // Incluir informações de moralidade
        const { title, emoji } = moralityService.getMoralityTitle(
          user.morality
        );
        formattedRanking.push(
          `${medal}**${position}.** ${emoji} ${displayName} - ${formatarDinheiro(
            user.saldo
          )} - Moral: ${user.morality} (${title})`
        );
      } else {
        // Formato padrão (apenas saldo)
        formattedRanking.push(
          `${medal}**${position}.** ${displayName} - ${formatarDinheiro(
            user.saldo
          )}`
        );
      }
    }

    // Encontrar a posição do usuário atual
    let posicaoTexto = "";
    const userIndex = users.findIndex(
      (user) => user.userId === interaction.user.id
    );

    if (userIndex !== -1) {
      const userData = users[userIndex];

      if (tipoRanking === "herois" || tipoRanking === "viloes") {
        // Incluir informações de moralidade
        const { title, emoji } = moralityService.getMoralityTitle(
          userData.morality
        );
        posicaoTexto = `\n\nSua posição: **#${
          userIndex + 1
        }** - ${formatarDinheiro(userData.saldo)} - Moral: ${
          userData.morality
        } (${title} ${emoji})`;
      } else {
        // Formato padrão (apenas posição e saldo)
        posicaoTexto = `\n\nSua posição: **#${
          userIndex + 1
        }** - ${formatarDinheiro(userData.saldo)}`;
      }
    } else if (tipoRanking === "herois" || tipoRanking === "viloes") {
      // Mensagem personalizada se o usuário não estiver no ranking
      const userMorality = await moralityService.getMorality(
        interaction.user.id
      );
      const { title, emoji } = moralityService.getMoralityTitle(userMorality);

      posicaoTexto =
        tipoRanking === "herois"
          ? `\n\nVocê não está neste ranking. Sua moralidade atual é ${userMorality} (${title} ${emoji}). Use o comando \`/trabalhar\` para aumentá-la!`
          : `\n\nVocê não está neste ranking. Sua moralidade atual é ${userMorality} (${title} ${emoji}). Use o comando \`/crime\` para diminuí-la!`;
    }

    // Criar o embed
    const embed = new EmbedBuilder();

    // Definir cor e título
    switch (tipoRanking) {
      case "global":
        embed
          .setColor(0xffd700) // Dourado
          .setTitle("🌎 Ranking Global de Riqueza 💰");
        break;

      case "servidor":
        embed
          .setColor(0x3498db) // Azul
          .setTitle(`🏠 Ranking do Servidor: ${interaction.guild.name}`)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }));
        break;

      case "herois":
        embed
          .setColor(0x00ff00) // Verde
          .setTitle("😇 Ranking de Heróis 💰");
        break;

      case "viloes":
        embed
          .setColor(0xff0000) // Vermelho
          .setTitle("😈 Ranking de Vilões 💰");
        break;
    }

    // Adicionar descrição e informações
    embed.setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`);

    // Adicionar rodapé
    embed.setFooter({
      text: `Página ${pagina} de ${
        totalPaginas || 1
      } • Total de ${totalUsuarios} ${
        tipoRanking === "herois"
          ? "heróis"
          : tipoRanking === "viloes"
          ? "vilões"
          : tipoRanking === "servidor"
          ? "usuários neste servidor"
          : "usuários globalmente"
      }`,
    });

    embed.setTimestamp();

    // Adicionar informação extra para heróis e vilões
    if (tipoRanking === "herois" || tipoRanking === "viloes") {
      embed.addFields({
        name: "ℹ️ Informação",
        value:
          tipoRanking === "herois"
            ? "Este ranking mostra apenas usuários com moralidade > 0"
            : "Este ranking mostra apenas usuários com moralidade < 0",
        inline: false,
      });
    }

    // Enviar o embed final
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(
      `Erro ao executar comando ranking [${error.message}]:`,
      error
    );

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Ocorreu um erro ao carregar o ranking. Tente novamente mais tarde.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Ocorreu um erro ao carregar o ranking. Tente novamente mais tarde.",
          ephemeral: true,
        });
      }
    } catch (e) {
      console.error("Não foi possível enviar uma mensagem de erro:", e);
    }
    
  }
}
