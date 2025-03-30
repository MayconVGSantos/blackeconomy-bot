// Função corrigida para obter o ranking de usuários
async function getTopUsers(limit = 10, page = 1) {
  try {
    const database = getDatabase();
    const usersRef = ref(database, 'users');
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
        saldo: userData.saldo || 0
      });
    });
    
    // Ordenar por saldo (decrescente)
    users.sort((a, b) => b.saldo - a.saldo);
    
    // Aplicar paginação
    const skip = (page - 1) * limit;
    const pageUsers = users.slice(skip, skip + limit);
    
    return pageUsers;
  } catch (error) {
    console.error('Erro ao obter ranking de usuários:', error);
    return [];
  }
}

// Função corrigida para contar usuários
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
    console.error('Erro ao contar usuários:', error);
    return 0;
  }
}

// Função corrigida para obter posição do usuário no ranking
async function getUserRanking(userId) {
  try {
    const database = getDatabase();
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const userData = snapshot.val();
    
    // Obter todos os usuários e classificá-los
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
    
    // Encontrar a posição do usuário
    const position = users.findIndex(user => user.userId === userId) + 1;
    
    if (position === 0) {
      return null;
    }
    
    return {
      position,
      saldo: userData.saldo || 0
    };
  } catch (error) {
    console.error('Erro ao obter posição do usuário no ranking:', error);
    return null;
  }
}