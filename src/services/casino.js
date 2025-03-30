// casino.js
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  increment,
} from "firebase/database";
import { initializeApp } from "firebase/app";
import dotenv from "dotenv";
import inventoryService from "./inventory.js";

dotenv.config();

// Modificação correta para o arquivo src/services/casino.js
// Em vez de substituir o construtor, apenas modificamos ele para adicionar a nova propriedade

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
    
    // Novo objeto para rastrear "sorte" do jogador
    this.playerLuckRates = {};
  }

  /**
   * Gera um resultado para o jogo de slots com dificuldade adaptativa
   * @param {string} userId - ID do usuário que está jogando
   * @returns {Object} - Resultado dos slots
   */
  generateSlotsResult(userId) {
    // Inicializar ou recuperar a taxa de sorte do jogador (padrão: 100%)
    if (!this.playerLuckRates[userId]) {
      this.playerLuckRates[userId] = {
        currentLuck: 100, // 100% de sorte inicial
        consecutiveWins: 0,
        totalGames: 0
      };
    }
    
    const playerLuck = this.playerLuckRates[userId];
    playerLuck.totalGames++;
    
    // Ajustar símbolos e pesos com base na taxa de sorte atual
    const symbols = ['🍒', '🍊', '🍋', '🍇', '🍉', '💎', '7️⃣'];
    
    // Pesos base - quanto maior o peso, maior a chance de aparecer
    let baseWeights = [35, 28, 20, 10, 5, 1.5, 0.5];
    
    // Ajustar pesos com base na sorte do jogador
    // Quanto menor a sorte, mais aumentamos o peso dos símbolos comuns
    // e diminuímos o peso dos símbolos raros
    const luckFactor = playerLuck.currentLuck / 100;
    const weights = baseWeights.map((weight, index) => {
      if (index < 3) {
        // Símbolos comuns: aumentam quando a sorte diminui
        return weight * (2 - luckFactor);
      } else {
        // Símbolos raros: diminuem quando a sorte diminui
        return weight * luckFactor;
      }
    });
    
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
    let isWin = false;
    
    // Três símbolos iguais
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      isWin = true;
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
      isWin = true;
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
    // Pelo menos um 7 (com chance reduzida)
    else if (reels.includes('7️⃣')) {
      // A chance de ganhar com um 7 diminui com a sorte
      const winChance = 0.4 * luckFactor;
      if (Math.random() < winChance) {
        isWin = true;
        multiplier = this.MULTIPLICADORES.slots.padrao[0];
        winType = 'Prêmio Mínimo!';
      }
    }
    
    // Atualizar a taxa de sorte com base no resultado
    if (isWin) {
      playerLuck.consecutiveWins++;
      
      // Diminuir a sorte com base no número de vitórias consecutivas
      // Quanto mais vitórias consecutivas, maior a redução
      const luckReduction = 5 + (playerLuck.consecutiveWins * 3);
      playerLuck.currentLuck = Math.max(10, playerLuck.currentLuck - luckReduction);
    } else {
      // Resetar contagem de vitórias consecutivas e aumentar um pouco a sorte
      playerLuck.consecutiveWins = 0;
      playerLuck.currentLuck = Math.min(100, playerLuck.currentLuck + 10);
    }
    
    // Se muitos jogos foram jogados, limpe gradualmente o histórico
    if (playerLuck.totalGames > 50) {
      playerLuck.totalGames = Math.max(20, playerLuck.totalGames - 5);
      
      // Restaure um pouco a sorte se ela estiver muito baixa após muitos jogos
      if (playerLuck.currentLuck < 40) {
        playerLuck.currentLuck += 5;
      }
    }
    
    // Retornar o resultado
    return {
      reels,
      multiplier,
      winType
    };
  }
}

export default new CasinoService();
