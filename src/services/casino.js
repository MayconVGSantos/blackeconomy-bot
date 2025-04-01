// services/casino.js - Trecho com ajustes na economia dos jogos
/**
 * Serviço para gerenciar as funcionalidades do cassino
 * Gerencia as fichas, apostas e jogos de cassino
 * REBALANCEADO PARA ECONOMIA MAIS DIFÍCIL
 */
class CasinoService {
  /**
   * Constantes para taxas e multiplicadores
   */
  constructor() {
    this.TAXA_TROCA_FICHAS = 0.15; // Aumentado: antes 0.10 (15% de taxa para converter fichas de volta em dinheiro)
    this.MULTIPLICADORES = {
      blackjack: {
        vitoria: 1.9, // Reduzido: antes 2 (1.9:1)
        blackjack: 2.3, // Reduzido: antes 2.5 (2.3:1)
        empate: 1, // devolve a aposta (mantido)
      },
      slots: {
        padrao: [1, 2, 3, 4, 8], // Reduzido: antes [1, 2, 3, 5, 10]
        jackpot: 20, // Reduzido: antes 25
      },
      roleta: {
        numero: 31, // Reduzido: antes 36 (31:1)
        cor: 1.9, // Reduzido: antes 2 (1.9:1)
        parImpar: 1.9, // Reduzido: antes 2 (1.9:1)
        duziaColuna: 2.8, // Reduzido: antes 3 (2.8:1)
      },
      dados: {
        // Usando valores configurados para diferentes números
        // Valores reduzidos em aproximadamente 15%
      },
    };
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
        return { success: false, error: "Fichas insuficientes" };
      }

      // Calcular valor em dinheiro (aplicando a taxa)
      const valorBase = chips * 10; // 1 ficha = R$10
      const taxa = valorBase * this.TAXA_TROCA_FICHAS;
      const valorFinal = valorBase - taxa;

      // Remover as fichas
      const success = await inventoryService.removeCasinoChips(userId, chips);

      if (!success) {
        return { success: false, error: "Erro ao remover fichas" };
      }

      // Adicionar o dinheiro (importar o serviço do Firebase)
      const firebaseService = (await import("./firebase.js")).default;
      const newBalance = await firebaseService.updateUserBalance(
        userId,
        valorFinal
      );

      // Obter fichas restantes
      const newChips = await inventoryService.getCasinoChips(userId);

      return {
        success: true,
        amount: valorFinal,
        taxa: taxa,
        newBalance,
        newChips,
      };
    } catch (error) {
      console.error("Erro ao trocar fichas por dinheiro:", error);
      return { success: false, error: "Erro interno" };
    }
  }

  /**
   * Gera um resultado para o jogo de slots
   * @returns {Object} - Resultado dos slots
   */
  generateSlotsResult() {
    const symbols = ["🍒", "🍊", "🍋", "🍇", "🍉", "💎", "7️⃣"];
    // Ajustado para mais difícil - pesos aumentados para símbolos comuns
    const weights = [35, 30, 25, 18, 7, 3, 2]; // Antes: [30, 25, 20, 15, 5, 3, 2]

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
    let winType = "Derrota";

    // Três símbolos iguais
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      if (reels[0] === "7️⃣") {
        multiplier = this.MULTIPLICADORES.slots.jackpot;
        winType = "JACKPOT!";
      } else if (reels[0] === "💎") {
        multiplier = this.MULTIPLICADORES.slots.padrao[4];
        winType = "Super Prêmio!";
      } else {
        multiplier = this.MULTIPLICADORES.slots.padrao[3];
        winType = "Prêmio Grande!";
      }
    }
    // Dois símbolos iguais
    else if (
      reels[0] === reels[1] ||
      reels[1] === reels[2] ||
      reels[0] === reels[2]
    ) {
      if (
        (reels[0] === "7️⃣" && reels[1] === "7️⃣") ||
        (reels[1] === "7️⃣" && reels[2] === "7️⃣") ||
        (reels[0] === "7️⃣" && reels[2] === "7️⃣")
      ) {
        multiplier = this.MULTIPLICADORES.slots.padrao[2];
        winType = "Prêmio Médio!";
      } else {
        multiplier = this.MULTIPLICADORES.slots.padrao[1];
        winType = "Prêmio Pequeno!";
      }
    }
    // Pelo menos um 7 - diminuída a chance de ganho
    else if (reels.includes("7️⃣") && Math.random() < 0.8) {
      // Apenas 80% de chance vs 100% anterior
      multiplier = this.MULTIPLICADORES.slots.padrao[0];
      winType = "Prêmio Mínimo!";
    }

    return {
      reels,
      multiplier,
      winType,
    };
  }

  /**
   * Gera um resultado para o jogo de dados
   * REAJUSTADO: Multiplicadores diferentes para cada número
   * @returns {Object} - Resultado do jogo de dados
   */
  rollDice() {
    // Rolar 2 dados de 6 faces
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    return {
      dice1,
      dice2,
      total,
    };
  }

  /**
   * Calcula multiplicador para dado número no jogo de dados
   * @param {number} number - Número apostado
   * @returns {number} - Multiplicador para o número
   */
  getDiceMultiplier(number) {
    // Definir multiplicadores baseados na probabilidade de cada número
    const multiplicadores = {
      2: 30, // 1/36 chance (2.78%)
      3: 15, // 2/36 chance (5.56%)
      4: 10, // 3/36 chance (8.33%)
      5: 7, // 4/36 chance (11.11%)
      6: 5, // 5/36 chance (13.89%)
      7: 4, // 6/36 chance (16.67%) - mais comum
      8: 5, // 5/36 chance (13.89%)
      9: 7, // 4/36 chance (11.11%)
      10: 10, // 3/36 chance (8.33%)
      11: 15, // 2/36 chance (5.56%)
      12: 30, // 1/36 chance (2.78%)
    };

    return multiplicadores[number] || 5; // Padrão é 5x
  }

  /**
   * Gera um número para a roleta
   * MODIFICADO: Distorção sutil nos resultados para aumentar a chance de casa
   * @returns {Object} - Resultado da roleta
   */
  spinRoulette() {
    // Números da roleta (incluindo 0)
    const numbers = [];
    for (let i = 0; i <= 36; i++) {
      numbers.push(i);
    }

    // Favorecer levemente o zero (casa ganha)
    const weights = numbers.map((n) => (n === 0 ? 1.2 : 1)); // Zero tem 20% mais chance

    // Girar a roleta com pesos
    let totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    let result = 0;

    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        result = numbers[i];
        break;
      }
      random -= weights[i];
    }

    // Mapear as cores (0 é verde, pares são pretos, ímpares são vermelhos)
    const colors = {
      0: "green",
      red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      black: [
        2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
      ],
    };

    // Determinar a cor
    let color;
    if (result === 0) {
      color = colors[0];
    } else if (colors.red.includes(result)) {
      color = "red";
    } else {
      color = "black";
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

    let column;
    if (result === 0) {
      column = null;
    } else {
      column = result % 3 === 0 ? 3 : result % 3;
    }

    return {
      number: result,
      color,
      isEven,
      dozen,
      column,
    };
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
      if (card.value === "A") {
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
   * Simula a jogada do dealer no blackjack
   * MODIFICADO: Dealer mais inteligente com estratégia ajustável
   * @param {Array} dealerHand - Mão atual do dealer
   * @param {Array} deck - Baralho restante
   * @param {number} playerScore - Pontuação do jogador
   * @returns {Array} - Mão final do dealer
   */
  playDealerHand(dealerHand, deck, playerScore) {
    // Clone a mão para não modificar a original
    const hand = [...dealerHand];

    // Calcular pontuação inicial
    let score = this.calculateBlackjackScore(hand);

    // Regra básica: dealer compra até pelo menos 17
    // Regra adicional: se o jogador tiver mais que 17, o dealer tenta superar
    // em 70% das vezes (mais agressivo que o padrão)
    const targetScore = Math.max(17, playerScore);
    const shouldBeatPlayer = playerScore > 17 && Math.random() < 0.7;

    while (
      // Regra básica do cassino: Sempre compra abaixo de 17
      score < 17 ||
      // Regra adicional para tornar o dealer mais competitivo
      (shouldBeatPlayer && score < targetScore && score < 21)
    ) {
      // Para segurança, verificar se ainda há cartas
      if (deck.length === 0) break;

      // Comprar carta
      const card = deck.pop();
      hand.push(card);

      // Recalcular pontuação
      score = this.calculateBlackjackScore(hand);

      // Se estourou, para de comprar
      if (score > 21) break;
    }

    return hand;
  }

  /**
   * Gera um baralho de cartas embaralhado
   * @returns {Array} - Baralho embaralhado
   */
  generateShuffledDeck() {
    const suits = ["♥", "♦", "♣", "♠"];
    const values = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];

    const deck = [];

    // Criar o baralho
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          // Valor numérico para cálculos
          numericValue:
            value === "A"
              ? 11
              : ["J", "Q", "K"].includes(value)
              ? 10
              : parseInt(value),
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
          totalBets: increment(amount),
        });
      } else {
        await set(statsRef, {
          gamesPlayed: 1,
          totalBets: amount,
          winnings: 0,
          losses: amount,
          gamesWon: 0,
          gamesLost: 0,
        });
      }

      return true;
    } catch (error) {
      console.error("Erro ao registrar aposta:", error);
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
        // Vitória - registrar estatísticas detalhadas
        await update(statsRef, {
          winnings: increment(winAmount),
          gamesWon: increment(1),
        });

        // Atualizar sistema progressivo
        await this.updateProgressiveOdds(userId, true);

        // Adicionar fichas ganhas
        return await inventoryService.addCasinoChips(userId, winAmount);
      } else {
        // Derrota - registrar estatísticas detalhadas
        await update(statsRef, {
          losses: increment(betAmount),
          gamesLost: increment(1),
        });

        // Atualizar sistema progressivo
        await this.updateProgressiveOdds(userId, false);

        // Retornar total atual
        return await inventoryService.getCasinoChips(userId);
      }
    } catch (error) {
      console.error("Erro ao registrar resultado:", error);
      throw error;
    }
  }

  /**
   * Implementa o sistema de chance de ganho progressivo
   * Quanto mais o jogador perde, maior a chance de ganhar no próximo jogo
   * Reseta quando o jogador ganha
   * @param {string} userId - ID do usuário
   * @param {boolean} won - Se o jogador ganhou
   * @returns {Promise<number>} - Multiplicador para a próxima jogada
   */
  async updateProgressiveOdds(userId, won) {
    try {
      const database = getDatabase();
      const progressiveRef = ref(database, `users/${userId}/progressiveOdds`);
      const snapshot = await get(progressiveRef);

      let currentLossStreak = 0;

      if (snapshot && snapshot.exists()) {
        currentLossStreak = snapshot.val().lossStreak || 0;
      }

      // Se ganhou, resetar streak
      if (won) {
        await set(progressiveRef, { lossStreak: 0 });
        return 1.0; // Multiplicador base
      }

      // Se perdeu, aumentar streak
      const newLossStreak = currentLossStreak + 1;

      // Calcular multiplicador baseado no streak (até +50% depois de 10 derrotas)
      const maxBonus = 0.5; // 50% de bônus máximo
      const streakThreshold = 10; // Número de derrotas para chegar ao bônus máximo

      let multiplier =
        1.0 + Math.min(newLossStreak / streakThreshold, 1.0) * maxBonus;

      // Arredondar para duas casas decimais
      multiplier = Math.round(multiplier * 100) / 100;

      // Salvar novo streak
      await set(progressiveRef, { lossStreak: newLossStreak });

      return multiplier;
    } catch (error) {
      console.error("Erro ao atualizar odds progressivas:", error);
      return 1.0; // Retornar multiplicador padrão em caso de erro
    }
  }

  /**
   * Obtém o multiplicador progressivo atual para o usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>} - Multiplicador atual
   */
  async getProgressiveMultiplier(userId) {
    try {
      const database = getDatabase();
      const progressiveRef = ref(database, `users/${userId}/progressiveOdds`);
      const snapshot = await get(progressiveRef);

      if (!snapshot || !snapshot.exists()) {
        return 1.0;
      }

      const currentLossStreak = snapshot.val().lossStreak || 0;

      if (currentLossStreak <= 0) {
        return 1.0;
      }

      const maxBonus = 0.5;
      const streakThreshold = 10;

      let multiplier =
        1.0 + Math.min(currentLossStreak / streakThreshold, 1.0) * maxBonus;

      return Math.round(multiplier * 100) / 100;
    } catch (error) {
      console.error("Erro ao obter multiplicador progressivo:", error);
      return 1.0;
    }
  }
}

// Criar uma instância e exportá-la
const casinoService = new CasinoService();
export default casinoService;

// Importações necessárias
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  increment,
} from "firebase/database";
import inventoryService from "./inventory.js";
