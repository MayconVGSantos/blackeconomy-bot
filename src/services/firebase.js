// firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update, 
  child,
  query,
  orderByChild,
  limitToLast
} from 'firebase/database';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCe_5sZfPnyByoB-gI7ebKbaS8yy7cawEg",
  authDomain: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebaseapp.com`,
  projectId: process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac",
  storageBucket: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebasestorage.app`,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "394363116218",
  appId: process.env.FIREBASE_APP_ID || "1:394363116218:web:9fff42705eaef4f5800083",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://blackeconomy-874ac-default-rtdb.firebaseio.com"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * Obtém os dados do usuário do Firebase
 * @param {string} userId - ID do usuário do Discord
 * @returns {Promise<Object>} - Dados do usuário
 */
async function getUserData(userId) {
  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      // Criar novo usuário se não existir
      const newUserData = {
        userId,
        saldo: 0,
        cooldowns: {}
      };
      
      await set(userRef, newUserData);
      return newUserData;
    }
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    throw error;
  }
}

/**
 * Atualiza o saldo do usuário
 * @param {string} userId - ID do usuário do Discord
 * @param {number} valor - Valor a ser adicionado ou subtraído
 * @returns {Promise<number>} - Novo saldo
 */
async function updateUserBalance(userId, valor) {
  try {
    const userData = await getUserData(userId);
    const novoSaldo = userData.saldo + valor;
    
    const userRef = ref(database, `users/${userId}`);
    await update(userRef, {
      saldo: novoSaldo
    });
    
    return novoSaldo;
  } catch (error) {
    console.error('Erro ao atualizar saldo do usuário:', error);
    throw error;
  }
}

/**
 * Define o cooldown de um comando para um usuário
 * @param {string} userId - ID do usuário do Discord
 * @param {string} comando - Nome do comando
 * @returns {Promise<void>}
 */
async function setCooldown(userId, comando) {
  try {
    const userRef = ref(database, `users/${userId}/cooldowns`);
    await update(userRef, {
      [comando]: Date.now()
    });
  } catch (error) {
    console.error('Erro ao definir cooldown:', error);
    throw error;
  }
}

/**
 * Verifica se um comando está em cooldown para um usuário
 * @param {string} userId - ID do usuário do Discord
 * @param {string} comando - Nome do comando
 * @param {number} tempoEspera - Tempo de espera em ms
 * @returns {Promise<{emCooldown: boolean, tempoRestante: number}>}
 */
async function checkCooldown(userId, comando, tempoEspera) {
  try {
    const userData = await getUserData(userId);
    const cooldowns = userData.cooldowns || {};
    
    if (!cooldowns[comando]) {
      return { emCooldown: false, tempoRestante: 0 };
    }
    
    const ultimoUso = cooldowns[comando];
    const agora = Date.now();
    const tempoPassado = agora - ultimoUso;
    
    if (tempoPassado < tempoEspera) {
      return {
        emCooldown: true,
        tempoRestante: tempoEspera - tempoPassado
      };
    }
    
    return { emCooldown: false, tempoRestante: 0 };
  } catch (error) {
    console.error('Erro ao verificar cooldown:', error);
    // Em caso de erro, permitir o comando para evitar bloqueio
    return { emCooldown: false, tempoRestante: 0 };
  }
}

/**
 * Obtém os usuários com maior saldo
 * @param {number} limit - Número de usuários a retornar
 * @param {number} page - Página atual (começa em 1)
 * @returns {Promise<Array>} - Lista de usuários ordenada por saldo
 */
async function getTopUsers(limit = 10, page = 1) {
  try {
    const skip = (page - 1) * limit;
    const usersRef = ref(database, 'users');
    
    // Para obter mais que o limite, aumentamos o limite de consulta
    // e depois aplicamos a paginação manualmente
    const userQuery = query(
      usersRef,
      orderByChild('saldo'),
      limitToLast(skip + limit) // Ordenado por saldo (crescente)
    );
    
    const snapshot = await get(userQuery);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    // Converter para array e ordenar por saldo (decrescente)
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      users.push({
        userId: user.userId || childSnapshot.key,
        saldo: user.saldo || 0
      });
    });
    
    // Ordenar por saldo (decrescente)
    users.sort((a, b) => b.saldo - a.saldo);
    
    // Aplicar paginação
    const pageUsers = users.slice(skip, skip + limit);
    
    return pageUsers;
  } catch (error) {
    console.error('Erro ao obter ranking de usuários:', error);
    return [];
  }
}

/**
 * Obtém o número total de usuários
 * @returns {Promise<number>} - Contagem total de usuários
 */
async function getTotalUsersCount() {
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    let count = 0;
    snapshot.forEach(() => count++);
    
    return count;
  } catch (error) {
    console.error('Erro ao contar usuários:', error);
    return 0;
  }
}

/**
 * Obtém a posição de um usuário no ranking
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>} - Posição e saldo do usuário
 */
async function getUserRanking(userId) {
  try {
    // Primeiro, verificamos se o usuário existe
    const userData = await getUserData(userId);
    
    if (!userData) {
      return null;
    }
    
    // Obter todos os usuários e ordenar por saldo
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    // Converter para array e ordenar por saldo (decrescente)
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      users.push({
        userId: user.userId || childSnapshot.key,
        saldo: user.saldo || 0
      });
    });
    
    users.sort((a, b) => b.saldo - a.saldo);
    
    // Encontrar a posição do usuário
    const userIndex = users.findIndex(user => user.userId === userId);
    
    if (userIndex === -1) {
      return null;
    }
    
    return {
      position: userIndex + 1,
      saldo: userData.saldo
    };
  } catch (error) {
    console.error('Erro ao obter posição do usuário no ranking:', error);
    return null;
  }
}

export {
  getUserData,
  updateUserBalance,
  setCooldown,
  checkCooldown,
  getTopUsers,
  getTotalUsersCount,
  getUserRanking
};

export default {
  getUserData,
  updateUserBalance,
  setCooldown,
  checkCooldown,
  getTopUsers,
  getTotalUsersCount,
  getUserRanking
};