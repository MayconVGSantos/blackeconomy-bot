// embed.js - Com formatação brasileira
import { EmbedBuilder } from "discord.js";
import { formatarDinheiro, formatarTempoEspera } from "./format.js";

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
    let icone, titulo, descricaoComando;
    switch (comando) {
      case "trabalhar":
        icone = "💼";
        titulo = "Trabalho Concluído";
        descricaoComando = "Você trabalhou e ganhou seu salário honestamente.";
        break;
      case "seduzir":
        icone = "💋";
        titulo = ganhou ? "Sedução Bem-Sucedida" : "Sedução Fracassada";
        descricaoComando = ganhou
          ? "Você seduziu alguém e recebeu um pagamento."
          : "Sua tentativa de sedução falhou e você perdeu dinheiro.";
        break;
      case "crime":
        icone = "🔪";
        titulo = ganhou ? "Crime Bem-Sucedido" : "Crime Fracassado";
        descricaoComando = ganhou
          ? "Você cometeu um crime e conseguiu um lucro ilícito."
          : "Você foi pego cometendo um crime e recebeu uma multa.";
        break;
      default:
        icone = "💰";
        titulo = "Transação Econômica";
        descricaoComando = "";
    }

    // Formatação para progresso visual do saldo
    const barraProgresso = this.criarBarraProgresso(valor, novoSaldo);

    // Formatação de estatísticas adicionais
    let estatisticas = "";
    if (comando === "trabalhar") {
      estatisticas = "A cada trabalho, sua reputação melhora um pouco.";
    } else if (comando === "crime") {
      estatisticas = "Crimes reduzem significativamente sua reputação.";
    } else if (comando === "seduzir") {
      estatisticas =
        "Seduzir tem um pequeno impacto negativo na sua reputação.";
    }

    // Criar o embed
    const embed = new EmbedBuilder()
      .setColor(cor)
      .setTitle(`${icone} ${titulo}`)
      .setDescription(conteudo)
      .setThumbnail(avatarURL)
      .addFields(
        {
          name: "💵 Transação",
          value: `${ganhou ? "+" : "-"}${formatarDinheiro(Math.abs(valor))}`,
          inline: true,
        },
        {
          name: "💰 Novo Saldo",
          value: formatarDinheiro(novoSaldo),
          inline: true,
        },
        {
          name: "📊 Progresso",
          value: barraProgresso,
          inline: false,
        }
      )
      .setFooter({
        text: `${
          comando.charAt(0).toUpperCase() + comando.slice(1)
        } | ${usuario}`,
      })
      .setTimestamp();

    // Adicionar campo de estatísticas se existir
    if (estatisticas) {
      embed.addFields({
        name: "ℹ️ Informações",
        value: estatisticas,
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Cria uma barra de progresso visual para representar uma transação
   * @param {number} transacao - Valor da transação
   * @param {number} saldoAtual - Saldo atual depois da transação
   * @returns {string} - Barra de progresso formatada
   */
  criarBarraProgresso(transacao, saldoAtual) {
    const saldoAnterior = saldoAtual - transacao;
    const isPositivo = transacao > 0;

    // Formatação de valores para a barra
    const valorAnterior = formatarDinheiro(saldoAnterior);
    const valorNovo = formatarDinheiro(saldoAtual);
    const diferenca = formatarDinheiro(Math.abs(transacao));

    // Criar a barra visual
    const tamanho = 10;
    const barra = isPositivo
      ? `${valorAnterior} [${"▬".repeat(
          tamanho
        )}] → ${valorNovo} (+${diferenca})`
      : `${valorAnterior} [${"▬".repeat(
          tamanho
        )}] → ${valorNovo} (-${diferenca})`;

    return barra;
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
    // Usar a função formatarTempoEspera para formatar o tempo restante
    const tempoFormatado = formatarTempoEspera(tempoRestante);

    // Determinar ícone e cor baseado no comando
    let icone, cor;
    switch (comando) {
      case "trabalhar":
        icone = "💼";
        cor = 0x4287f5; // Azul trabalho
        break;
      case "seduzir":
        icone = "💋";
        cor = 0xf542e8; // Rosa sedução
        break;
      case "crime":
        icone = "🔪";
        cor = 0xf54242; // Vermelho crime
        break;
      case "roubar":
        icone = "🔫";
        cor = 0xf54242; // Vermelho roubo
        break;
      case "diario":
        icone = "🎁";
        cor = 0x42f5aa; // Verde água diário
        break;
      case "semanal":
        icone = "📅";
        cor = 0x42f5e8; // Azul claro semanal
        break;
      case "estudar":
        icone = "📚";
        cor = 0xf5b042; // Laranja estudar
        break;
      case "exame":
        icone = "📝";
        cor = 0xf5f242; // Amarelo exame
        break;
      default:
        icone = "⏳";
        cor = 0xff9900; // Laranja padrão para avisos
    }

    // Criar o embed
    return new EmbedBuilder()
      .setColor(cor)
      .setTitle(`${icone} Tempo de Espera: /${comando}`)
      .setDescription(
        `Você precisa esperar **${tempoFormatado}** para usar o comando \`/${comando}\` novamente.`
      )
      .addFields(
        {
          name: "⏱️ Tempo Restante",
          value: tempoFormatado,
          inline: true,
        },
        {
          name: "🔄 Disponível em",
          value: new Date(Date.now() + tempoRestante).toLocaleTimeString(
            "pt-BR"
          ),
          inline: true,
        }
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
    // Cores e títulos dependendo do resultado
    const cor = sucesso ? 0x00ff00 : 0xff0000; // Verde para sucesso, vermelho para falha
    const titulo = sucesso ? "🔫 Roubo Bem-Sucedido" : "🚔 Roubo Falhou";
    const iconeTransacao = sucesso ? "🔫" : "👮";

    // Criar a barra de progresso
    const barraProgresso = sucesso
      ? `Roubo: ${formatarDinheiro(
          valor
        )} transferido de ${alvo} para ${usuario}`
      : `Multa: ${formatarDinheiro(valor)} paga por ${usuario}`;

    const embed = new EmbedBuilder()
      .setColor(cor)
      .setTitle(titulo)
      .setDescription(conteudo)
      .setThumbnail(sucesso ? alvoAvatarURL : avatarURL);

    if (sucesso) {
      embed.addFields(
        {
          name: "💰 Valor Roubado",
          value: formatarDinheiro(valor),
          inline: true,
        },
        {
          name: "📤 Seu Novo Saldo",
          value: formatarDinheiro(novoSaldoLadrao),
          inline: true,
        },
        {
          name: "📥 Saldo da Vítima",
          value: formatarDinheiro(novoSaldoVitima),
          inline: true,
        },
        {
          name: "📊 Transação",
          value: barraProgresso,
          inline: false,
        },
        {
          name: "⚠️ Impacto na Reputação",
          value:
            "Roubar reduz significativamente sua reputação, principalmente quando bem-sucedido.",
          inline: false,
        }
      );
    } else {
      embed.addFields(
        {
          name: "💰 Valor da Multa",
          value: formatarDinheiro(valor),
          inline: true,
        },
        {
          name: "📉 Seu Novo Saldo",
          value: formatarDinheiro(novoSaldoLadrao),
          inline: true,
        },
        {
          name: "📊 Transação",
          value: barraProgresso,
          inline: false,
        },
        {
          name: "⚠️ Impacto na Reputação",
          value: "Mesmo roubo malsucedido afeta negativamente sua reputação.",
          inline: false,
        }
      );
    }

    embed.setFooter({ text: `Roubo executado por ${usuario}` }).setTimestamp();

    return embed;
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
        `**${remetente}** transferiu ${formatarDinheiro(
          valor
        )} para **${destinatario}**`
      )
      .setThumbnail(destinatarioAvatar)
      .addFields(
        {
          name: "💰 Valor Transferido",
          value: formatarDinheiro(valor),
          inline: true,
        },
        {
          name: "📤 Saldo do Remetente",
          value: formatarDinheiro(saldoRemetente),
          inline: true,
        },
        {
          name: "📥 Saldo do Destinatário",
          value: formatarDinheiro(saldoDestinatario),
          inline: true,
        },
        {
          name: "📝 Motivo",
          value: motivo || "Sem motivo especificado",
          inline: false,
        },
        {
          name: "ℹ️ Impacto na Reputação",
          value:
            "Transferir dinheiro para outros usuários melhora um pouco sua reputação.",
          inline: false,
        }
      )
      .setFooter({ text: `Transferência realizada por ${remetente}` })
      .setTimestamp();
  }
}
