// blackjack.js
import { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
  } from 'discord.js';
  import inventoryService from '../services/inventory.js';
  import casinoService from '../services/casino.js';
  import embedUtils from '../utils/embed.js';
  
  export const data = new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Joga Blackjack (21) no cassino')
    .addIntegerOption(option => 
      option.setName('aposta')
        .setDescription('Quantidade de fichas para apostar')
        .setRequired(true)
        .setMinValue(1)
    );
  
  export async function execute(interaction) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const aposta = interaction.options.getInteger('aposta');
      
      // Verificar se o usuário tem fichas suficientes
      const fichasAtuais = await inventoryService.getCasinoChips(userId);
      
      if (fichasAtuais < aposta) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Fichas Insuficientes',
          mensagem: `Você tem apenas ${fichasAtuais} fichas. Não é possível apostar ${aposta} fichas.`
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Registrar a aposta
      const apostaRegistrada = await casinoService.registerBet(userId, aposta, 'blackjack');
      
      if (!apostaRegistrada) {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: 'Erro na Aposta',
          mensagem: 'Ocorreu um erro ao registrar sua aposta. Tente novamente mais tarde.'
        });
        
        return interaction.editReply({ embeds: [embedErro] });
      }
      
      // Gerar baralho embaralhado
      const deck = casinoService.generateShuffledDeck();
      
      // Distribuir cartas iniciais
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];
      
      // Calcular pontuações iniciais
      const playerScore = casinoService.calculateBlackjackScore(playerHand);
      const dealerScore = casinoService.calculateBlackjackScore([dealerHand[0]]); // Apenas a primeira carta é visível
      
      // Verificar se o jogador tem blackjack natural (21 com duas cartas)
      if (playerScore === 21) {
        return await handleNaturalBlackjack(interaction, userId, aposta, playerHand, dealerHand);
      }
      
      // Criar embed para mostrar as cartas
      const embed = createGameEmbed(interaction.user.username, playerHand, dealerHand, playerScore, dealerScore, true, aposta);
      
      // Criar botões para as ações
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_hit')
            .setLabel('Pedir Carta')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🃏'),
          new ButtonBuilder()
            .setCustomId('blackjack_stand')
            .setLabel('Parar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✋'),
          new ButtonBuilder()
            .setCustomId('blackjack_surrender')
            .setLabel('Render-se')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏳️')
        );
      
      const reply = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
      
      // Criar coletor para os botões
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minuto
      });
      
      // Objeto para armazenar o estado do jogo
      const gameState = {
        deck,
        playerHand,
        dealerHand,
        playerScore,
        dealerScore: casinoService.calculateBlackjackScore(dealerHand), // Score real do dealer
        showDealerCards: false
      };
      
      collector.on('collect', async i => {
        if (i.user.id !== userId) {
          await i.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
          return;
        }
        
        await i.deferUpdate();
        
        if (i.customId === 'blackjack_hit') {
          // Jogador pede mais uma carta
          await handlePlayerHit(gameState, i, collector, interaction.user.username, aposta, userId);
        } else if (i.customId === 'blackjack_stand') {
          // Jogador para e o dealer joga
          await handlePlayerStand(gameState, i, collector, interaction.user.username, aposta, userId);
        } else if (i.customId === 'blackjack_surrender') {
          // Jogador se rende e recebe metade da aposta de volta
          await handlePlayerSurrender(gameState, i, collector, interaction.user.username, aposta, userId);
        }
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          // Se o tempo acabou, o jogador perde automaticamente
          gameState.showDealerCards = true;
          
          const timeoutEmbed = createGameEmbed(
            interaction.user.username,
            gameState.playerHand,
            gameState.dealerHand,
            gameState.playerScore,
            gameState.dealerScore,
            false,
            aposta,
            'Tempo Esgotado! Você perdeu a aposta.'
          );
          
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              ButtonBuilder.from(row.components[0]).setDisabled(true),
              ButtonBuilder.from(row.components[1]).setDisabled(true),
              ButtonBuilder.from(row.components[2]).setDisabled(true)
            );
          
          await interaction.editReply({
            embeds: [timeoutEmbed],
            components: [disabledRow]
          }).catch(console.error);
          
          // O jogador já perdeu a aposta no início do jogo, não é necessário registrar novamente
        }
      });
    } catch (error) {
      console.error('Erro ao executar comando blackjack:', error);
      
      // Criar embed de erro
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: 'Erro no Comando',
        mensagem: 'Ocorreu um erro ao processar o comando. Tente novamente mais tarde.'
      });
      
      return interaction.editReply({ embeds: [embedErro] });
    }
  }
  
  /**
   * Cria o embed para mostrar o estado do jogo
   * @param {string} username - Nome do usuário
   * @param {Array} playerHand - Cartas do jogador
   * @param {Array} dealerHand - Cartas do dealer
   * @param {number} playerScore - Pontuação do jogador
   * @param {number} dealerScore - Pontuação do dealer
   * @param {boolean} hideDealer - Se deve esconder a segunda carta do dealer
   * @param {number} aposta - Valor da aposta
   * @param {string} [result] - Resultado do jogo (opcional)
   * @returns {EmbedBuilder} - Embed construído
   */
  function createGameEmbed(username, playerHand, dealerHand, playerScore, dealerScore, hideDealer, aposta, result = null) {
    // Formatar as cartas para exibição
    const playerCards = playerHand.map(card => `${card.suit}${card.value}`).join(' ');
    
    let dealerCards;
    if (hideDealer) {
      // Mostrar apenas a primeira carta e uma carta virada para baixo
      dealerCards = `${dealerHand[0].suit}${dealerHand[0].value} 🂠`;
    } else {
      dealerCards = dealerHand.map(card => `${card.suit}${card.value}`).join(' ');
    }
    
    // Criar o embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF) // Azul
      .setTitle('♠️ Blackjack (21) ♥️')
      .addFields(
        { name: '🎰 Aposta', value: `${aposta} fichas`, inline: true },
        { name: '🎭 Dealer', value: `${dealerCards}\nPontuação: ${hideDealer ? dealerScore : casinoService.calculateBlackjackScore(dealerHand)}`, inline: false },
        { name: `👤 ${username}`, value: `${playerCards}\nPontuação: ${playerScore}`, inline: false }
      )
      .setFooter({ text: result || 'Faça sua jogada!' })
      .setTimestamp();
    
    return embed;
  }
  
  /**
   * Trata o caso de blackjack natural (21 com duas cartas)
   * @param {Interaction} interaction - Interação do Discord
   * @param {string} userId - ID do usuário
   * @param {number} aposta - Valor da aposta
   * @param {Array} playerHand - Cartas do jogador
   * @param {Array} dealerHand - Cartas do dealer
   * @returns {Promise<void>}
   */
  async function handleNaturalBlackjack(interaction, userId, aposta, playerHand, dealerHand) {
    const dealerScore = casinoService.calculateBlackjackScore(dealerHand);
    const dealerHasBlackjack = dealerScore === 21;
    
    let result;
    let ganho = 0;
    
    if (dealerHasBlackjack) {
      // Empate
      result = 'Empate! Ambos têm Blackjack natural. Sua aposta foi devolvida.';
      ganho = aposta; // Devolve a aposta
    } else {
      // Jogador vence com blackjack
      result = '🎉 Blackjack! Você ganhou 2.5x a sua aposta!';
      ganho = Math.floor(aposta * 2.5); // Ganho de 3:2 (aposta + 1.5x a aposta)
    }
    
    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(userId, aposta, ganho, 'blackjack');
    
    // Criar embed
    const embed = createGameEmbed(
      interaction.user.username,
      playerHand,
      dealerHand,
      21, // Pontuação do jogador
      dealerScore,
      false, // Mostrar todas as cartas do dealer
      aposta,
      result
    );
    
    // Adicionar campo de fichas atuais
    embed.addFields(
      { name: '🎟️ Fichas Atuais', value: `${novasFichas}`, inline: true }
    );
    
    // Criar botão para jogar novamente
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('blackjack_again')
          .setLabel('Jogar Novamente')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('♠️'),
        new ButtonBuilder()
          .setCustomId('blackjack_double')
          .setLabel(`Dobrar Aposta (${aposta * 2})`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💰')
          .setDisabled(novasFichas < aposta * 2)
      );
    
    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
    
    // Criar coletor para o botão
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minuto
    });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        await i.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
        return;
      }
      
      if (i.customId === 'blackjack_again') {
        await i.deferUpdate();
        
        // Criar um novo comando de interação com a mesma aposta
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta;
          return null;
        };
        
        // Executar novamente
        await execute({
          ...interaction,
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
          options: newCommand.options
        });
        
        collector.stop();
      } else if (i.customId === 'blackjack_double') {
        await i.deferUpdate();
        
        // Criar um novo comando de interação com aposta dobrada
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta * 2;
          return null;
        };
        
        // Executar novamente
        await execute({
          ...interaction,
          deferReply: async () => {},
          editReply: i.editReply.bind(i),
          options: newCommand.options
        });
        
        collector.stop();
      }
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Desativar os botões após o tempo limite
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true)
          );
        
        await interaction.editReply({
          components: [disabledRow]
        }).catch(console.error);
      }
    });
  }
  
  /**
   * Trata a ação do jogador pedir carta
   * @param {Object} gameState - Estado atual do jogo
   * @param {ButtonInteraction} i - Interação do botão
   * @param {InteractionCollector} collector - Coletor de interações
   * @param {string} username - Nome do usuário
   * @param {number} aposta - Valor da aposta
   * @param {string} userId - ID do usuário
   * @returns {Promise<void>}
   */
  async function handlePlayerHit(gameState, i, collector, username, aposta, userId) {
    // Dar uma nova carta ao jogador
    gameState.playerHand.push(gameState.deck.pop());
    
    // Recalcular a pontuação do jogador
    gameState.playerScore = casinoService.calculateBlackjackScore(gameState.playerHand);
    
    if (gameState.playerScore > 21) {
      // Jogador estourou
      gameState.showDealerCards = true;
      
      // Criar embed atualizado
      const embed = createGameEmbed(
        username,
        gameState.playerHand,
        gameState.dealerHand,
        gameState.playerScore,
        gameState.dealerScore,
        false,
        aposta,
        'Você estourou! Perdeu a aposta.'
      );
      
      // Registrar a derrota (ganho = 0)
      const novasFichas = await casinoService.registerResult(userId, aposta, 0, 'blackjack');
      
      // Adicionar campo de fichas atuais
      embed.addFields(
        { name: '🎟️ Fichas Atuais', value: `${novasFichas}`, inline: true }
      );
      
      // Criar botão para jogar novamente
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_again')
            .setLabel('Jogar Novamente')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('♠️'),
          new ButtonBuilder()
            .setCustomId('blackjack_double')
            .setLabel(`Dobrar Aposta (${aposta * 2})`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💰')
            .setDisabled(novasFichas < aposta * 2)
        );
      
      await i.editReply({
        embeds: [embed],
        components: [row]
      });
      
      // Finalizar o jogo
      collector.stop();
      
      // Criar novo coletor para o botão de jogar novamente
      const newCollector = i.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minuto
      });
      
      newCollector.on('collect', async interaction => {
        if (interaction.user.id !== userId) {
          await interaction.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
          return;
        }
        
        if (interaction.customId === 'blackjack_again') {
          await interaction.deferUpdate();
          
          // Criar um novo comando de interação com a mesma aposta
          const newCommand = {
            options: new Map()
          };
          
          newCommand.options.getInteger = (name) => {
            if (name === 'aposta') return aposta;
            return null;
          };
          
          // Executar novamente com o mesmo contexto
          const originalInteraction = {
            user: { id: userId, username },
            deferReply: async () => {},
            editReply: interaction.editReply.bind(interaction),
            options: newCommand.options
          };
          
          await execute(originalInteraction);
        } else if (interaction.customId === 'blackjack_double') {
          await interaction.deferUpdate();
          
          // Criar um novo comando de interação com aposta dobrada
          const newCommand = {
            options: new Map()
          };
          
          newCommand.options.getInteger = (name) => {
            if (name === 'aposta') return aposta * 2;
            return null;
          };
          
          // Executar novamente com o mesmo contexto
          const originalInteraction = {
            user: { id: userId, username },
            deferReply: async () => {},
            editReply: interaction.editReply.bind(interaction),
            options: newCommand.options
          };
          
          await execute(originalInteraction);
        }
        
        newCollector.stop();
      });
      
      newCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          // Desativar os botões após o tempo limite
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              ButtonBuilder.from(row.components[0]).setDisabled(true),
              ButtonBuilder.from(row.components[1]).setDisabled(true)
            );
          
          await i.editReply({
            components: [disabledRow]
          }).catch(console.error);
        }
      });
    } else {
      // Jogo continua
      const embed = createGameEmbed(
        username,
        gameState.playerHand,
        gameState.dealerHand,
        gameState.playerScore,
        casinoService.calculateBlackjackScore([gameState.dealerHand[0]]),
        true,
        aposta
      );
      
      await i.editReply({
        embeds: [embed]
      });
    }
  }
  
  /**
   * Trata a ação do jogador parar
   * @param {Object} gameState - Estado atual do jogo
   * @param {ButtonInteraction} i - Interação do botão
   * @param {InteractionCollector} collector - Coletor de interações
   * @param {string} username - Nome do usuário
   * @param {number} aposta - Valor da aposta
   * @param {string} userId - ID do usuário
   * @returns {Promise<void>}
   */
  async function handlePlayerStand(gameState, i, collector, username, aposta, userId) {
    // Revelar as cartas do dealer
    gameState.showDealerCards = true;
    
    // Dealer compra cartas até ter pelo menos 17 pontos
    while (gameState.dealerScore < 17) {
      gameState.dealerHand.push(gameState.deck.pop());
      gameState.dealerScore = casinoService.calculateBlackjackScore(gameState.dealerHand);
    }
    
    // Determinar o resultado
    let result;
    let ganho = 0;
    
    if (gameState.dealerScore > 21) {
      // Dealer estourou, jogador ganha
      result = 'O dealer estourou! Você ganhou 2x a sua aposta!';
      ganho = aposta * 2; // Devolve a aposta + o mesmo valor
    } else if (gameState.dealerScore > gameState.playerScore) {
      // Dealer ganhou
      result = 'O dealer venceu! Você perdeu a aposta.';
      ganho = 0;
    } else if (gameState.dealerScore < gameState.playerScore) {
      // Jogador ganhou
      result = 'Você venceu! Ganhou 2x a sua aposta!';
      ganho = aposta * 2; // Devolve a aposta + o mesmo valor
    } else {
      // Empate
      result = 'Empate! Sua aposta foi devolvida.';
      ganho = aposta; // Devolve a aposta
    }
    
    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(userId, aposta, ganho, 'blackjack');
    
    // Criar embed atualizado
    const embed = createGameEmbed(
      username,
      gameState.playerHand,
      gameState.dealerHand,
      gameState.playerScore,
      gameState.dealerScore,
      false,
      aposta,
      result
    );
    
    // Adicionar campo de fichas atuais
    embed.addFields(
      { name: '🎟️ Fichas Atuais', value: `${novasFichas}`, inline: true }
    );
    
    // Criar botão para jogar novamente
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('blackjack_again')
          .setLabel('Jogar Novamente')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('♠️'),
        new ButtonBuilder()
          .setCustomId('blackjack_double')
          .setLabel(`Dobrar Aposta (${aposta * 2})`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💰')
          .setDisabled(novasFichas < aposta * 2)
      );
    
    await i.editReply({
      embeds: [embed],
      components: [row]
    });
    
    // Finalizar o jogo
    collector.stop();
    
    // Criar novo coletor para o botão de jogar novamente
    const newCollector = i.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minuto
    });
    
    newCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
        return;
      }
      
      if (interaction.customId === 'blackjack_again') {
        await interaction.deferUpdate();
        
        // Criar um novo comando de interação com a mesma aposta
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta;
          return null;
        };
        
        // Executar novamente com o mesmo contexto
        const originalInteraction = {
          user: { id: userId, username },
          deferReply: async () => {},
          editReply: interaction.editReply.bind(interaction),
          options: newCommand.options
        };
        
        await execute(originalInteraction);
      } else if (interaction.customId === 'blackjack_double') {
        await interaction.deferUpdate();
        
        // Criar um novo comando de interação com aposta dobrada
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta * 2;
          return null;
        };
        
        // Executar novamente com o mesmo contexto
        const originalInteraction = {
          user: { id: userId, username },
          deferReply: async () => {},
          editReply: interaction.editReply.bind(interaction),
          options: newCommand.options
        };
        
        await execute(originalInteraction);
      }
      
      newCollector.stop();
    });
    
    newCollector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Desativar os botões após o tempo limite
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true)
          );
        
        await i.editReply({
          components: [disabledRow]
        }).catch(console.error);
      }
    });
  }
  
  /**
   * Trata a ação do jogador se render
   * @param {Object} gameState - Estado atual do jogo
   * @param {ButtonInteraction} i - Interação do botão
   * @param {InteractionCollector} collector - Coletor de interações
   * @param {string} username - Nome do usuário
   * @param {number} aposta - Valor da aposta
   * @param {string} userId - ID do usuário
   * @returns {Promise<void>}
   */
  async function handlePlayerSurrender(gameState, i, collector, username, aposta, userId) {
    // Revelar as cartas do dealer
    gameState.showDealerCards = true;
    
    // Jogador se rende e recebe metade da aposta de volta
    const ganho = Math.floor(aposta / 2);
    
    // Registrar o resultado
    const novasFichas = await casinoService.registerResult(userId, aposta, ganho, 'blackjack');
    
    // Criar embed atualizado
    const embed = createGameEmbed(
      username,
      gameState.playerHand,
      gameState.dealerHand,
      gameState.playerScore,
      gameState.dealerScore,
      false,
      aposta,
      `Você se rendeu! Recebeu metade da sua aposta (${ganho} fichas) de volta.`
    );
    
    // Adicionar campo de fichas atuais
    embed.addFields(
      { name: '🎟️ Fichas Atuais', value: `${novasFichas}`, inline: true }
    );
    
    // Criar botão para jogar novamente
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('blackjack_again')
          .setLabel('Jogar Novamente')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('♠️'),
        new ButtonBuilder()
          .setCustomId('blackjack_double')
          .setLabel(`Dobrar Aposta (${aposta * 2})`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💰')
          .setDisabled(novasFichas < aposta * 2)
      );
    
    await i.editReply({
      embeds: [embed],
      components: [row]
    });
    
    // Finalizar o jogo
    collector.stop();
    
    // Criar novo coletor para o botão de jogar novamente
    const newCollector = i.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minuto
    });
    
    newCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
        return;
      }
      
      if (interaction.customId === 'blackjack_again') {
        await interaction.deferUpdate();
        
        // Criar um novo comando de interação com a mesma aposta
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta;
          return null;
        };
        
        // Executar novamente com o mesmo contexto
        const originalInteraction = {
          user: { id: userId, username },
          deferReply: async () => {},
          editReply: interaction.editReply.bind(interaction),
          options: newCommand.options
        };
        
        await execute(originalInteraction);
      } else if (interaction.customId === 'blackjack_double') {
        await interaction.deferUpdate();
        
        // Criar um novo comando de interação com aposta dobrada
        const newCommand = {
          options: new Map()
        };
        
        newCommand.options.getInteger = (name) => {
          if (name === 'aposta') return aposta * 2;
          return null;
        };
        
        // Executar novamente com o mesmo contexto
        const originalInteraction = {
          user: { id: userId, username },
          deferReply: async () => {},
          editReply: interaction.editReply.bind(interaction),
          options: newCommand.options
        };
        
        await execute(originalInteraction);
      }
      
      newCollector.stop();
    });
    
    newCollector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Desativar os botões após o tempo limite
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true)
          );
        
        await i.editReply({
          components: [disabledRow]
        }).catch(console.error);
      }
    });
}