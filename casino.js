// casino.js
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update,
    increment 
   } from 'firebase/database';
   import { initializeApp } from 'firebase/app';
   import dotenv from 'dotenv';
   import inventoryService from './inventory.js';
   
   dotenv.config();
   
   /**
   * Serviço para gerenciar as funcionalidades do cassino
   * Gerencia as fichas, apostas e jogos de cassino
   */
   class CasinoService {
    /**
     * Constantes para taxas e multiplicadores
     */
    constructor() {
      this.TAXA_TROCA_FICHAS = 0.1; // 10% de taxa para converter fichas de volta em dinheiro
      this.MULTIPLICADORES = {
        blackjack: {
          vitoria: 2,      // 1:1 (dobra a aposta)
          blackjack: 2.5,  // 3:2 (aposta x 2.5)
          empate: 1        // devolve a aposta
        },
        slots: {
          padrao: [1, 2, 3, 5, 10], // Multiplicadores para combinações
          jackpot: 25               // Jackpot
        },
        roleta: {
          numero: 36,      // 35:1
          cor: 2,          // 1:1 (dobra a aposta)
          parImpar: 2,     // 1:1
          duziaColuna: 3   // 2:1
        },
        dados: {
          padrao: 6        // 5:1
        }
      };
    }
   
    /**
     * Verifica se o usuário tem fichas suficientes
     * @param {string} userId - ID do usuário
     * @param {number} amount - Quantidade de fichas
     * @returns {Promise<boolean>} - True se tiver fichas suficientes
     */
    async hasEnoughChips(userId, amount) {
      const fichas = await inventoryService.getCasinoChips(userId);
      return fichas >= amount;
    }
   
    /**
     * Registra uma aposta no sistema
     * @param {string} userId - ID do usuário
     * @param {number} amount - Quantidade de fichas apostadas
     * @param {string} game - Nome do jogo (blackjack, slots, roleta, dados)
     * @returns {Promise<boolean>} - True se a aposta foi registrada com sucesso
     */
    async registerBet(userId, amount, game) {
      try {
        // Verificar se o usuário tem fichas suficientes
        if (!(await this.hasEnoughChips(userId, amount))) {
          return false;
        }
        
        // Debitar as fichas
        const success = await inventoryService.removeCasinoChips(userId, amount);
        
        if (!success) {
          return false;
        }
        
        // Atualizar estatísticas de apostas
        const database = getDatabase();
        const statsRef = ref(database, `users/${userId}/stats/casino`);
        const snapshot = await get(statsRef);
        
        if (snapshot.exists()) {
          await update(statsRef, {
            gamesPlayed: increment(1),
            totalBets: increment(amount)
          });
        } else {
          await set(statsRef, {
            gamesPlayed: 1,
            totalBets: amount,
            winnings: 0,
            losses: amount
          });
        }
        
        return true;
      } catch (error) {
        console.error('Erro ao registrar aposta:', error);
        return false;
      }
    }
   
    /**
     * Registra o resultado de uma aposta
     * @param {string} userId - ID do usuário
     * @param {number} betAmount - Quantidade apostada
     * @param {number} winAmount - Quantidade ganha (0 se perdeu)
     * @param {string} game - Nome do jogo
     * @returns {Promise<number>} - Total de fichas após o resultado
     */
    async registerResult(userId, betAmount, winAmount, game) {
      try {
        const database = getDatabase();
        const statsRef = ref(database, `users/${userId}/stats/casino`);
        
        if (winAmount > 0) {
          // Vitória
          await update(statsRef, {
            winnings: increment(winAmount)
          });
          
          // Adicionar fichas ganhas
          return await inventoryService.addCasinoChips(userId, winAmount);
        } else {
          // Derrota (fichas já foram debitadas no registerBet)
          await update(statsRef, {
            losses: increment(betAmount)
          });
          
          // Retornar total atual
          return await inventoryService.getCasinoChips(userId);
        }
      } catch (error) {
        console.error('Erro ao registrar resultado:', error);
        throw error;
      }
    }
   
    /**
     * Troca fichas de cassino por dinheiro
     * @param {string} userId - ID do usuário
     * @param {number} chips - Quantidade de fichas a trocar
     * @returns {Promise<{success: boolean, amount: number, newBalance: number, newChips: number}>}
     */
    async exchangeChipsForMoney(userId, chips) {
      try {
        // Verificar se o usuário tem fichas suficientes
        if (!(await this.hasEnoughChips(userId, chips))) {
          return { success: false, error: 'Fichas insuficientes' };
        }
        
        // Calcular valor em dinheiro (aplicando a taxa)
        const valorBase = chips * 10; // 1 ficha = R$10
        const taxa = valorBase * this.TAXA_TROCA_FICHAS;
        const valorFinal = valorBase - taxa;
        
        // Remover as fichas
        const success = await inventoryService.removeCasinoChips(userId, chips);
        
        if (!success) {
          return { success: false, error: 'Erro ao remover fichas' };
        }
        
        // Adicionar o dinheiro (importar o serviço do Firebase)
        const { updateUserBalance, getUserData } = await import('./firebase.js');
        const newBalance = await updateUserBalance(userId, valorFinal);
        
        // Obter fichas restantes
        const newChips = await inventoryService.getCasinoChips(userId);
        
        return {
          success: true,
          amount: valorFinal,
          taxa: taxa,
          newBalance,
          newChips
        };
      } catch (error) {
        console.error('Erro ao trocar fichas por dinheiro:', error);
        return { success: false, error: 'Erro interno' };
      }
    }
   
    /**
     * Gera um baralho de cartas embaralhado
     * @returns {Array} - Baralho embaralhado
     */
    generateShuffledDeck() {
      const suits = ['♥', '♦', '♣', '♠'];
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      
      const deck = [];
      
      // Criar o baralho
      for (const suit of suits) {
        for (const value of values) {
          deck.push({
            suit,
            value,
            // Valor numérico para cálculos
            numericValue: value === 'A' ? 11 : ['J', 'Q', 'K'].includes(value) ? 10 : parseInt(value)
          });
        }
      }
      
      // Embaralhar o baralho
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      
      return deck;
    }
   
    /**
     * Calcula a pontuação da mão de blackjack
     * @param {Array} hand - Cartas na mão
     * @returns {number} - Pontuação total
     */
    calculateBlackjackScore(hand) {
      let score = 0;
      let aces = 0;
      
      // Somar os valores
      for (const card of hand) {
        score += card.numericValue;
        if (card.value === 'A') {
          aces++;
        }
      }
      
      // Ajustar para ases (podem valer 1 ou 11)
      while (score > 21 && aces > 0) {
        score -= 10; // Mudar um ás de 11 para 1
        aces--;
      }
      
      return score;
    }
   
    /**
     * Gera um resultado para o jogo de slots
     * @returns {Object} - Resultado dos slots
     */
    generateSlotsResult() {
      const symbols = ['🍒', '🍊', '🍋', '🍇', '🍉', '💎', '7️⃣'];
      const weights = [30, 25, 20, 15, 5, 3, 2]; // Probabilidades ponderadas
      
      // Função para selecionar um símbolo baseado no peso
      const selectSymbol = () => {
        const total = weights.reduce((acc, weight) => acc + weight, 0);
        let random = Math.random() * total;
        
        for (let i = 0; i < symbols.length; i++) {
          if (random < weights[i]) {
            return symbols[i];
          }
          random -= weights[i];
        }
        
        return symbols[0]; // Fallback
      };
      
      // Gerar 3 símbolos
      const reels = [selectSymbol(), selectSymbol(), selectSymbol()];
      
      // Verificar vitória
      let multiplier = 0;
      let winType = 'Derrota';
      
      // Três símbolos iguais
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        if (reels[0] === '7️⃣') {
          multiplier = this.MULTIPLICADORES.slots.jackpot;
          winType = 'JACKPOT!';
        } else if (reels[0] === '💎') {
          multiplier = this.MULTIPLICADORES.slots.padrao[4];
          winType = 'Super Prêmio!';
        } else {
          multiplier = this.MULTIPLICADORES.slots.padrao[3];
          winType = 'Prêmio Grande!';
        }
      }
      // Dois símbolos iguais
      else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        if ((reels[0] === '7️⃣' && reels[1] === '7️⃣') || 
            (reels[1] === '7️⃣' && reels[2] === '7️⃣') || 
            (reels[0] === '7️⃣' && reels[2] === '7️⃣')) {
          multiplier = this.MULTIPLICADORES.slots.padrao[2];
          winType = 'Prêmio Médio!';
        } else {
          multiplier = this.MULTIPLICADORES.slots.padrao[1];
          winType = 'Prêmio Pequeno!';
        }
      }
      // Pelo menos um 7
      else if (reels.includes('7️⃣')) {
        multiplier = this.MULTIPLICADORES.slots.padrao[0];
        winType = 'Prêmio Mínimo!';
      }
      
      return {
        reels,
        multiplier,
        winType
      };
    }
   
    /**
     * Gera um resultado para o jogo de dados
     * @param {number} bet - Número apostado (1-6)
     * @returns {Object} - Resultado do jogo de dados
     */
    rollDice() {
      // Rolar 2 dados de 6 faces
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      
      return {
        dice1,
        dice2,
        total: dice1 + dice2
      };
    }
   
    /**
     * Gera um número para a roleta
     * @returns {Object} - Resultado da roleta
     */
    spinRoulette() {
      // Números da roleta (incluindo 0)
      const numbers = [];
      for (let i = 0; i <= 36; i++) {
        numbers.push(i);
      }
      
      // Mapear as cores (0 é verde, pares são pretos, ímpares são vermelhos)
      const colors = {
        0: 'green',
        red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
        black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
      };
      
      // Girar a roleta
      const result = numbers[Math.floor(Math.random() * numbers.length)];
      
      // Determinar a cor
      let color;
      if (result === 0) {
        color = colors[0];
      } else if (colors.red.includes(result)) {
        color = 'red';
      } else {
        color = 'black';
      }
      
      // Determinar paridade
      const isEven = result !== 0 && result % 2 === 0;
      
      // Determinar dúzia
      let dozen;
      if (result === 0) {
        dozen = null;
      } else if (result <= 12) {
        dozen = 1;
      } else if (result <= 24) {
        dozen = 2;
      } else {
        dozen = 3;
      }
      
      // Determinar coluna
      let column;
      if (result === 0) {
        column = null;
      } else {
        column = (result % 3) === 0 ? 3 : (result % 3);
      }
      
      return {
        number: result,
        color,
        isEven,
        dozen,
        column
      };
    }
   }
   
   export default new CasinoService();