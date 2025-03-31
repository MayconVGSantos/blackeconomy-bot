// morality.js
import { getDatabase, ref, get, set, update } from "firebase/database";
import { initializeApp } from "firebase/app";
import config from "../../config/config.js";
import dotenv from "dotenv";

dotenv.config();

// Configuração do Firebase (mesmo modelo dos outros serviços)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || config.firebase.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || config.firebase.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || config.firebase.projectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || config.firebase.storageBucket,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    config.firebase.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || config.firebase.appId,
  databaseURL: process.env.FIREBASE_DATABASE_URL || config.firebase.databaseURL,
};

// Reutilizar a app existente ou criar uma nova
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  app = initializeApp(firebaseConfig, "morality-service");
}

/**
 * Serviço para gerenciar o sistema de moralidade
 */
class MoralityService {
  constructor() {
    // Constantes para o sistema de moralidade
    this.MORALITY_MIN = -100; // Mais baixo nível de moralidade (Vilão)
    this.MORALITY_MAX = 100; // Mais alto nível de moralidade (Herói)
    this.MORALITY_DEFAULT = 0; // Valor padrão para novos usuários (Neutro)

    // Impactos morais dos comandos
    this.ACTIONS_IMPACT = {
      trabalhar: 2, // Trabalho honesto aumenta moralidade
      seduzir: -1, // Sedução é levemente negativo
      crime: -5, // Crime reduz significativamente a moralidade
      roubar: {
        success: -8, // Roubo bem-sucedido é muito negativo
        fail: -3, // Tentativa de roubo falha é menos negativo, mas ainda ruim
      },
      pix: 1, // Transferir dinheiro é positivo (ajudar outros)
    };

    // Títulos de moralidade
    this.MORALITY_TITLES = [
      { min: 80, title: "Herói da Comunidade", emoji: "😇" },
      { min: 50, title: "Cidadão Exemplar", emoji: "👼" },
      { min: 20, title: "Pessoa de Bem", emoji: "😊" },
      { min: -20, title: "Pessoa Neutra", emoji: "😐" },
      { min: -50, title: "Pessoa Duvidosa", emoji: "😏" },
      { min: -80, title: "Criminoso Conhecido", emoji: "😈" },
      { min: -100, title: "Vilão Infame", emoji: "👿" },
    ];

    // Bônus/penalidades baseados na moralidade
    this.MORALITY_EFFECTS = {
      // Positivos - aumentam com moralidade positiva
      trabalharBonus: (morality) => Math.max(0, Math.floor(morality / 20)), // Até +5% por ponto em trabalhar

      // Negativos - aumentam com moralidade negativa
      crimeBonus: (morality) => Math.max(0, Math.floor(-morality / 20)), // Até +5% por ponto em crime
      rouboBonusChance: (morality) => Math.max(0, -morality / 200), // Até +0.5% por ponto na chance de roubo

      // Penalidades para ações opostas à sua moralidade
      trabalharPenalty: (morality) => Math.max(0, Math.floor(-morality / 25)), // Penalidade para heróis criminosos
      crimePenalty: (morality) => Math.max(0, Math.floor(morality / 25)), // Penalidade para vilões trabalhando
    };

    // Cores para os níveis de moralidade
    this.MORALITY_COLORS = {
      hero: 0x4dff4d, // Verde claro para heróis
      good: 0x99ff99, // Verde mais fraco para bons
      neutral: 0xf2f2f2, // Cinza para neutros
      bad: 0xff9999, // Vermelho fraco para ruins
      villain: 0xff4d4d, // Vermelho forte para vilões
    };
  }

  /**
   * Obtém a moralidade atual do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>} - Valor de moralidade (-100 a 100)
   */
  async getMorality(userId) {
    try {
      const database = getDatabase();
      const moralityRef = ref(database, `users/${userId}/morality`);
      const snapshot = await get(moralityRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        // Inicializa moralidade para novos usuários
        await set(moralityRef, this.MORALITY_DEFAULT);
        return this.MORALITY_DEFAULT;
      }
    } catch (error) {
      console.error("Erro ao obter moralidade:", error);
      return this.MORALITY_DEFAULT;
    }
  }

  /**
   * Atualiza a moralidade do usuário com base em uma ação
   * @param {string} userId - ID do usuário
   * @param {string} action - Nome da ação (trabalhar, crime, etc)
   * @param {boolean} [success] - Se a ação foi bem-sucedida (para ações como roubo)
   * @returns {Promise<number>} - Nova moralidade
   */
  async updateMoralityForAction(userId, action, success = true) {
    try {
      // Obter moralidade atual
      const currentMorality = await this.getMorality(userId);

      // Calcular o impacto da ação
      let impact = 0;

      if (typeof this.ACTIONS_IMPACT[action] === "object") {
        // Ações com diferentes impactos baseados no sucesso
        impact = success
          ? this.ACTIONS_IMPACT[action].success
          : this.ACTIONS_IMPACT[action].fail;
      } else {
        // Ações com impacto fixo
        impact = this.ACTIONS_IMPACT[action] || 0;
      }

      // Calcular nova moralidade
      let newMorality = currentMorality + impact;

      // Limitar ao intervalo válido
      newMorality = Math.max(
        this.MORALITY_MIN,
        Math.min(this.MORALITY_MAX, newMorality)
      );

      // Atualizar no banco de dados
      const database = getDatabase();
      const moralityRef = ref(database, `users/${userId}/morality`);
      await set(moralityRef, newMorality);

      // Registrar estatísticas de ações morais
      await this.updateMoralStats(userId, action, impact);

      return newMorality;
    } catch (error) {
      console.error("Erro ao atualizar moralidade:", error);
      return null;
    }
  }

  /**
   * Atualiza estatísticas de ações morais do usuário
   * @param {string} userId - ID do usuário
   * @param {string} action - Nome da ação
   * @param {number} impact - Impacto moral da ação
   * @returns {Promise<void>}
   */
  async updateMoralStats(userId, action, impact) {
    try {
      const database = getDatabase();
      const statsRef = ref(database, `users/${userId}/moralStats`);

      // Obter estatísticas atuais
      const snapshot = await get(statsRef);
      const stats = snapshot.exists()
        ? snapshot.val()
        : {
            goodActions: 0,
            badActions: 0,
            neutralActions: 0,
          };

      // Atualizar contadores
      if (impact > 0) {
        stats.goodActions = (stats.goodActions || 0) + 1;
      } else if (impact < 0) {
        stats.badActions = (stats.badActions || 0) + 1;
      } else {
        stats.neutralActions = (stats.neutralActions || 0) + 1;
      }

      // Registrar ação específica
      if (!stats.actions) stats.actions = {};
      if (!stats.actions[action]) stats.actions[action] = 0;
      stats.actions[action]++;

      // Salvar estatísticas atualizadas
      await set(statsRef, stats);
    } catch (error) {
      console.error("Erro ao atualizar estatísticas morais:", error);
    }
  }

  /**
   * Obtém o título moral atual do usuário
   * @param {number} morality - Valor de moralidade
   * @returns {Object} - Objeto com título e emoji
   */
  getMoralityTitle(morality) {
    // Encontrar o título correspondente à moralidade
    for (const title of this.MORALITY_TITLES) {
      if (morality >= title.min) {
        return title;
      }
    }

    // Fallback para o título mais baixo
    return this.MORALITY_TITLES[this.MORALITY_TITLES.length - 1];
  }

  /**
   * Obtém a cor correspondente ao nível de moralidade
   * @param {number} morality - Valor de moralidade
   * @returns {number} - Código de cor hexadecimal
   */
  getMoralityColor(morality) {
    if (morality >= 80) return this.MORALITY_COLORS.hero;
    if (morality >= 20) return this.MORALITY_COLORS.good;
    if (morality >= -20) return this.MORALITY_COLORS.neutral;
    if (morality >= -80) return this.MORALITY_COLORS.bad;
    return this.MORALITY_COLORS.villain;
  }

  /**
   * Calcula os bônus/penalidades baseados na moralidade para uma ação específica
   * @param {number} morality - Valor de moralidade
   * @param {string} action - Nome da ação
   * @returns {Object} - Objeto com multiplicador e outras bonificações
   */
  calculateMoralityEffects(morality, action) {
    const effects = {
      multiplier: 1.0, // Multiplicador padrão
      successChanceBonus: 0, // Bônus de chance de sucesso
      description: "", // Descrição dos efeitos
    };

    switch (action) {
      case "trabalhar":
        // Para trabalho, moralidade positiva dá bônus, negativa dá penalidade
        const trabalharBonus = this.MORALITY_EFFECTS.trabalharBonus(morality);
        const trabalharPenalty =
          this.MORALITY_EFFECTS.trabalharPenalty(morality);

        effects.multiplier =
          1.0 + trabalharBonus / 100 - trabalharPenalty / 100;

        if (trabalharBonus > 0) {
          effects.description = `+${trabalharBonus}% por boa reputação`;
        } else if (trabalharPenalty > 0) {
          effects.description = `-${trabalharPenalty}% por má reputação`;
        }
        break;

      case "crime":
        // Para crime, moralidade negativa dá bônus, positiva dá penalidade
        const crimeBonus = this.MORALITY_EFFECTS.crimeBonus(morality);
        const crimePenalty = this.MORALITY_EFFECTS.crimePenalty(morality);

        effects.multiplier = 1.0 + crimeBonus / 100 - crimePenalty / 100;

        if (crimeBonus > 0) {
          effects.description = `+${crimeBonus}% por má reputação`;
        } else if (crimePenalty > 0) {
          effects.description = `-${crimePenalty}% por boa reputação`;
        }
        break;

      case "roubar":
        // Para roubo, moralidade negativa aumenta chance de sucesso
        const rouboChanceBonus =
          this.MORALITY_EFFECTS.rouboBonusChance(morality);

        effects.successChanceBonus = rouboChanceBonus;

        if (rouboChanceBonus > 0) {
          effects.description = `+${(rouboChanceBonus * 100).toFixed(
            1
          )}% chance de sucesso por má reputação`;
        }
        break;

      default:
        // Nenhum efeito para outras ações
        break;
    }

    return effects;
  }
}

// Criar uma instância e exportá-la
const moralityService = new MoralityService();
export default moralityService;
