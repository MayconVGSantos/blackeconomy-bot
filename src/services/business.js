import { getDatabase, ref, get, set, update, increment } from "firebase/database";
import { initializeApp } from "firebase/app";
import config from "../../config/config.js";
import dotenv from "dotenv";

dotenv.config();

// Configuração do Firebase (seguindo o mesmo padrão dos outros serviços)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || config.firebase.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || config.firebase.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || config.firebase.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || config.firebase.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || config.firebase.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || config.firebase.appId,
  databaseURL: process.env.FIREBASE_DATABASE_URL || config.firebase.databaseURL,
};

// Reutilizar a app existente ou criar uma nova
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  app = initializeApp(firebaseConfig, "business-service");
}

/**
 * Serviço para gerenciar empresas dos jogadores
 */
class BusinessService {
  constructor() {
    // Tipos de empresas disponíveis, com custos e lucros
    this.BUSINESS_TYPES = {
      loja: { 
        name: "Loja", 
        cost: 50000, 
        profit: 5000, 
        interval: 3600000, // 1 hora em ms
        description: "Uma pequena loja que gera lucros a cada hora."
      },
      restaurante: { 
        name: "Restaurante", 
        cost: 120000, 
        profit: 14000, 
        interval: 7200000, // 2 horas em ms
        description: "Um restaurante que gera mais lucros, mas com intervalo maior."
      },
      fabrica: { 
        name: "Fábrica", 
        cost: 250000, 
        profit: 40000, 
        interval: 10800000, // 3 horas em ms
        description: "Uma fábrica que gera lucros substanciais em intervalos maiores."
      },
      shopping: { 
        name: "Shopping", 
        cost: 500000, 
        profit: 100000, 
        interval: 21600000, // 6 horas em ms
        description: "Um shopping center que gera lucros significativos a cada 6 horas."
      }
    };
  }

  /**
   * Cria uma nova empresa para o usuário
   * @param {string} userId - ID do usuário
   * @param {string} type - Tipo de empresa
   * @returns {Promise<Object>} - Resultado da criação
   */
  async createBusiness(userId, type) {
    try {
      const database = getDatabase();
      const businessRef = ref(database, `users/${userId}/business`);
      const userRef = ref(database, `users/${userId}`);

      if (!this.BUSINESS_TYPES[type]) {
        return { success: false, message: "Tipo de empresa inválido." };
      }

      // Verificar se o usuário já tem uma empresa
      const snapshot = await get(businessRef);
      if (snapshot.exists()) {
        return { success: false, message: "Você já possui uma empresa." };
      }

      // Verificar se o usuário tem saldo suficiente
      const userSnapshot = await get(userRef);
      if (!userSnapshot.exists()) {
        return { success: false, message: "Usuário não encontrado." };
      }

      const userData = userSnapshot.val();
      const saldo = userData.saldo || 0;
      const cost = this.BUSINESS_TYPES[type].cost;

      if (saldo < cost) {
        return { 
          success: false, 
          message: `Saldo insuficiente. Você precisa de R$${cost.toLocaleString()} para criar uma ${this.BUSINESS_TYPES[type].name}.`
        };
      }

      // Criar empresa
      const businessData = {
        type,
        name: this.BUSINESS_TYPES[type].name,
        profit: this.BUSINESS_TYPES[type].profit,
        lastCollected: Date.now(),
        level: 1,
        createdAt: Date.now()
      };

      // Deduzir o saldo
      const firebaseService = (await import("./firebase.js")).default;
      const newBalance = await firebaseService.updateUserBalance(userId, -cost);

      await set(businessRef, businessData);

      return { 
        success: true, 
        business: businessData, 
        newBalance
      };
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      return { success: false, message: "Ocorreu um erro ao criar sua empresa." };
    }
  }

  /**
   * Coleta os lucros da empresa do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado da coleta
   */
  async collectProfit(userId) {
    try {
      const database = getDatabase();
      const businessRef = ref(database, `users/${userId}/business`);
      const snapshot = await get(businessRef);

      if (!snapshot.exists()) {
        return { success: false, message: "Você não possui uma empresa." };
      }

      const business = snapshot.val();
      const now = Date.now();
      const elapsed = now - business.lastCollected;
      const interval = this.BUSINESS_TYPES[business.type].interval;

      if (elapsed < interval) {
        const timeRemaining = interval - elapsed;
        const minutes = Math.ceil(timeRemaining / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        let timeMsg = '';
        if (hours > 0) {
          timeMsg = `${hours}h ${mins}min`;
        } else {
          timeMsg = `${mins} minutos`;
        }
        
        return { 
          success: false, 
          message: `Aguarde ${timeMsg} para coletar novamente.`,
          timeRemaining
        };
      }

      // Calcular quantos intervalos se passaram (para caso o jogador fique sem coletar por muito tempo)
      const intervals = Math.floor(elapsed / interval);
      const maxIntervals = 5; // Limite para não ficar muito OP
      const effectiveIntervals = Math.min(intervals, maxIntervals);
      
      // Calcular o lucro com base no nível da empresa
      const baseProfit = business.profit;
      const level = business.level || 1;
      const levelMultiplier = 1 + ((level - 1) * 0.2); // Cada nível aumenta o lucro em 20%
      const profit = Math.round(baseProfit * levelMultiplier * effectiveIntervals);

      // Atualizar último tempo de coleta
      await update(businessRef, { lastCollected: now });

      // Adicionar lucro ao saldo do usuário
      const firebaseService = (await import("./firebase.js")).default;
      const newBalance = await firebaseService.updateUserBalance(userId, profit);

      // Registrar transação para estatísticas
      await this.registerTransaction(userId, profit);

      return { 
        success: true, 
        profit, 
        newBalance,
        businessName: business.name,
        businessLevel: level,
        intervals: effectiveIntervals
      };
    } catch (error) {
      console.error("Erro ao coletar lucro:", error);
      return { success: false, message: "Ocorreu um erro ao coletar os lucros." };
    }
  }

  /**
   * Registra uma transação de negócios
   * @param {string} userId - ID do usuário
   * @param {number} amount - Valor da transação
   */
  async registerTransaction(userId, amount) {
    try {
      const database = getDatabase();
      const statsRef = ref(database, `users/${userId}/stats/business`);
      
      const snapshot = await get(statsRef);
      
      if (snapshot.exists()) {
        await update(statsRef, {
          totalProfit: increment(amount),
          collections: increment(1)
        });
      } else {
        await set(statsRef, {
          totalProfit: amount,
          collections: 1
        });
      }
    } catch (error) {
      console.error("Erro ao registrar transação:", error);
    }
  }

  /**
   * Melhora a empresa do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado da melhoria
   */
  async upgradeBusiness(userId) {
    try {
      const database = getDatabase();
      const businessRef = ref(database, `users/${userId}/business`);
      const userRef = ref(database, `users/${userId}`);
      
      const businessSnapshot = await get(businessRef);
      const userSnapshot = await get(userRef);
      
      if (!businessSnapshot.exists()) {
        return { success: false, message: "Você não possui uma empresa." };
      }
      
      if (!userSnapshot.exists()) {
        return { success: false, message: "Usuário não encontrado." };
      }
      
      const business = businessSnapshot.val();
      const userData = userSnapshot.val();
      
      const currentLevel = business.level || 1;
      const maxLevel = 5; // Nível máximo da empresa
      
      if (currentLevel >= maxLevel) {
        return { success: false, message: "Sua empresa já está no nível máximo." };
      }
      
      // Calcular custo da melhoria (aumenta exponencialmente)
      const baseTypeCost = this.BUSINESS_TYPES[business.type].cost;
      const upgradeCost = Math.round(baseTypeCost * 0.5 * Math.pow(1.5, currentLevel));
      
      // Verificar saldo
      const saldo = userData.saldo || 0;
      if (saldo < upgradeCost) {
        return { 
          success: false, 
          message: `Saldo insuficiente. Você precisa de R$${upgradeCost.toLocaleString()} para melhorar sua empresa.`,
          upgradeCost,
          currentBalance: saldo
        };
      }
      
      // Deduzir o saldo
      const firebaseService = (await import("./firebase.js")).default;
      const newBalance = await firebaseService.updateUserBalance(userId, -upgradeCost);
      
      // Atualizar nível
      const newLevel = currentLevel + 1;
      await update(businessRef, { level: newLevel });
      
      // Calcular novo lucro
      const baseProfit = this.BUSINESS_TYPES[business.type].profit;
      const newLevelMultiplier = 1 + ((newLevel - 1) * 0.2);
      const newProfit = Math.round(baseProfit * newLevelMultiplier);
      
      return {
        success: true,
        newLevel,
        oldLevel: currentLevel,
        upgradeCost,
        newBalance,
        newProfit,
        businessName: business.name
      };
    } catch (error) {
      console.error("Erro ao melhorar empresa:", error);
      return { success: false, message: "Ocorreu um erro ao melhorar sua empresa." };
    }
  }

  /**
   * Obtém informações da empresa do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Informações da empresa
   */
  async getBusinessInfo(userId) {
    try {
      const database = getDatabase();
      const businessRef = ref(database, `users/${userId}/business`);
      const snapshot = await get(businessRef);

      if (!snapshot.exists()) {
        return { hasBusiness: false };
      }

      const business = snapshot.val();
      const type = business.type;
      const baseInfo = this.BUSINESS_TYPES[type];
      
      // Calcular tempo restante
      const now = Date.now();
      const elapsed = now - business.lastCollected;
      const interval = baseInfo.interval;
      const canCollect = elapsed >= interval;
      
      let timeRemaining = 0;
      let formattedTimeRemaining = '';
      
      if (!canCollect) {
        timeRemaining = interval - elapsed;
        const minutes = Math.ceil(timeRemaining / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
          formattedTimeRemaining = `${hours}h ${mins}min`;
        } else {
          formattedTimeRemaining = `${mins} minutos`;
        }
      }
      
      // Calcular lucro atual com base no nível
      const level = business.level || 1;
      const levelMultiplier = 1 + ((level - 1) * 0.2);
      const currentProfit = Math.round(baseInfo.profit * levelMultiplier);
      
      // Calcular próximo nível (se aplicável)
      const nextLevel = level < 5 ? level + 1 : null;
      let nextLevelProfit = null;
      let upgradeCost = null;
      
      if (nextLevel) {
        const nextLevelMultiplier = 1 + ((nextLevel - 1) * 0.2);
        nextLevelProfit = Math.round(baseInfo.profit * nextLevelMultiplier);
        upgradeCost = Math.round(baseInfo.cost * 0.5 * Math.pow(1.5, level));
      }
      
      // Obter estatísticas
      const statsRef = ref(database, `users/${userId}/stats/business`);
      const statsSnapshot = await get(statsRef);
      const stats = statsSnapshot.exists() ? statsSnapshot.val() : { totalProfit: 0, collections: 0 };

      return {
        hasBusiness: true,
        name: business.name,
        type: business.type,
        description: baseInfo.description,
        level,
        currentProfit,
        canCollect,
        timeRemaining,
        formattedTimeRemaining,
        lastCollected: business.lastCollected,
        createdAt: business.createdAt,
        nextLevel,
        nextLevelProfit,
        upgradeCost,
        stats: {
          totalProfit: stats.totalProfit || 0,
          collections: stats.collections || 0
        },
        interval: {
          ms: interval,
          minutes: interval / 60000
        }
      };
    } catch (error) {
      console.error("Erro ao obter informações da empresa:", error);
      return { hasBusiness: false, error: "Erro ao obter informações da empresa." };
    }
  }
}

const businessService = new BusinessService();
export default businessService;