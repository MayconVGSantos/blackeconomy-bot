// firebase.js
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  increment,
} from "firebase/database";
import { initializeApp } from "firebase/app";
import config from "../../config/config.js";
import dotenv from "dotenv";

dotenv.config();

// Configuração do Firebase
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

// Inicializar o Firebase - reutilizando a app existente ou criando uma nova
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // Se já estiver inicializado, pegue a instância existente
  app = initializeApp(firebaseConfig, "firebase-service");
}

/**
 * Classe de serviço para operações com o Firebase
 */
class FirebaseService {
  /**
   * Obtém os dados de um usuário do Firebase
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Dados do usuário
   */
  async getUserData(userId) {
    try {
      const database = getDatabase();
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        // Se o usuário não existir, cria um novo
        const userData = {
          userId,
          saldo: 0,
          createdAt: Date.now(),
        };

        await set(userRef, userData);
        return userData;
      }
    } catch (error) {
      console.error("Erro ao obter dados do usuário:", error);
      throw error;
    }
  }

  /**
   * Atualiza o saldo de um usuário
   * @param {string} userId - ID do usuário
   * @param {number} amount - Valor a adicionar/subtrair (negativo para subtrair)
   * @returns {Promise<number>} - Novo saldo
   */
  async updateUserBalance(userId, amount) {
    try {
      const database = getDatabase();
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const currentBalance = userData.saldo || 0;
        const newBalance = Math.max(0, currentBalance + amount); // Não permite saldo negativo

        await update(userRef, { saldo: newBalance });
        return newBalance;
      } else {
        // Se o usuário não existir, cria um novo com o saldo fornecido
        const initialBalance = Math.max(0, amount);
        const userData = {
          userId,
          saldo: initialBalance,
          createdAt: Date.now(),
        };

        await set(userRef, userData);
        return initialBalance;
      }
    } catch (error) {
      console.error("Erro ao atualizar saldo:", error);
      throw error;
    }
  }

  /**
   * Verifica se um comando está em cooldown
   * @param {string} userId - ID do usuário
   * @param {string} command - Nome do comando
   * @param {number} cooldownTime - Tempo de cooldown em ms
   * @returns {Promise<{emCooldown: boolean, tempoRestante: number}>}
   */
  async checkCooldown(userId, command, cooldownTime) {
    try {
      const database = getDatabase();
      const cooldownRef = ref(database, `users/${userId}/cooldowns/${command}`);
      const snapshot = await get(cooldownRef);

      if (snapshot.exists()) {
        const lastUsed = snapshot.val();
        const now = Date.now();
        const timeElapsed = now - lastUsed;

        if (timeElapsed < cooldownTime) {
          return {
            emCooldown: true,
            tempoRestante: cooldownTime - timeElapsed,
          };
        }
      }

      return { emCooldown: false, tempoRestante: 0 };
    } catch (error) {
      console.error("Erro ao verificar cooldown:", error);
      return { emCooldown: false, tempoRestante: 0 };
    }
  }

  /**
   * Registra o uso de um comando para cooldown
   * @param {string} userId - ID do usuário
   * @param {string} command - Nome do comando
   * @returns {Promise<void>}
   */
  async setCooldown(userId, command) {
    try {
      const database = getDatabase();
      const cooldownRef = ref(database, `users/${userId}/cooldowns/${command}`);

      await set(cooldownRef, Date.now());
    } catch (error) {
      console.error("Erro ao definir cooldown:", error);
      throw error;
    }
  }

  /**
   * Obtém o ranking de usuários por saldo
   * @param {number} limit - Limite de usuários
   * @param {number} page - Página atual
   * @returns {Promise<Array>} - Array de usuários ordenados
   */
  async getTopUsers(limit = 10, page = 1) {
    try {
      const database = getDatabase();
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        return [];
      }

      // Converter para array e ordenar por saldo (decrescente)
      let users = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        users.push({
          userId: userData.userId || childSnapshot.key,
          saldo: userData.saldo || 0,
        });
      });

      // Ordenar por saldo (decrescente)
      users.sort((a, b) => b.saldo - a.saldo);

      // Aplicar paginação
      const skip = (page - 1) * limit;
      const pageUsers = users.slice(skip, skip + limit);

      return pageUsers;
    } catch (error) {
      console.error("Erro ao obter ranking de usuários:", error);
      return [];
    }
  }

  /**
   * Conta o total de usuários registrados
   * @returns {Promise<number>} - Total de usuários
   */
  async getTotalUsersCount() {
    try {
      const database = getDatabase();
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        return 0;
      }

      let count = 0;
      snapshot.forEach(() => count++);

      return count;
    } catch (error) {
      console.error("Erro ao contar usuários:", error);
      return 0;
    }
  }

  /**
   * Obtém a posição do usuário no ranking
   * @param {string} userId - ID do usuário
   * @returns {Promise<{position: number, saldo: number}|null>}
   */
  async getUserRanking(userId) {
    try {
      const database = getDatabase();
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
        return null;
      }

      const userData = snapshot.val();

      // Obter todos os usuários e classificá-los
      const usersRef = ref(database, "users");
      const usersSnapshot = await get(usersRef);

      if (!usersSnapshot.exists()) {
        return null;
      }

      let users = [];
      usersSnapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        users.push({
          userId: user.userId || childSnapshot.key,
          saldo: user.saldo || 0,
        });
      });

      users.sort((a, b) => b.saldo - a.saldo);

      // Encontrar a posição do usuário
      const position = users.findIndex((user) => user.userId === userId) + 1;

      if (position === 0) {
        return null;
      }

      return {
        position,
        saldo: userData.saldo || 0,
      };
    } catch (error) {
      console.error("Erro ao obter posição do usuário no ranking:", error);
      return null;
    }
  }
}

// Criar uma instância e exportá-la
const firebaseService = new FirebaseService();
export default firebaseService;
