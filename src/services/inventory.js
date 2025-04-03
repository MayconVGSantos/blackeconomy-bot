// inventory.js - Versão simplificada para apenas fichas de cassino
import {
  getDatabase,
  ref,
  set,
  get,
  update,
} from "firebase/database";
import { initializeApp } from "firebase/app";
import dotenv from "dotenv";

dotenv.config();

// Configuração do Firebase - usando a mesma configuração existente
const firebaseConfig = {
  apiKey:
    process.env.FIREBASE_API_KEY || "AIzaSyCe_5sZfPnyByoB-gI7ebKbaS8yy7cawEg",
  authDomain: `${
    process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"
  }.firebaseapp.com`,
  projectId: process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac",
  storageBucket: `${
    process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"
  }.firebasestorage.app`,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "394363116218",
  appId:
    process.env.FIREBASE_APP_ID || "1:394363116218:web:9fff42705eaef4f5800083",
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    "https://blackeconomy-874ac-default-rtdb.firebaseio.com",
};

// Inicializar o Firebase - reutilizando a app existente ou criando uma nova
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // Se já estiver inicializado, pegue a instância existente
  app = initializeApp(firebaseConfig, "inventory-service");
}

const database = getDatabase(app);

/**
 * Serviço para gerenciar as fichas de cassino dos usuários
 */
class InventoryService {
  /**
   * Inicializa o inventário de um usuário se não existir
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Dados do inventário
   */
  async initUserInventory(userId) {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        // Se o usuário existe mas não tem inventário, inicializa
        if (!userData.inventory) {
          const initialInventory = {
            fichas_cassino: 0
          };

          await update(userRef, { inventory: initialInventory });
          return initialInventory;
        }

        return userData.inventory;
      } else {
        // Se o usuário não existe, retorna null
        return null;
      }
    } catch (error) {
      console.error("Erro ao inicializar inventário:", error);
      throw error;
    }
  }

  /**
   * Obtém o inventário de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Dados do inventário
   */
  async getUserInventory(userId) {
    try {
      const userRef = ref(database, `users/${userId}/inventory`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        // Se não existir, inicializa e retorna
        return this.initUserInventory(userId);
      }
    } catch (error) {
      console.error("Erro ao obter inventário:", error);
      throw error;
    }
  }

  /**
   * Adiciona fichas de cassino ao usuário
   * @param {string} userId - ID do usuário
   * @param {number} amount - Quantidade de fichas
   * @returns {Promise<number>} - Novo total de fichas
   */
  async addCasinoChips(userId, amount) {
    try {
      await this.initUserInventory(userId);
      const chipsRef = ref(
        database,
        `users/${userId}/inventory/fichas_cassino`
      );
      const snapshot = await get(chipsRef);

      const currentChips = snapshot.exists() ? snapshot.val() : 0;
      const newTotal = currentChips + amount;

      await set(chipsRef, newTotal);

      return newTotal;
    } catch (error) {
      console.error("Erro ao adicionar fichas de cassino:", error);
      throw error;
    }
  }

  /**
   * Remove fichas de cassino do usuário
   * @param {string} userId - ID do usuário
   * @param {number} amount - Quantidade de fichas
   * @returns {Promise<boolean>} - Verdadeiro se removido com sucesso
   */
  async removeCasinoChips(userId, amount) {
    try {
      const chipsRef = ref(
        database,
        `users/${userId}/inventory/fichas_cassino`
      );
      const snapshot = await get(chipsRef);

      if (!snapshot.exists()) {
        return false;
      }

      const currentChips = snapshot.val();

      if (currentChips < amount) {
        return false;
      }

      await set(chipsRef, currentChips - amount);

      return true;
    } catch (error) {
      console.error("Erro ao remover fichas de cassino:", error);
      throw error;
    }
  }

  /**
   * Obtém o total de fichas de cassino do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>} - Total de fichas
   */
  async getCasinoChips(userId) {
    try {
      const inventory = await this.getUserInventory(userId);

      if (!inventory) {
        return 0;
      }

      return inventory.fichas_cassino || 0;
    } catch (error) {
      console.error("Erro ao obter fichas de cassino:", error);
      return 0;
    }
  }
}

export default new InventoryService();