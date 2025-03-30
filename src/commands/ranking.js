// ranking.js - Com formatação brasileira
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase, ref, get, query, orderByChild } from "firebase/database";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("ranking")
  .setDescription("Mostra o ranking dos usuários mais ricos do servidor")
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

    // Obter a página solicitada (padrão: 1)
    const pagina = interaction.options.getInteger("pagina") || 1;
    const itensPorPagina = 10;

    // Obter todos os usuários e ordenar manualmente
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
      .setTitle("💰 Ranking de Riqueza 💰")
      .setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`)
      .setFooter({
        text: `Página ${pagina} de ${
          totalPaginas || 1
        } • Total de ${totalUsuarios} usuários`,
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao executar comando ranking:", error);
    return interaction.editReply(
      "Ocorreu um erro ao carregar o ranking. Tente novamente mais tarde."
    );
  }
}
