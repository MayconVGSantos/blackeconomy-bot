// inventory.js
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update,
    increment 
   } from 'firebase/database';
   import { initializeApp } from 'firebase/app';
   import storeItemsService from './store-items.js';
   import dotenv from 'dotenv';
   
   dotenv.config();
   
   // Configuração do Firebase - usando a mesma configuração existente
   const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCe_5sZfPnyByoB-gI7ebKbaS8yy7cawEg",
    authDomain: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac",
    storageBucket: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "394363116218",
    appId: process.env.FIREBASE_APP_ID || "1:394363116218:web:9fff42705eaef4f5800083",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://blackeconomy-874ac-default-rtdb.firebaseio.com"
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
   * Serviço para gerenciar o inventário dos usuários
   * Responsável por adicionar, remover e verificar itens
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
              fichas_cassino: 0,
              items: {}
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
        console.error('Erro ao inicializar inventário:', error);
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
        console.error('Erro ao obter inventário:', error);
        throw error;
      }
    }
   
    /**
     * Adiciona um item ao inventário do usuário
     * @param {string} userId - ID do usuário
     * @param {string} itemId - ID do item
     * @param {number} quantity - Quantidade a adicionar
     * @returns {Promise<Object>} - Inventário atualizado
     */
    async addItem(userId, itemId, quantity = 1) {
      try {
        // Verificar se o item existe
        const item = storeItemsService.getItemById(itemId);
        if (!item) {
          throw new Error(`Item ${itemId} não existe`);
        }
        
        // Obter inventário atual
        await this.initUserInventory(userId);
        
        // Casos especiais como fichas de cassino
        if (itemId.startsWith('fichas_cassino_')) {
          const fichas = item.quantidade;
          await this.addCasinoChips(userId, fichas);
          return this.getUserInventory(userId);
        }
        
        // Para outros itens normais
        const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
        const snapshot = await get(itemRef);
        
        if (snapshot.exists()) {
          // Se o item já existe, incrementa a quantidade
          await update(itemRef, {
            quantity: increment(quantity)
          });
        } else {
          // Se o item não existe, adiciona
          await set(itemRef, {
            quantity: quantity,
            lastUsed: null
          });
        }
        
        return this.getUserInventory(userId);
      } catch (error) {
        console.error('Erro ao adicionar item:', error);
        throw error;
      }
    }
   
    /**
     * Remove um item do inventário do usuário
     * @param {string} userId - ID do usuário
     * @param {string} itemId - ID do item
     * @param {number} quantity - Quantidade a remover
     * @returns {Promise<boolean>} - Verdadeiro se removido com sucesso
     */
    async removeItem(userId, itemId, quantity = 1) {
      try {
        const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
        const snapshot = await get(itemRef);
        
        if (!snapshot.exists()) {
          return false;
        }
        
        const currentQuantity = snapshot.val().quantity;
        
        if (currentQuantity <= quantity) {
          // Remove completamente o item
          await set(itemRef, null);
        } else {
          // Decrementa a quantidade
          await update(itemRef, {
            quantity: currentQuantity - quantity
          });
        }
        
        return true;
      } catch (error) {
        console.error('Erro ao remover item:', error);
        throw error;
      }
    }
   
    /**
     * Verifica se o usuário tem um item e a quantidade especificada
     * @param {string} userId - ID do usuário
     * @param {string} itemId - ID do item
     * @param {number} quantity - Quantidade mínima necessária
     * @returns {Promise<boolean>} - Verdadeiro se o usuário tem o item
     */
    async hasItem(userId, itemId, quantity = 1) {
      try {
        const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
        const snapshot = await get(itemRef);
        
        if (!snapshot.exists()) {
          return false;
        }
        
        return snapshot.val().quantity >= quantity;
      } catch (error) {
        console.error('Erro ao verificar item:', error);
        return false;
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
        const chipsRef = ref(database, `users/${userId}/inventory/fichas_cassino`);
        const snapshot = await get(chipsRef);
        
        const currentChips = snapshot.exists() ? snapshot.val() : 0;
        const newTotal = currentChips + amount;
        
        await set(chipsRef, newTotal);
        
        return newTotal;
      } catch (error) {
        console.error('Erro ao adicionar fichas de cassino:', error);
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
        const chipsRef = ref(database, `users/${userId}/inventory/fichas_cassino`);
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
        console.error('Erro ao remover fichas de cassino:', error);
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
        console.error('Erro ao obter fichas de cassino:', error);
        return 0;
      }
    }
   
    /**
     * Marca um item como usado e registra o timestamp
     * @param {string} userId - ID do usuário
     * @param {string} itemId - ID do item
     * @returns {Promise<boolean>} - Verdadeiro se atualizado com sucesso
     */
    async useItem(userId, itemId) {
      try {
        const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
        const snapshot = await get(itemRef);
        
        if (!snapshot.exists() || snapshot.val().quantity < 1) {
          return false;
        }
        
        // Atualiza lastUsed e decrementa a quantidade
        await update(itemRef, {
          lastUsed: Date.now(),
          quantity: snapshot.val().quantity - 1
        });
        
        return true;
      } catch (error) {
        console.error('Erro ao usar item:', error);
        throw error;
      }
    }
   
    /**
     * Verifica se um item está em cooldown
     * @param {string} userId - ID do usuário
     * @param {string} itemId - ID do item
     * @returns {Promise<{emCooldown: boolean, tempoRestante: number}>}
     */
    async checkItemCooldown(userId, itemId) {
      try {
        const item = storeItemsService.getItemById(itemId);
        
        if (!item || !item.cooldown) {
          return { emCooldown: false, tempoRestante: 0 };
        }
        
        const itemRef = ref(database, `users/${userId}/inventory/items/${itemId}`);
        const snapshot = await get(itemRef);
        
        if (!snapshot.exists() || !snapshot.val().lastUsed) {
          return { emCooldown: false, tempoRestante: 0 };
        }
        
        const lastUsed = snapshot.val().lastUsed;
        const agora = Date.now();
        const tempoPassado = agora - lastUsed;
        
        if (tempoPassado < item.cooldown) {
          return {
            emCooldown: true,
            tempoRestante: item.cooldown - tempoPassado
          };
        }
        
        return { emCooldown: false, tempoRestante: 0 };
      } catch (error) {
        console.error('Erro ao verificar cooldown do item:', error);
        return { emCooldown: false, tempoRestante: 0 };
      }
    }
   
    /**
     * Verifica se um usuário tem um efeito ativo
     * @param {string} userId - ID do usuário
     * @param {string} effectType - Tipo de efeito
     * @returns {Promise<{active: boolean, multiplier: number}>}
     */
    async checkActiveEffect(userId, effectType) {
      try {
        const inventory = await this.getUserInventory(userId);
        
        if (!inventory || !inventory.items) {
          return { active: false, multiplier: 1 };
        }
        
        const agora = Date.now();
        
        // Procura por itens com o efeito ativo
        for (const itemId in inventory.items) {
          const itemData = inventory.items[itemId];
          
          if (!itemData.lastUsed) continue;
          
          const item = storeItemsService.getItemById(itemId);
          
          if (!item || item.effect !== effectType || !item.duration) continue;
          
          const timeElapsed = agora - itemData.lastUsed;
          
          if (timeElapsed < item.duration) {
            // O efeito ainda está ativo
            return { 
              active: true, 
              multiplier: typeof item.effectValue === 'object' 
                ? item.effectValue.incomeBoost || 1 
                : item.effectValue || 1,
              timeRemaining: item.duration - timeElapsed
            };
          }
        }
        
        return { active: false, multiplier: 1 };
      } catch (error) {
        console.error('Erro ao verificar efeito ativo:', error);
        return { active: false, multiplier: 1 };
      }
    }
   }
   
   export default new InventoryService();