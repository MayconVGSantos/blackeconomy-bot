// embed.js
import { EmbedBuilder } from "discord.js";

/**
 * Utilitários para criação de embeds do Discord
 * Com suporte para diferentes tipos de embeds usados no bot
 */
class EmbedUtils {
  /**
   * Cria um embed para resposta de comando de economia
   * @param {Object} options - Opções para o embed
   * @param {string} options.usuario - Nome do usuário
   * @param {string} options.avatarURL - URL do avatar do usuário
   * @param {string} options.conteudo - Conteúdo da mensagem
   * @param {number} options.valor - Valor ganho/perdido
   * @param {number} options.novoSaldo - Novo saldo do usuário
   * @param {boolean} options.ganhou - Se o usuário ganhou ou perdeu
   * @param {string} options.comando - Nome do comando executado
   * @returns {EmbedBuilder} - Embed construído
   */
  criarEmbedEconomia({
    usuario,
    avatarURL,
    conteudo,
    valor,
    novoSaldo,
    ganhou = true,
    comando,
  }) {
    // Determinar cores baseadas no resultado
    const cor = ganhou ? 0x00ff00 : 0xff0000; // Verde para ganho, vermelho para perda

    // Determinar icone baseado no comando
    let icone;
    switch (comando) {
      case "trabalhar":
        icone = "💼";
        break;
      case "seduzir":
        icone = "💋";
        break;
      case "crime":
        icone = "🔪";
        break;
      default:
        icone = "💰";
    }

    // Criar o embed
    return new EmbedBuilder()
      .setColor(cor)
      .setTitle(
        `${icone} ${comando.charAt(0).toUpperCase() + comando.slice(1)}`
      )
      .setDescription(conteudo)
      .setThumbnail(avatarURL)
      .addFields(
        {
          name: "💰 Valor",
          value: `${ganhou ? "+" : "-"}R$${Math.abs(valor).toFixed(2)}`,
          inline: true,
        },
        {
          name: "💰 Novo Saldo",
          value: `R$${novoSaldo.toFixed(2)}`,
          inline: true,
        }
      )
      .setFooter({ text: `Requisitado por ${usuario}` })
      .setTimestamp();
  }

  /**
   * Cria um embed para mensagem de erro de cooldown
   * @param {Object} options - Opções para o embed
   * @param {string} options.usuario - Nome do usuário
   * @param {string} options.comando - Nome do comando
   * @param {number} options.tempoRestante - Tempo restante em ms
   * @returns {EmbedBuilder} - Embed construído
   */
  criarEmbedCooldown({ usuario, comando, tempoRestante }) {
    // Converter tempo restante para formato mais legível
    const tempoEmMinutos = Math.ceil(tempoRestante / 60000);
    const segundos = Math.ceil((tempoRestante % 60000) / 1000);

    const mensagemTempo =
      tempoEmMinutos > 0
        ? `${tempoEmMinutos} minutos e ${segundos} segundos`
        : `${segundos} segundos`;

    return new EmbedBuilder()
      .setColor(0xff9900) // Laranja para avisos
      .setTitle("⏳ Tempo de Espera")
      .setDescription(
        `Você precisa esperar **${mensagemTempo}** para usar o comando \`/${comando}\` novamente.`
      )
      .setFooter({ text: `Requisitado por ${usuario}` })
      .setTimestamp();
  }

  /**
   * Cria um embed para mensagem de erro
   * @param {Object} options - Opções para o embed
   * @param {string} options.usuario - Nome do usuário
   * @param {string} options.titulo - Título do erro
   * @param {string} options.mensagem - Mensagem de erro
   * @returns {EmbedBuilder} - Embed construído
   */
  criarEmbedErro({ usuario, titulo, mensagem }) {
    return new EmbedBuilder()
      .setColor(0xff0000) // Vermelho para erros
      .setTitle(`❌ ${titulo}`)
      .setDescription(mensagem)
      .setFooter({ text: `Requisitado por ${usuario}` })
      .setTimestamp();
  }

  /**
   * Cria um embed para exibir informações do usuário
   * @param {Object} options - Opções para o embed
   * @param {string} options.usuario - Nome do usuário
   * @param {string} options.avatarURL - URL do avatar do usuário
   * @param {number} options.saldo - Saldo do usuário
   * @returns {EmbedBuilder} - Embed construído
   */
  criarEmbedPerfil({ usuario, avatarURL, saldo }) {
    return new EmbedBuilder()
      .setColor(0x0099ff) // Azul para informações
      .setTitle(`Perfil de ${usuario}`)
      .setThumbnail(avatarURL)
      .addFields({
        name: "💰 Saldo",
        value: `R$${saldo.toFixed(2)}`,
        inline: true,
      })
      .setFooter({ text: `Perfil de ${usuario}` })
      .setTimestamp();
  }

  /**
   * Cria um embed para transferência PIX
   * @param {Object} options - Opções para o embed
   * @param {string} options.remetente - Nome do remetente
   * @param {string} options.remetenteAvatar - URL do avatar do remetente
   * @param {string} options.destinatario - Nome do destinatário
   * @param {string} options.destinatarioAvatar - URL do avatar do destinatário
   * @param {number} options.valor - Valor transferido
   * @param {number} options.saldoRemetente - Novo saldo do remetente
   * @param {number} options.saldoDestinatario - Novo saldo do destinatário
   * @returns {EmbedBuilder} - Embed construído
   */

  criarEmbedTransferencia({
    remetente,
    remetenteAvatar,
    destinatario,
    destinatarioAvatar,
    valor,
    saldoRemetente,
    saldoDestinatario,
    motivo,
  }) {
    return new EmbedBuilder()
      .setColor(0x00ff00) // Verde
      .setTitle("💸 PIX Realizado com Sucesso")
      .setDescription(
        `**${remetente}** transferiu R$${valor.toFixed(
          2
        )} para **${destinatario}**`
      )
      .setThumbnail(destinatarioAvatar)
      .addFields(
        {
          name: "💰 Valor Transferido",
          value: `R$${valor.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📤 Saldo do Remetente",
          value: `R$${saldoRemetente.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📥 Saldo do Destinatário",
          value: `R$${saldoDestinatario.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📝 Motivo",
          value: motivo || "Sem motivo especificado",
          inline: false,
        }
      )
      .setFooter({ text: `Transferência realizada por ${remetente}` })
      .setTimestamp();
  }

  /**
   * Cria um embed para o resultado do comando roubar
   * @param {Object} options - Opções para o embed
   * @param {string} options.usuario - Nome do usuário que tentou roubar
   * @param {string} options.avatarURL - URL do avatar do usuário
   * @param {string} options.alvo - Nome do alvo
   * @param {string} options.alvoAvatarURL - URL do avatar do alvo
   * @param {string} options.conteudo - Resposta gerada pela API
   * @param {number} options.valor - Valor roubado ou multa
   * @param {number} options.novoSaldoLadrao - Novo saldo do ladrão
   * @param {number} options.novoSaldoVitima - Novo saldo da vítima (opcional)
   * @param {boolean} options.sucesso - Se o roubo foi bem-sucedido
   * @returns {EmbedBuilder} - Embed construído
   */
  criarEmbedRoubo({
    usuario,
    avatarURL,
    alvo,
    alvoAvatarURL,
    conteudo,
    valor,
    novoSaldoLadrao,
    novoSaldoVitima,
    sucesso,
  }) {
    const embed = new EmbedBuilder()
      .setColor(sucesso ? 0x00ff00 : 0xff0000) // Verde para sucesso, vermelho para falha
      .setTitle(sucesso ? "🔫 Roubo Bem-Sucedido" : "🚔 Roubo Falhou")
      .setDescription(conteudo)
      .setThumbnail(sucesso ? alvoAvatarURL : avatarURL);

    if (sucesso) {
      embed.addFields(
        {
          name: "💰 Valor Roubado",
          value: `R$${valor.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📤 Seu Novo Saldo",
          value: `R$${novoSaldoLadrao.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📥 Saldo da Vítima",
          value: `R$${novoSaldoVitima.toFixed(2)}`,
          inline: true,
        }
      );
    } else {
      embed.addFields(
        {
          name: "💰 Valor da Multa",
          value: `R$${valor.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📉 Seu Novo Saldo",
          value: `R$${novoSaldoLadrao.toFixed(2)}`,
          inline: true,
        }
      );
    }

    embed.setFooter({ text: `Executado por ${usuario}` }).setTimestamp();

    return embed;
  }
}

export default new EmbedUtils();
