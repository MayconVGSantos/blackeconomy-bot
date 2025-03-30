// pix.js
import { SlashCommandBuilder } from 'discord.js';
import firebaseService from '../services/firebase.js';
import geminiClient from '../services/gemini.js';
import embedUtils from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('pix')
  .setDescription('Transfere dinheiro para outro usuário')
  .addUserOption(option => 
    option.setName('usuario')
      .setDescription('Usuário que receberá o dinheiro')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('valor')
      .setDescription('Quantidade a ser transferida')
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('usuario');
    const valor = interaction.options.getInteger('valor');
    const userId = interaction.user.id;
    
    // Não permitir transferência para si mesmo
    if (targetUser.id === userId) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: 'Transferência Inválida',
        mensagem: 'Você não pode fazer um PIX para si mesmo.'
      });
      
      return interaction.editReply({ embeds: [embedErro] });
    }
    
    // Verificar se o bot não é mencionado
    if (targetUser.bot) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: 'Transferência Inválida',
        mensagem: 'Você não pode fazer um PIX para um bot.'
      });
      
      return interaction.editReply({ embeds: [embedErro] });
    }
    
    // Verificar se o usuário tem saldo suficiente
    const userData = await firebaseService.getUserData(userId);
    
    if (userData.saldo < valor) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: 'Saldo Insuficiente',
        mensagem: `Você tem apenas R$${userData.saldo.toFixed(2)} em sua conta.`
      });
      
      return interaction.editReply({ embeds: [embedErro] });
    }
    
    // Realizar a transferência
    await firebaseService.updateUserBalance(userId, -valor);
    const novoSaldoDestino = await firebaseService.updateUserBalance(targetUser.id, valor);
    
    // Obter novo saldo do remetente
    const novoSaldoRemetente = (await firebaseService.getUserData(userId)).saldo;
    
    // Gerar motivo criativo com a Gemini API
    let motivo;
    try {
      motivo = await geminiClient.gerarMotivoPix(
        interaction.user.username,
        targetUser.username,
        valor
      );
    } catch (error) {
      console.error('Erro ao gerar motivo com Gemini:', error);
      motivo = `Transferência de R$${valor.toFixed(2)} entre usuários.`;
    }
    
    // Criar embed
    const embed = embedUtils.criarEmbedTransferencia({
      remetente: interaction.user.username,
      remetenteAvatar: interaction.user.displayAvatarURL(),
      destinatario: targetUser.username,
      destinatarioAvatar: targetUser.displayAvatarURL(),
      valor: valor,
      saldoRemetente: novoSaldoRemetente,
      saldoDestinatario: novoSaldoDestino,
      motivo: motivo
    });
    
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erro ao executar comando pix:', error);
    
    // Criar embed de erro
    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: 'Erro no Comando',
      mensagem: 'Ocorreu um erro ao processar o comando. Tente novamente mais tarde.'
    });
    
    return interaction.editReply({ embeds: [embedErro] });
  }
}