import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import { getDatabase, ref, get, set, update, push } from "firebase/database";
import firebaseService from "../services/firebase.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";
import schedule from 'node-schedule';

// Configurações do banco
const BANK_CONFIG = {
  WITHDRAW_COOLDOWN: 3600000, // 1 hora em milissegundos
  MIN_DEPOSIT: 100, // Depósito mínimo
  MAX_DEPOSIT_PERCENTAGE: 0.90, // Máximo de 90% do saldo pode ser depositado
  DAILY_FEE_PERCENTAGE: 0.015, // 1.5% de taxa diária
  DAILY_FEE_HOUR: 6, // Hora do dia para cobrar a taxa (6:00 AM)
};

export const data = new SlashCommandBuilder()
  .setName("banco")
  .setDescription("Sistema bancário - guarde seu dinheiro com segurança")
  .addSubcommand(subcommand => 
    subcommand
      .setName("criar")
      .setDescription("Crie uma conta bancária para guardar seu dinheiro com segurança")
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName("saldo")
      .setDescription("Verifique seu saldo bancário")
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName("depositar")
      .setDescription("Deposite dinheiro na sua conta bancária")
      .addIntegerOption(option => 
        option
          .setName("valor")
          .setDescription("Valor a ser depositado")
          .setRequired(true)
          .setMinValue(BANK_CONFIG.MIN_DEPOSIT)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName("sacar")
      .setDescription("Saque dinheiro da sua conta bancária (sujeito a cooldown)")
      .addIntegerOption(option => 
        option
          .setName("valor")
          .setDescription("Valor a ser sacado")
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName("historico")
      .setDescription("Consulte o histórico de transações da sua conta bancária")
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName("depositos")
      .setDescription("Consulte seus depósitos e seus respectivos cooldowns")
  );

// Adicione este código onde você configura seu node-schedule
import { getDatabase, ref, get, set } from "firebase/database";

// Função para garantir que apenas uma instância do schedule execute a tarefa
async function runScheduledTaskWithLock(taskName, taskFunction) {
  const database = getDatabase();
  const lockRef = ref(database, `system/scheduleLocks/${taskName}`);
  
  try {
    // Verificar se já existe um lock
    const snapshot = await get(lockRef);
    const now = Date.now();
    
    if (snapshot.exists()) {
      const lockData = snapshot.val();
      
      // Se o lock existir mas tiver expirado (30 minutos), podemos adquirir novamente
      if (now - lockData.timestamp > 30 * 60 * 1000) {
        console.log(`Lock expirado para ${taskName}, adquirindo novo lock`);
      } else {
        console.log(`Tarefa ${taskName} já está sendo executada por outra instância`);
        return;
      }
    }
    
    // Adquirir o lock
    await set(lockRef, { 
      timestamp: now,
      instance: process.env.FLY_ALLOC_ID || 'local' // Identificador da instância
    });
    
    console.log(`Lock adquirido para tarefa ${taskName}`);
    
    // Executar a função
    await taskFunction();
    
    // Liberar o lock após conclusão
    await set(lockRef, null);
    console.log(`Lock liberado para tarefa ${taskName}`);
    
  } catch (error) {
    console.error(`Erro ao executar tarefa agendada ${taskName}:`, error);
    // Ainda tentamos liberar o lock em caso de erro
    try {
      await set(lockRef, null);
    } catch (unlockError) {
      console.error(`Erro ao liberar lock para ${taskName}:`, unlockError);
    }
  }
}

// Use esta função no seu schedule
// Por exemplo, para a cobrança de taxa bancária:
schedule.scheduleJob(`0 ${BANK_CONFIG.DAILY_FEE_HOUR} * * *`, function() {
  console.log("[BANCO] Iniciando cobrança da taxa diária...");
  runScheduledTaskWithLock('bankDailyFee', chargeDailyFee);
});

/**
 * Cobra a taxa diária de todas as contas bancárias
 */
async function chargeDailyFee() {
  try {
    const database = getDatabase();
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return;
    }
    
    const users = snapshot.val();
    const now = Date.now();
    const feeDate = new Date();
    feeDate.setHours(BANK_CONFIG.DAILY_FEE_HOUR, 0, 0, 0);
    
    // Para cada usuário com conta bancária
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.bank && userData.bank.balance > 0) {
        const bank = userData.bank;
        const feeAmount = Math.floor(bank.balance * BANK_CONFIG.DAILY_FEE_PERCENTAGE);
        
        if (feeAmount > 0) {
          // Atualizar saldo bancário
          const newBalance = bank.balance - feeAmount;
          const bankRef = ref(database, `users/${userId}/bank`);
          await update(bankRef, { 
            balance: newBalance,
            lastFeeCharge: now
          });
          
          // Registrar transação
          await registerTransaction(userId, "TAXA", `Taxa diária de manutenção (${(BANK_CONFIG.DAILY_FEE_PERCENTAGE * 100).toFixed(1)}%)`, feeAmount);
          
          console.log(`[BANCO] Taxa cobrada do usuário ${userId}: ${feeAmount}`);
        }
      }
    }
  } catch (error) {
    console.error("Erro ao cobrar taxa diária:", error);
  }
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply();

  try {
    switch (subcommand) {
      case "criar":
        await handleCreateAccount(interaction, userId);
        break;
      case "saldo":
        await handleCheckBalance(interaction, userId);
        break;
      case "depositar":
        await handleDeposit(interaction, userId);
        break;
      case "sacar":
        await handleWithdraw(interaction, userId);
        break;
      case "historico":
        await handleTransactionHistory(interaction, userId);
        break;
      case "depositos":
        await handleDepositsList(interaction, userId);
        break;
    }
  } catch (error) {
    console.error(`Erro no comando banco (${subcommand}):`, error);
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Sistema Bancário",
      mensagem: "Ocorreu um erro ao processar o comando. Tente novamente mais tarde."
    });
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Verifica se o usuário já tem uma conta bancária
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} - Verdadeiro se a conta existir
 */
async function hasBankAccount(userId) {
  const database = getDatabase();
  const bankRef = ref(database, `users/${userId}/bank`);
  const snapshot = await get(bankRef);
  return snapshot.exists();
}

/**
 * Obtém os dados da conta bancária do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>} - Dados da conta ou null se não existir
 */
async function getBankAccount(userId) {
  const database = getDatabase();
  const bankRef = ref(database, `users/${userId}/bank`);
  const snapshot = await get(bankRef);
  
  if (snapshot.exists()) {
    return snapshot.val();
  }
  
  return null;
}

/**
 * Cria uma nova conta bancária para o usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Resultado da criação
 */
async function createBankAccount(userId) {
  try {
    // Verificar se já tem uma conta
    if (await hasBankAccount(userId)) {
      return { success: false, message: "Você já possui uma conta bancária." };
    }
    
    const database = getDatabase();
    const bankRef = ref(database, `users/${userId}/bank`);
    
    // Criar conta com saldo zero
    const bankData = {
      balance: 0,
      lastFeeCharge: 0,
      createdAt: Date.now(),
      deposits: {},
      transactions: {
        [Date.now()]: {
          type: "CRIAÇÃO",
          description: "Conta bancária criada",
          amount: 0,
          timestamp: Date.now()
        }
      }
    };
    
    await set(bankRef, bankData);
    
    return { success: true, account: bankData };
  } catch (error) {
    console.error("Erro ao criar conta bancária:", error);
    return { success: false, message: "Ocorreu um erro ao criar sua conta bancária." };
  }
}

/**
 * Registra uma transação na conta bancária
 * @param {string} userId - ID do usuário
 * @param {string} type - Tipo da transação (DEPÓSITO, SAQUE, TAXA)
 * @param {string} description - Descrição da transação
 * @param {number} amount - Valor da transação
 * @returns {Promise<void>}
 */
async function registerTransaction(userId, type, description, amount) {
  try {
    const database = getDatabase();
    const transactionRef = ref(database, `users/${userId}/bank/transactions/${Date.now()}`);
    
    await set(transactionRef, {
      type,
      description,
      amount,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Erro ao registrar transação:", error);
  }
}

/**
 * Realiza um depósito na conta bancária
 * @param {string} userId - ID do usuário
 * @param {number} amount - Valor a ser depositado
 * @returns {Promise<Object>} - Resultado do depósito
 */
async function depositMoney(userId, amount) {
  try {
    // Verificar se tem uma conta
    if (!await hasBankAccount(userId)) {
      return { success: false, message: "Você não possui uma conta bancária. Use `/banco criar` primeiro." };
    }
    
    // Verificar se o usuário tem saldo suficiente
    const userData = await firebaseService.getUserData(userId);
    if (!userData || userData.saldo < amount) {
      return { 
        success: false, 
        message: `Saldo insuficiente. Você tem ${formatarDinheiro(userData?.saldo || 0)}.` 
      };
    }
    
    // Verificar limite de depósito (90% do saldo)
    const maxDeposit = Math.floor(userData.saldo * BANK_CONFIG.MAX_DEPOSIT_PERCENTAGE);
    if (amount > maxDeposit) {
      return {
        success: false,
        message: `Você só pode depositar até ${formatarDinheiro(maxDeposit)} (90% do seu saldo atual).`
      };
    }
    
    // Obter conta bancária
    const bankAccount = await getBankAccount(userId);
    
    // Atualizar saldos
    const database = getDatabase();
    const bankRef = ref(database, `users/${userId}/bank`);
    
    // Remover do saldo do usuário
    const newWalletBalance = await firebaseService.updateUserBalance(userId, -amount);
    
    // Adicionar à conta bancária
    const newBankBalance = bankAccount.balance + amount;
    
    // Criar registro do depósito com cooldown
    const now = Date.now();
    const depositRef = ref(database, `users/${userId}/bank/deposits`);
    const newDepositRef = push(depositRef);
    
    await set(newDepositRef, {
      amount,
      timestamp: now,
      expiresAt: now + BANK_CONFIG.WITHDRAW_COOLDOWN,
      status: "active" // active, withdrawn, expired
    });
    
    const depositId = newDepositRef.key;
    
    // Atualizar saldo do banco
    await update(bankRef, { balance: newBankBalance });
    
    // Registrar transação
    await registerTransaction(userId, "DEPÓSITO", "Depósito em conta", amount);
    
    return {
      success: true,
      walletBalance: newWalletBalance,
      bankBalance: newBankBalance,
      depositAmount: amount,
      depositId,
      cooldownEnds: now + BANK_CONFIG.WITHDRAW_COOLDOWN
    };
  } catch (error) {
    console.error("Erro ao depositar dinheiro:", error);
    return { success: false, message: "Ocorreu um erro ao processar seu depósito." };
  }
}

/**
 * Obtém a lista de depósitos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Lista de depósitos
 */
async function getDeposits(userId) {
  try {
    const database = getDatabase();
    const depositsRef = ref(database, `users/${userId}/bank/deposits`);
    const snapshot = await get(depositsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const deposits = [];
    const now = Date.now();
    
    // Converter para array e calcular status atual
    snapshot.forEach((child) => {
      const deposit = child.val();
      const id = child.key;
      
      // Atualizar status se estiver expirado
      if (deposit.status === "active" && now >= deposit.expiresAt) {
        deposit.status = "available";
      }
      
      deposits.push({
        id,
        ...deposit
      });
    });
    
    // Ordenar por data (mais recente primeiro)
    deposits.sort((a, b) => b.timestamp - a.timestamp);
    
    return deposits;
  } catch (error) {
    console.error("Erro ao obter depósitos:", error);
    return [];
  }
}

/**
 * Verifica quais depósitos estão disponíveis para saque
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Informações sobre os depósitos disponíveis
 */
async function getAvailableDeposits(userId) {
  const deposits = await getDeposits(userId);
  const now = Date.now();
  
  let availableAmount = 0;
  let nextAvailableTime = Infinity;
  const availableDeposits = [];
  const pendingDeposits = [];
  
  deposits.forEach(deposit => {
    if (deposit.status === "active") {
      if (now >= deposit.expiresAt) {
        // Depósito já disponível
        availableAmount += deposit.amount;
        availableDeposits.push(deposit);
      } else {
        // Depósito em espera
        pendingDeposits.push(deposit);
        nextAvailableTime = Math.min(nextAvailableTime, deposit.expiresAt);
      }
    } else if (deposit.status === "available") {
      // Já está marcado como disponível
      availableAmount += deposit.amount;
      availableDeposits.push(deposit);
    }
  });
  
  return {
    availableAmount,
    availableDeposits,
    pendingDeposits,
    nextAvailableTime: nextAvailableTime !== Infinity ? nextAvailableTime : null,
    hasAvailableFunds: availableAmount > 0
  };
}

/**
 * Realiza um saque da conta bancária
 * @param {string} userId - ID do usuário
 * @param {number} amount - Valor a ser sacado
 * @returns {Promise<Object>} - Resultado do saque
 */
async function withdrawMoney(userId, amount) {
  try {
    // Verificar se tem uma conta
    if (!await hasBankAccount(userId)) {
      return { success: false, message: "Você não possui uma conta bancária. Use `/banco criar` primeiro." };
    }
    
    // Obter conta bancária
    const bankAccount = await getBankAccount(userId);
    
    // Verificar se tem saldo suficiente
    if (bankAccount.balance < amount) {
      return { 
        success: false,
        message: `Saldo bancário insuficiente. Você tem ${formatarDinheiro(bankAccount.balance)} no banco.` 
      };
    }
    
    // Verificar depósitos disponíveis
    const depositInfo = await getAvailableDeposits(userId);
    
    if (amount > depositInfo.availableAmount) {
      // Não tem fundos suficientes disponíveis para saque
      if (depositInfo.nextAvailableTime) {
        const waitTime = Math.ceil((depositInfo.nextAvailableTime - Date.now()) / 60000);
        
        return {
          success: false,
          message: `Você só tem ${formatarDinheiro(depositInfo.availableAmount)} disponíveis para saque. O próximo depósito estará disponível em ${waitTime} minutos.`,
          cooldown: true,
          availableAmount: depositInfo.availableAmount,
          nextAvailableTime: depositInfo.nextAvailableTime
        };
      } else {
        return {
          success: false,
          message: `Você só tem ${formatarDinheiro(depositInfo.availableAmount)} disponíveis para saque.`,
          cooldown: true,
          availableAmount: depositInfo.availableAmount
        };
      }
    }
    
    // Processar o saque
    const database = getDatabase();
    const bankRef = ref(database, `users/${userId}/bank`);
    
    // Adicionar ao saldo do usuário
    const newWalletBalance = await firebaseService.updateUserBalance(userId, amount);
    
    // Remover da conta bancária
    const newBankBalance = bankAccount.balance - amount;
    await update(bankRef, { balance: newBankBalance });
    
    // Atualizar status dos depósitos usados
    let remainingAmount = amount;
    for (const deposit of depositInfo.availableDeposits) {
      if (remainingAmount <= 0) break;
      
      const depositRef = ref(database, `users/${userId}/bank/deposits/${deposit.id}`);
      
      if (deposit.amount <= remainingAmount) {
        // Usar todo o depósito
        await update(depositRef, { status: "withdrawn" });
        remainingAmount -= deposit.amount;
      } else {
        // Usar parte do depósito e criar um novo com o valor restante
        await update(depositRef, { status: "withdrawn" });
        
        const newDepositRef = push(ref(database, `users/${userId}/bank/deposits`));
        await set(newDepositRef, {
          amount: deposit.amount - remainingAmount,
          timestamp: Date.now(),
          expiresAt: 0, // Disponível imediatamente
          status: "available"
        });
        
        remainingAmount = 0;
      }
    }
    
    // Registrar transação
    await registerTransaction(userId, "SAQUE", "Saque da conta", amount);
    
    return {
      success: true,
      walletBalance: newWalletBalance,
      bankBalance: newBankBalance,
      withdrawAmount: amount
    };
  } catch (error) {
    console.error("Erro ao sacar dinheiro:", error);
    return { success: false, message: "Ocorreu um erro ao processar seu saque." };
  }
}

/**
 * Obtém o histórico de transações da conta bancária
 * @param {string} userId - ID do usuário
 * @param {number} limit - Limite de transações a retornar
 * @returns {Promise<Array>} - Lista de transações ordenadas por data
 */
async function getTransactionHistory(userId, limit = 10) {
  try {
    // Verificar se tem uma conta
    if (!await hasBankAccount(userId)) {
      return [];
    }
    
    // Obter conta bancária
    const bankAccount = await getBankAccount(userId);
    
    if (!bankAccount.transactions) {
      return [];
    }
    
    // Converter objeto de transações para array
    const transactions = Object.entries(bankAccount.transactions).map(([key, transaction]) => ({
      id: key,
      ...transaction
    }));
    
    // Ordenar por data (mais recente primeiro)
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    // Aplicar limite
    return transactions.slice(0, limit);
  } catch (error) {
    console.error("Erro ao obter histórico de transações:", error);
    return [];
  }
}

/**
 * Manipula o subcomando para criar uma conta bancária
 */
async function handleCreateAccount(interaction, userId) {
  const result = await createBankAccount(userId);
  
  if (result.success) {
    const embed = new EmbedBuilder()
      .setColor(0x4CAF50) // Verde
      .setTitle("🏦 Conta Bancária Criada")
      .setDescription("Sua conta bancária foi criada com sucesso! Agora você pode depositar seu dinheiro com segurança.")
      .addFields(
        { name: "💰 Saldo Atual", value: formatarDinheiro(0), inline: true },
        { 
          name: "ℹ️ Informações", 
          value: "Use `/banco depositar` para guardar seu dinheiro e `/banco sacar` quando precisar retirar.", 
          inline: false 
        },
        {
          name: "⏳ Cooldown de Depósitos",
          value: `Cada depósito ficará indisponível para saque por ${BANK_CONFIG.WITHDRAW_COOLDOWN / 60000} minutos após ser realizado.`,
          inline: false
        },
        {
          name: "💸 Taxa Diária",
          value: `Será cobrada uma taxa de manutenção de ${(BANK_CONFIG.DAILY_FEE_PERCENTAGE * 100).toFixed(1)}% do seu saldo todos os dias às ${BANK_CONFIG.DAILY_FEE_HOUR}:00.`,
          inline: false
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Conta criada por ${interaction.user.username}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro ao Criar Conta",
      mensagem: result.message
    });
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Manipula o subcomando para verificar o saldo bancário
 */
async function handleCheckBalance(interaction, userId) {
  if (!await hasBankAccount(userId)) {
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Sem Conta Bancária",
      mensagem: "Você não possui uma conta bancária. Use `/banco criar` para abrir uma conta."
    });
    
    return interaction.editReply({ embeds: [errorEmbed] });
  }
  
  const bankAccount = await getBankAccount(userId);
  const userData = await firebaseService.getUserData(userId);
  const depositInfo = await getAvailableDeposits(userId);
  
  // Calcular próxima cobrança de taxa
  const nextFeeDate = new Date();
  nextFeeDate.setHours(BANK_CONFIG.DAILY_FEE_HOUR, 0, 0, 0);
  if (nextFeeDate.getTime() < Date.now()) {
    nextFeeDate.setDate(nextFeeDate.getDate() + 1);
  }
  
  const nextFeeAmount = Math.floor(bankAccount.balance * BANK_CONFIG.DAILY_FEE_PERCENTAGE);
  
  // Criar data formatada de criação da conta
  const creationDate = new Date(bankAccount.createdAt);
  const formattedCreationDate = `${creationDate.toLocaleDateString('pt-BR')} às ${creationDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  
  // Formatar próxima data de taxa
  const formattedFeeDate = `${nextFeeDate.toLocaleDateString('pt-BR')} às ${BANK_CONFIG.DAILY_FEE_HOUR}:00`;
  
  const embed = new EmbedBuilder()
    .setColor(0x2196F3) // Azul
    .setTitle("🏦 Informações Bancárias")
    .setDescription(`Bem-vindo ao seu gerenciamento bancário, ${interaction.user.username}!`)
    .addFields(
      { name: "💰 Saldo Bancário", value: formatarDinheiro(bankAccount.balance), inline: true },
      { name: "👛 Saldo na Carteira", value: formatarDinheiro(userData.saldo || 0), inline: true },
      { name: "🏛️ Patrimônio Total", value: formatarDinheiro((userData.saldo || 0) + bankAccount.balance), inline: true },
      { 
        name: "🔓 Disponível para Saque", 
        value: formatarDinheiro(depositInfo.availableAmount), 
        inline: true 
      },
      {
        name: "⏳ Taxa Diária", 
        value: `${(BANK_CONFIG.DAILY_FEE_PERCENTAGE * 100).toFixed(1)}% (${formatarDinheiro(nextFeeAmount)}) em ${formattedFeeDate}`,
        inline: true
      },
      { name: "📅 Conta Criada em", value: formattedCreationDate, inline: true }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `Use /banco depositar ou /banco sacar para movimentar seu dinheiro` })
    .setTimestamp();
  
  // Adicionar botões para operações rápidas
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("bank_deposit")
        .setLabel("Depositar")
        .setStyle(ButtonStyle.Success)
        .setEmoji("💰"),
      new ButtonBuilder()
        .setCustomId("bank_withdraw")
        .setLabel("Sacar")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💸")
        .setDisabled(!depositInfo.hasAvailableFunds),
      new ButtonBuilder()
        .setCustomId("bank_deposits")
        .setLabel("Meus Depósitos")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📋"),
      new ButtonBuilder()
        .setCustomId("bank_history")
        .setLabel("Histórico")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📜")
    );
  
  const response = await interaction.editReply({ embeds: [embed], components: [row] });
  
  // Criar coletor para os botões
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000 // 1 minuto
  });
  
  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      return i.reply({ content: "Você não pode usar estes botões.", ephemeral: true });
    }
    
    // Parar o coletor para evitar interações duplicadas
    collector.stop();
    
    if (i.customId === "bank_deposit") {
      await i.update({ content: "Para depositar, use o comando `/banco depositar valor:<quantia>`", components: [], embeds: [embed] });
    } else if (i.customId === "bank_withdraw") {
      await i.update({ content: "Para sacar, use o comando `/banco sacar valor:<quantia>`", components: [], embeds: [embed] });
    } else if (i.customId === "bank_deposits") {
      await i.deferUpdate();
      await handleDepositsList(interaction, userId, true);
    } else if (i.customId === "bank_history") {
      await i.deferUpdate();
      await handleTransactionHistory(interaction, userId, true);
    }
  });
  
  collector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      // Tempo expirou sem interações - remover componentes
      await interaction.editReply({ components: [] });
    }
  });
}

/**
 * Manipula o subcomando para listar os depósitos
 */
async function handleDepositsList(interaction, userId, isUpdate = false) {
  if (!await hasBankAccount(userId)) {
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Sem Conta Bancária",
      mensagem: "Você não possui uma conta bancária. Use `/banco criar` para abrir uma conta."
    });
    
    if (isUpdate) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
    return;
  }
  
  const deposits = await getDeposits(userId);
  const bankAccount = await getBankAccount(userId);
  
  if (deposits.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x9E9E9E) // Cinza
      .setTitle("📋 Depósitos Bancários")
      .setDescription("Você ainda não realizou nenhum depósito em sua conta bancária.")
      .addFields(
        { name: "💰 Saldo Atual", value: formatarDinheiro(bankAccount.balance), inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();
    
    if (isUpdate) {
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
    return;
  }
  
  // Agrupar depósitos por status
  const now = Date.now();
  
  const activeDeposits = [];
  const availableDeposits = [];
  const withdrawnDeposits = [];
  
  deposits.forEach(deposit => {
    const status = deposit.status;
    const cooldownEnded = now >= deposit.expiresAt;
    
    if (status === "active" && !cooldownEnded) {
      activeDeposits.push(deposit);
    } else if ((status === "active" && cooldownEnded) || status === "available") {
      availableDeposits.push(deposit);
    } else if (status === "withdrawn") {
      withdrawnDeposits.push(deposit);
    }
  });
  
  // Limitar quantidade para não ficar muito grande
  const showActiveDeposits = activeDeposits.slice(0, 5);
  const showAvailableDeposits = availableDeposits.slice(0, 5);
  const showWithdrawnDeposits = withdrawnDeposits.slice(0, 3);
  
  // Formatar cada grupo de depósitos
  let activeDepositsText = "Nenhum depósito em período de espera.";
  let availableDepositsText = "Nenhum depósito disponível para saque.";
  let withdrawnDepositsText = "Nenhum depósito foi sacado recentemente.";
  
  if (showActiveDeposits.length > 0) {
    activeDepositsText = showActiveDeposits.map((deposit, index) => {
      const date = new Date(deposit.timestamp);
      const formattedDate = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const remainingTime = Math.ceil((deposit.expiresAt - now) / 60000);
      
      return `${index + 1}. **${formatarDinheiro(deposit.amount)}** - Disponível em **${remainingTime} min** (Depositado: ${formattedDate})`;
    }).join("\n");
    
    if (activeDeposits.length > 5) {
      activeDepositsText += `\n... e mais ${activeDeposits.length - 5} depósitos em espera.`;
    }
  }
  
  if (showAvailableDeposits.length > 0) {
    availableDepositsText = showAvailableDeposits.map((deposit, index) => {
      const date = new Date(deposit.timestamp);
      const formattedDate = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      
      return `${index + 1}. **${formatarDinheiro(deposit.amount)}** - Depositado: ${formattedDate}`;
    }).join("\n");
    
    if (availableDeposits.length > 5) {
      availableDepositsText += `\n... e mais ${availableDeposits.length - 5} depósitos disponíveis.`;
    }
  }
  
  if (showWithdrawnDeposits.length > 0) {
    withdrawnDepositsText = showWithdrawnDeposits.map((deposit, index) => {
      const date = new Date(deposit.timestamp);
      const formattedDate = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      
      return `${index + 1}. **${formatarDinheiro(deposit.amount)}** - Depositado: ${formattedDate}`;
    }).join("\n");
    
    if (withdrawnDeposits.length > 3) {
      withdrawnDepositsText += `\n... e mais ${withdrawnDeposits.length - 3} depósitos sacados.`;
    }
  }
  
  // Calcular totais
  const totalActive = activeDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  const totalAvailable = availableDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  
  const embed = new EmbedBuilder()
    .setColor(0x673AB7) // Roxo
    .setTitle("📋 Seus Depósitos Bancários")
    .setDescription(`Visão geral dos seus depósitos. Você pode sacar imediatamente até **${formatarDinheiro(totalAvailable)}**.`)
    .addFields(
      { name: "💰 Saldo Bancário Total", value: formatarDinheiro(bankAccount.balance), inline: true },
      { name: "🔓 Disponível para Saque", value: formatarDinheiro(totalAvailable), inline: true },
      { name: "⏳ Em Período de Espera", value: formatarDinheiro(totalActive), inline: true },
      { name: "⏳ Depósitos em Espera", value: activeDepositsText, inline: false },
      { name: "✅ Depósitos Disponíveis", value: availableDepositsText, inline: false },
      { name: "💸 Depósitos Sacados (Recentes)", value: withdrawnDepositsText, inline: false }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `Use /banco sacar para retirar seu dinheiro disponível` })
    .setTimestamp();
  
  if (isUpdate) {
    await interaction.editReply({ embeds: [embed], components: [] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Manipula o subcomando para depositar dinheiro no banco
 */
async function handleDeposit(interaction, userId) {
  const amount = interaction.options.getInteger("valor");
  
  const result = await depositMoney(userId, amount);
  
  if (result.success) {
    // Calcular quando o depósito estará disponível
    const availableDate = new Date(result.cooldownEnds);
    const formattedAvailableDate = `${availableDate.toLocaleDateString('pt-BR')} às ${availableDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    const embed = new EmbedBuilder()
      .setColor(0x4CAF50) // Verde
      .setTitle("💰 Depósito Realizado")
      .setDescription(`Você depositou **${formatarDinheiro(result.depositAmount)}** em sua conta bancária.`)
      .addFields(
        { name: "🏦 Saldo Bancário", value: formatarDinheiro(result.bankBalance), inline: true },
        { name: "👛 Saldo na Carteira", value: formatarDinheiro(result.walletBalance), inline: true },
        { 
          name: "⏳ Período de Espera", 
          value: `Este depósito estará disponível para saque em **${formattedAvailableDate}** (${BANK_CONFIG.WITHDRAW_COOLDOWN / 60000} minutos).`, 
          inline: false 
        },
        {
          name: "💸 Taxa Diária",
          value: `Lembre-se: uma taxa de ${(BANK_CONFIG.DAILY_FEE_PERCENTAGE * 100).toFixed(1)}% será cobrada todos os dias às ${BANK_CONFIG.DAILY_FEE_HOUR}:00.`,
          inline: false
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Depósito realizado por ${interaction.user.username}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro ao Depositar",
      mensagem: result.message
    });
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Manipula o subcomando para sacar dinheiro do banco
 */
async function handleWithdraw(interaction, userId) {
  const amount = interaction.options.getInteger("valor");
  
  const result = await withdrawMoney(userId, amount);
  
  if (result.success) {
    const embed = new EmbedBuilder()
      .setColor(0x2196F3) // Azul
      .setTitle("💸 Saque Realizado")
      .setDescription(`Você sacou **${formatarDinheiro(result.withdrawAmount)}** de sua conta bancária.`)
      .addFields(
        { name: "🏦 Saldo Bancário", value: formatarDinheiro(result.bankBalance), inline: true },
        { name: "👛 Saldo na Carteira", value: formatarDinheiro(result.walletBalance), inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Saque realizado por ${interaction.user.username}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    // Se estiver em cooldown, mostrar um embed específico com informações sobre disponibilidade
    if (result.cooldown) {
      let description = `Você não tem fundos suficientes disponíveis para este saque.`;
      
      if (result.nextAvailableTime) {
        const nextAvailableDate = new Date(result.nextAvailableTime);
        const formattedNextAvailable = `${nextAvailableDate.toLocaleDateString('pt-BR')} às ${nextAvailableDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        
        description += `\n\nSeu próximo depósito estará disponível em **${formattedNextAvailable}**.`;
      }
      
      const cooldownEmbed = new EmbedBuilder()
        .setColor(0xFFC107) // Amarelo
        .setTitle("⏳ Fundos em Período de Espera")
        .setDescription(description)
        .addFields(
          { name: "💰 Valor Solicitado", value: formatarDinheiro(amount), inline: true },
          { name: "🔓 Disponível para Saque", value: formatarDinheiro(result.availableAmount), inline: true },
          { 
            name: "ℹ️ Como funciona?", 
            value: "Cada depósito tem um período de espera de 1 hora antes de ficar disponível para saque. Use `/banco depositos` para ver detalhes.", 
            inline: false 
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [cooldownEmbed] });
    } else {
      // Erro genérico
      const errorEmbed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Erro ao Sacar",
        mensagem: result.message
      });
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}

/**
 * Manipula o subcomando para verificar o histórico de transações
 */
async function handleTransactionHistory(interaction, userId, isUpdate = false) {
  if (!await hasBankAccount(userId)) {
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Sem Conta Bancária",
      mensagem: "Você não possui uma conta bancária. Use `/banco criar` para abrir uma conta."
    });
    
    if (isUpdate) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
    return;
  }
  
  const transactions = await getTransactionHistory(userId);
  const bankAccount = await getBankAccount(userId);
  
  if (transactions.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x9E9E9E) // Cinza
      .setTitle("📜 Histórico Bancário")
      .setDescription("Você ainda não realizou nenhuma transação além da criação da conta.")
      .addFields(
        { name: "💰 Saldo Atual", value: formatarDinheiro(bankAccount.balance), inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Histórico solicitado por ${interaction.user.username}` })
      .setTimestamp();
    
    if (isUpdate) {
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
    return;
  }
  
  // Formatar transações para exibição
  const transactionList = transactions.map((transaction, index) => {
    const date = new Date(transaction.timestamp);
    const formattedDate = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    let emoji;
    switch (transaction.type) {
      case "DEPÓSITO": emoji = "⬇️"; break;
      case "SAQUE": emoji = "⬆️"; break;
      case "TAXA": emoji = "💸"; break;
      default: emoji = "🔄"; break;
    }
    
    const amount = transaction.type === "CRIAÇÃO" ? "" : formatarDinheiro(transaction.amount);
    
    return `${index + 1}. ${emoji} **${transaction.type}**: ${amount} - ${formattedDate}`;
  }).join("\n");
  
  const embed = new EmbedBuilder()
    .setColor(0x673AB7) // Roxo
    .setTitle("📜 Histórico de Transações Bancárias")
    .setDescription(`Últimas ${transactions.length} transações da sua conta bancária:`)
    .addFields(
      { name: "💰 Saldo Atual", value: formatarDinheiro(bankAccount.balance), inline: true },
      { name: "📝 Histórico", value: transactionList, inline: false }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `Histórico solicitado por ${interaction.user.username}` })
    .setTimestamp();
  
  if (isUpdate) {
    await interaction.editReply({ embeds: [embed], components: [] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}