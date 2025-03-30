// firebase.js
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update,
  increment
} from 'firebase/database';
import { initializeApp } from 'firebase/app';
import dotenv from 'dotenv';
import config from '../../config/config.js';

dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || config.firebase.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || config.firebase.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || config.firebase.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || config.firebase.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || config.firebase.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || config.firebase.appId,
  databaseURL: process.env.FIREBASE_DATABASE_URL || config.firebase.databaseURL
};

// Initialize Firebase - reuse existing app or create a new one
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // If already initialized, get the existing instance
  app = initializeApp(firebaseConfig, "firebase-service");
}

const database = getDatabase(app);

/**
 * Gets user data from Firebase
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} - User data
 */
async function getUserData(userId) {
  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      // If user doesn't exist, create default user
      const defaultUser = {
        userId,
        saldo: 0
      };
      
      await set(userRef, defaultUser);
      return defaultUser;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

/**
 * Updates user balance
 * @param {string} userId - Discord user ID
 * @param {number} amount - Amount to add/subtract (negative for subtraction)
 * @returns {Promise<number>} - New balance
 */
async function updateUserBalance(userId, amount) {
  try {
    // Get current user data
    const userData = await getUserData(userId);
    
    // Calculate new balance
    const currentBalance = userData.saldo || 0;
    const newBalance = currentBalance + amount;
    
    // Update in database
    const userRef = ref(database, `users/${userId}`);
    await update(userRef, {
      saldo: newBalance
    });
    
    return newBalance;
  } catch (error) {
    console.error('Error updating user balance:', error);
    throw error;
  }
}

/**
 * Checks if a command is in cooldown for a user
 * @param {string} userId - Discord user ID
 * @param {string} command - Command name
 * @param {number} cooldownMs - Cooldown time in milliseconds
 * @returns {Promise<{emCooldown: boolean, tempoRestante: number}>}
 */
async function checkCooldown(userId, command, cooldownMs) {
  try {
    const userRef = ref(database, `users/${userId}/cooldowns/${command}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const lastUsed = snapshot.val();
      const now = Date.now();
      const timeElapsed = now - lastUsed;
      
      if (timeElapsed < cooldownMs) {
        return {
          emCooldown: true,
          tempoRestante: cooldownMs - timeElapsed
        };
      }
    }
    
    return {
      emCooldown: false,
      tempoRestante: 0
    };
  } catch (error) {
    console.error('Error checking cooldown:', error);
    return {
      emCooldown: false,
      tempoRestante: 0
    };
  }
}

/**
 * Sets a cooldown for a command
 * @param {string} userId - Discord user ID
 * @param {string} command - Command name
 * @returns {Promise<boolean>} - True if successful
 */
async function setCooldown(userId, command) {
  try {
    const userRef = ref(database, `users/${userId}/cooldowns/${command}`);
    await set(userRef, Date.now());
    
    return true;
  } catch (error) {
    console.error('Error setting cooldown:', error);
    return false;
  }
}

// Function to get top users
async function getTopUsers(limit = 10, page = 1) {
  try {
    const database = getDatabase();
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    // Convert to array and sort by balance (descending)
    let users = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      users.push({
        userId: userData.userId || childSnapshot.key,
        saldo: userData.saldo || 0
      });
    });
    
    // Sort by balance (descending)
    users.sort((a, b) => b.saldo - a.saldo);
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const pageUsers = users.slice(skip, skip + limit);
    
    return pageUsers;
  } catch (error) {
    console.error('Error getting top users:', error);
    return [];
  }
}

// Function to count users
async function getTotalUsersCount() {
  try {
    const database = getDatabase();
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    let count = 0;
    snapshot.forEach(() => count++);
    
    return count;
  } catch (error) {
    console.error('Error counting users:', error);
    return 0;
  }
}

// Function to get user ranking
async function getUserRanking(userId) {
  try {
    const database = getDatabase();
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const userData = snapshot.val();
    
    // Get all users and rank them
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    
    if (!usersSnapshot.exists()) {
      return null;
    }
    
    let users = [];
    usersSnapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      users.push({
        userId: user.userId || childSnapshot.key,
        saldo: user.saldo || 0
      });
    });
    
    users.sort((a, b) => b.saldo - a.saldo);
    
    // Find user position
    const position = users.findIndex(user => user.userId === userId) + 1;
    
    if (position === 0) {
      return null;
    }
    
    return {
      position,
      saldo: userData.saldo || 0
    };
  } catch (error) {
    console.error('Error getting user ranking:', error);
    return null;
  }
}

// Export all functions as named exports and as default object
export {
  getUserData,
  updateUserBalance,
  checkCooldown,
  setCooldown,
  getTopUsers,
  getTotalUsersCount,
  getUserRanking
};

// Also export as default for existing imports
export default {
  getUserData,
  updateUserBalance,
  checkCooldown,
  setCooldown,
  getTopUsers,
  getTotalUsersCount,
  getUserRanking
};