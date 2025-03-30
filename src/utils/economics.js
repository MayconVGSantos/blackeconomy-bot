// economics.js
import config from "../../config/config.js";

/**
 * Utilitários para cálculos econômicos do bot
 * Com funções otimizadas para valores mais equilibrados
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

    // Implementar uma distribuição mais ponderada para evitar extremos frequentes
    const random = Math.random();
    const weightedRandom = Math.pow(random, 1.2); // Distribuição com leve tendência a valores mais baixos

    return Math.floor(min + weightedRandom * (max - min));
  }

  /**
   * Calcula o valor ganho ou perdido no comando seduzir
   * @returns {Object} - Objeto contendo o valor e se ganhou ou perdeu
   */
  calcularValorSeduzir() {
    const { min, max, perda } = config.economia.seduzir;

    // 50% de chance de ganhar
    const ganhou = Math.random() >= 0.5;

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
    const { min, max, perda } = config.economia.crime;

    // 50% de chance de ganhar
    const ganhou = Math.random() >= 0.5;

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
    return `${minutos} minutos`;
  }

  /**
   * Verifica se o usuário tem algum efeito ativo e aplica o multiplicador correspondente
   * @param {string} userId - ID do usuário
   * @param {string} effectType - Tipo de efeito a verificar (boost_work, boost_crime, vip_status)
   * @returns {Promise<number>} - Multiplicador a ser aplicado (1 se não houver efeito)
   */
  async getEffectMultiplier(userId, effectType) {
    try {
      // Importar somente para este escopo para evitar importação circular
      const { getDatabase, ref, get } = await import("firebase/database");
      const database = getDatabase();

      const effectsRef = ref(database, `users/${userId}/activeEffects`);
      const snapshot = await get(effectsRef);

      if (!snapshot.exists()) {
        return 1; // Sem multiplicador
      }

      const effects = snapshot.val();
      const now = Date.now();

      // Verificar efeito específico
      if (effects[effectType] && effects[effectType].expiration > now) {
        return effects[effectType].multiplier || 1;
      }

      // Verificar efeito VIP (afeta todos os comandos)
      if (effects.vip_status && effects.vip_status.expiration > now) {
        if (effectType === "cooldown") {
          return 1 - (effects.vip_status.cooldownReduction || 0);
        } else {
          return 1 + (effects.vip_status.incomeBoost || 0);
        }
      }

      return 1; // Sem multiplicador
    } catch (error) {
      console.error("Erro ao verificar efeitos ativos:", error);
      return 1; // Em caso de erro, sem multiplicador
    }
  }

  /**
   * Calcula o valor ganho no comando trabalhar considerando efeitos ativos
   * @param {string} userId - ID do usuário para verificar efeitos
   * @returns {Promise<number>} - Valor ganho
   */
  async calcularValorTrabalharComEfeitos(userId) {
    const { min, max } = config.economia.trabalhar;

    const random = Math.random();
    const weightedRandom = Math.pow(random, 1.2);

    const baseValue = Math.floor(min + weightedRandom * (max - min));

    // Aplicar multiplicador de efeitos ativos
    const multiplier = await this.getEffectMultiplier(userId, "boost_work");

    return Math.floor(baseValue * multiplier);
  }

  /**
   * Calcula o valor ganho ou perdido no comando crime considerando efeitos ativos
   * @param {string} userId - ID do usuário para verificar efeitos
   * @returns {Promise<Object>} - Objeto contendo o valor e se ganhou ou perdeu
   */
  async calcularValorCrimeComEfeitos(userId) {
    const { min, max, perda } = config.economia.crime;

    // Aplicar multiplicador para chance de sucesso
    const effectMultiplier = await this.getEffectMultiplier(
      userId,
      "boost_crime"
    );

    // Ajustar a chance de ganhar com base no multiplicador (limitado entre 25% e 75%)
    let chanceGanhar = 0.5;
    if (effectMultiplier > 1) {
      chanceGanhar = Math.min(0.75, 0.5 + (effectMultiplier - 1) * 0.5);
    }

    // 50% de chance de ganhar (ou modificado pelo efeito)
    const ganhou = Math.random() < chanceGanhar;

    // Calcular valor base que seria ganho
    const valorBase = this.gerarValorAleatorio(min, max);

    if (ganhou) {
      // Aplicar multiplicador de efeitos ativos
      const valorComEfeito = Math.floor(valorBase * effectMultiplier);

      return {
        valor: valorComEfeito,
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
   * Calcula o valor ganho ou perdido no comando seduzir considerando efeitos ativos
   * @param {string} userId - ID do usuário para verificar efeitos
   * @returns {Promise<Object>} - Objeto contendo o valor e se ganhou ou perdeu
   */
  async calcularValorSeduzirComEfeitos(userId) {
    const { min, max, perda } = config.economia.seduzir;

    // O VIP pode afetar todos os comandos
    const effectMultiplier = await this.getEffectMultiplier(
      userId,
      "vip_status"
    );

    // 50% de chance de ganhar (VIP não afeta chance, só o valor)
    const ganhou = Math.random() >= 0.5;

    // Calcular valor base que seria ganho
    const valorBase = this.gerarValorAleatorio(min, max);

    if (ganhou) {
      // Aplicar multiplicador de efeitos ativos (VIP)
      const valorComEfeito = Math.floor(valorBase * effectMultiplier);

      return {
        valor: valorComEfeito,
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
}

export default new EconomicsUtils();
