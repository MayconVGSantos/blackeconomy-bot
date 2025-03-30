// ranking.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import firebaseService from "../services/firebase.js";

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

    // Obter o ranking do Firebase
    const ranking = await firebaseService.getTopUsers(itensPorPagina, pagina);
    const totalUsuarios = await firebaseService.getTotalUsersCount();
    const totalPaginas = Math.ceil(totalUsuarios / itensPorPagina);

    if (ranking.length === 0) {
      return interaction.editReply(
        "Nenhum usuário encontrado para esta página do ranking."
      );
    }

    // Resolver nomes de usuários
    const formattedRanking = await Promise.all(
      ranking.map(async (user, index) => {
        let displayName;
        try {
          const discordUser = await interaction.client.users.fetch(user.userId);
          displayName = discordUser.username;
        } catch (error) {
          displayName = `Usuário #${user.userId}`;
        }

        // Calcular a posição real no ranking
        const position = (pagina - 1) * itensPorPagina + index + 1;

        // Adicionar medalhas para os 3 primeiros do ranking geral
        let medal = "";
        if (position === 1) medal = "🥇 ";
        if (position === 2) medal = "🥈 ";
        if (position === 3) medal = "🥉 ";

        return `${medal}**${position}.** ${displayName} - R$${user.saldo.toFixed(
          2
        )}`;
      })
    );

    // Destacar o usuário atual no ranking, se estiver presente
    const posicaoUsuarioAtual = await firebaseService.getUserRanking(
      interaction.user.id
    );
    let posicaoTexto = "";
    if (posicaoUsuarioAtual) {
      posicaoTexto = `\n\nSua posição: **#${
        posicaoUsuarioAtual.position
      }** - R$${posicaoUsuarioAtual.saldo.toFixed(2)}`;
    }

    // Criar embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Dourado
      .setTitle("💰 Ranking de Riqueza 💰")
      .setDescription(`${formattedRanking.join("\n")}${posicaoTexto}`)
      .setFooter({
        text: `Página ${pagina} de ${totalPaginas || 1} • Total de ${
          ranking.length
        } usuários`,
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
