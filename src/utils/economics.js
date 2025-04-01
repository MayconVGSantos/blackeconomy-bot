// utils/economics.js - Versão com economia rebalanceada
import config from "../../config/config.js";

/**
 * Utilitários para cálculos econômicos do bot
 * Com funções otimizadas para valores mais equilibrados e menor ganho
 */
class EconomicsUtils {
  /**
   * Gera um valor aleatório dentro de um intervalo
   * @param {number} min - Valor mínimo
   * @param {number} max - Valor máximo
   * @returns {number} - Valor gerado
   */
  gerarValorAleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calcula o valor ganho no comando trabalhar
   * Implementa um algoritmo de distribuição ponderada para evitar
   * valores excessivamente altos ou baixos com muita frequência
   * @returns {number} - Valor ganho
   */
  calcularValorTrabalhar() {
    const { min, max } = config.economia.trabalhar;

    // Implementar uma distribuição mais ponderada para valores menores
    const random = Math.random();
    const weightedRandom = Math.pow(random, 1.4); // Ajustado para 1.4 (mais tendência para valores baixos)

    return Math.floor(min + weightedRandom * (max - min));
  }

  /**
   * Calcula o valor ganho ou perdido no comando seduzir
   * @returns {Object} - Objeto contendo o valor e se ganhou ou perdeu
   */
  calcularValorSeduzir() {
    const { min, max, perda, taxaSucesso } = config.economia.seduzir;

    // Taxa de sucesso personalizada (40% em vez de 50%)
    const ganhou = Math.random() < (taxaSucesso || 0.4);

    // Calcular valor base que seria ganho
    const valorBase = this.gerarValorAleatorio(min, max);

    if (ganhou) {
      return {
        valor: valorBase,
        ganhou: true,
      };
    } else {
      // Perder uma porcentagem do que teria ganho
      const porcentagemPerda =
        this.gerarValorAleatorio(
          Math.floor(perda.min * 100),
          Math.floor(perda.max * 100)
        ) / 100;

      const valorPerdido = Math.floor(valorBase * porcentagemPerda);

      return {
        valor: -valorPerdido,
        ganhou: false,
      };
    }
  }

  /**
   * Calcula o valor ganho ou perdido no comando crime
   * @returns {Object} - Objeto contendo o valor e se ganhou ou perdeu
   */
  calcularValorCrime() {
    const { min, max, perda, taxaSucesso } = config.economia.crime;

    // Taxa de sucesso personalizada (45% em vez de 50%)
    const ganhou = Math.random() < (taxaSucesso || 0.45);

    // Calcular valor base que seria ganho
    const valorBase = this.gerarValorAleatorio(min, max);

    if (ganhou) {
      return {
        valor: valorBase,
        ganhou: true,
      };
    } else {
      // Perder uma porcentagem do que teria ganho
      const porcentagemPerda =
        this.gerarValorAleatorio(
          Math.floor(perda.min * 100),
          Math.floor(perda.max * 100)
        ) / 100;

      const valorPerdido = Math.floor(valorBase * porcentagemPerda);

      return {
        valor: -valorPerdido,
        ganhou: false,
      };
    }
  }

  /**
   * Calcula o resultado do comando roubar
   * @param {number} saldoLadrao - Saldo do ladrão
   * @param {number} saldoVitima - Saldo da vítima
   * @param {number} [bonusChance=0] - Bônus de chance de sucesso (0-1)
   * @returns {Object} - Objeto com resultado do roubo
   */
  calcularRoubo(saldoLadrao, saldoVitima, bonusChance = 0) {
    const { min, max, taxaSuccessoBase, multaMin, multaMax } = config.economia.roubar;
    
    // Calcular probabilidade base de sucesso
    // Quanto maior o saldo da vítima em relação ao ladrão, mais difícil roubar
    let taxaSucesso = taxaSuccessoBase || 0.4;
    
    // Ajustar com base na diferença de patrimônio
    // Uma penalidade se a vítima tem muito mais dinheiro
    if (saldoVitima > saldoLadrao * 2) {
      // Se vítima tem mais que o dobro, reduz chance
      taxaSucesso *= 0.8;
    }
    
    // Um bônus adicional se o ladrão tem moralidade negativa
    taxaSucesso += bonusChance;
    
    // Limitar entre 15% e 70%
    taxaSucesso = Math.max(0.15, Math.min(0.7, taxaSucesso));
    
    // Determinar sucesso
    const sucesso = Math.random() < taxaSucesso;
    
    if (sucesso) {
      // Se bem-sucedido, rouba uma porcentagem do saldo da vítima
      const percentualRoubado = min + Math.random() * (max - min);
      const valorRoubado = Math.floor(saldoVitima * percentualRoubado);
      
      // Não deixar roubar mais que 30% em valor absoluto
      const valorMaximo = saldoVitima * 0.3;
      const valorFinal = Math.min(valorRoubado, valorMaximo);
      
      return {
        sucesso: true,
        valor: valorFinal,
      };
    } else {
      // Se falhou, paga uma multa baseada no seu próprio saldo
      const percentualMulta = multaMin + Math.random() * (multaMax - multaMin);
      const valorMulta = Math.floor(saldoLadrao * percentualMulta);
      
      return {
        sucesso: false,
        valor: valorMulta,
      };
    }
  }

  /**
   * Formata um valor monetário para exibição
   * @param {number} valor - Valor a ser formatado
   * @returns {string} - Valor formatado
   */
  formatarDinheiro(valor) {
    return `R$${Math.abs(valor).toFixed(2)}`;
  }

  /**
   * Calcula tempo restante de cooldown em formato legível
   * @param {number} tempoRestanteMs - Tempo restante em milissegundos
   * @returns {string} - Tempo formatado
   */
  formatarTempoRestante(tempoRestanteMs) {
    const segundos = Math.ceil(tempoRestanteMs / 1000);

    if (segundos < 60) {
      return `${segundos} segundos`;
    }

    const minutos = Math.ceil(segundos / 60);
    if (minutos < 60) {
      return `${minutos} minutos`;
    }
    
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (horas < 24) {
      return `${horas}h ${minutosRestantes}min`;
    }
    
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    
    return `${dias}d ${horasRestantes}h`;
  }

  /**
   * Calcula recompensa diária
   * @param {number} streak - Número de dias consecutivos
   * @param {number} morality - Valor de moralidade do usuário
   * @returns {Object} - Valores calculados
   */
  calcularRecompensaDiaria(streak, morality) {
    const config = config.recompensas.diaria;
    
    // Recompensa base + bônus por streak
    let recompensa = config.base + (config.bonusPorStreak * streak);
    
    // Limitar ao máximo configurado
    recompensa = Math.min(recompensa, config.maximo);
    
    // Calcular bônus por moralidade positiva
    let bonusMoralidade = 0;
    
    // Apenas moralidade positiva gera bônus
    if (morality > 0) {
      // Até 20% para moralidade 100
      bonusMoralidade = Math.floor(recompensa * (morality / 500));
    }
    
    return {
      valorBase: recompensa,
      bonusMoralidade: bonusMoralidade,
      valorTotal: recompensa + bonusMoralidade
    };
  }

  /**
   * Calcula recompensa semanal
   * @param {number} streak - Número de semanas consecutivas
   * @param {number} morality - Valor de moralidade do usuário
   * @returns {Object} - Valores calculados
   */
  calcularRecompensaSemanal(streak, morality) {
    const config = config.recompensas.semanal;
    
    // Recompensa base + bônus por streak
    let recompensa = config.base + (config.bonusPorStreak * streak);
    
    // Limitar ao máximo configurado
    recompensa = Math.min(recompensa, config.maximo);
    
    // Calcular bônus por moralidade positiva
    let bonusMoralidade = 0;
    
    // Apenas moralidade positiva gera bônus
    if (morality > 0) {
      // Até 20% para moralidade 100
      bonusMoralidade = Math.floor(recompensa * (morality / 500));
    }
    
    return {
      valorBase: recompensa,
      bonusMoralidade: bonusMoralidade,
      valorTotal: recompensa + bonusMoralidade
    };
  }
}

export default new EconomicsUtils();