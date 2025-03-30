// perfil.js
import { SlashCommandBuilder } from 'discord.js';
import firebaseService from '../services/firebase.js';
import embedUtils from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Veja seu perfil econômico')
  .addUserOption(option => 
    option.setName('usuario')
      .setDescription('Usuário para ver o perfil (opcional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    // Verifica se foi especificado um usuário ou usa o autor do comando
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userId = targetUser.id;
    
    // Obter dados do usuário do Firebase
    const userData = await firebaseService.getUserData(userId);
    
    // Criar embed de perfil
    const embed = embedUtils.criarEmbedPerfil({
      usuario: targetUser.username,
      avatarURL: targetUser.displayAvatarURL(),
      saldo: userData.saldo || 0
    });
    
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erro ao executar comando perfil:', error);
    
    // Criar embed de erro
    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: 'Erro no Comando',
      mensagem: 'Ocorreu um erro ao processar o comando. Tente novamente mais tarde.'
    });
    
    return interaction.editReply({ embeds: [embedErro] });
  }
}