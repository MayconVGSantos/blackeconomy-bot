import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import { getDatabase, ref, get, set, update } from "firebase/database";
import firebaseService from "../services/firebase.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

// Configurações do banco
const BANK_CONFIG = {
  WITHDRAW_COOLDOWN: 3600000, // 1 hora em milissegundos
  MIN_DEPOSIT: 100, // Depósito mínimo
  MAX_DEPOSIT_PERCENTAGE: 0.90 // Máximo de 90% do saldo pode ser depositado
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
  );

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
      lastWithdraw: 0,
      createdAt: Date.now(),
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
 * @param {string} type - Tipo da transação (DEPÓSITO, SAQUE)
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
    await update(bankRef, { balance: newBankBalance });
    
    // Registrar transação
    await registerTransaction(userId, "DEPÓSITO", "Depósito em conta", amount);
    
    return {
      success: true,
      walletBalance: newWalletBalance,
      bankBalance: newBankBalance,
      depositAmount: amount
    };
  } catch (error) {
    console.error("Erro ao depositar dinheiro:", error);
    return { success: false, message: "Ocorreu um erro ao processar seu depósito." };
  }
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
    
    // Verificar cooldown
    const now = Date.now();
    const lastWithdraw = bankAccount.lastWithdraw || 0;
    const timeElapsed = now - lastWithdraw;
    
    if (timeElapsed < BANK_CONFIG.WITHDRAW_COOLDOWN && lastWithdraw !== 0) {
      const timeRemaining = BANK_CONFIG.WITHDRAW_COOLDOWN - timeElapsed;
      const minutes = Math.ceil(timeRemaining / 60000);
      
      return {
        success: false,
        message: `Você precisa esperar ${minutes} minutos para fazer outro saque.`,
        cooldown: true,
        timeRemaining
      };
    }
    
    // Atualizar saldos
    const database = getDatabase();
    const bankRef = ref(database, `users/${userId}/bank`);
    
    // Adicionar ao saldo do usuário
    const newWalletBalance = await firebaseService.updateUserBalance(userId, amount);
    
    // Remover da conta bancária
    const newBankBalance = bankAccount.balance - amount;
    await update(bankRef, { 
      balance: newBankBalance,
      lastWithdraw: now
    });
    
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
          name: "⚠️ Aviso de Cooldown",
          value: `Após cada saque, você precisará esperar ${BANK_CONFIG.WITHDRAW_COOLDOWN / 60000} minutos para sacar novamente.`,
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
  
  // Verificar status do cooldown
  const now = Date.now();
  const lastWithdraw = bankAccount.lastWithdraw || 0;
  const timeElapsed = now - lastWithdraw;
  const inCooldown = timeElapsed < BANK_CONFIG.WITHDRAW_COOLDOWN && lastWithdraw !== 0;
  
  let cooldownStatus;
  if (inCooldown) {
    const timeRemaining = BANK_CONFIG.WITHDRAW_COOLDOWN - timeElapsed;
    const minutes = Math.ceil(timeRemaining / 60000);
    cooldownStatus = `⏳ Cooldown ativo: ${minutes} minutos restantes para sacar`;
  } else {
    cooldownStatus = "✅ Pronto para sacar";
  }
  
  // Criar data formatada de criação da conta
  const creationDate = new Date(bankAccount.createdAt);
  const formattedCreationDate = `${creationDate.toLocaleDateString('pt-BR')} às ${creationDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  
  const embed = new EmbedBuilder()
    .setColor(0x2196F3) // Azul
    .setTitle("🏦 Informações Bancárias")
    .setDescription(`Bem-vindo ao seu gerenciamento bancário, ${interaction.user.username}!`)
    .addFields(
      { name: "💰 Saldo Bancário", value: formatarDinheiro(bankAccount.balance), inline: true },
      { name: "👛 Saldo na Carteira", value: formatarDinheiro(userData.saldo || 0), inline: true },
      { name: "🏛️ Patrimônio Total", value: formatarDinheiro((userData.saldo || 0) + bankAccount.balance), inline: true },
      { name: "⏱️ Status de Saque", value: cooldownStatus, inline: false },
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
        .setDisabled(inCooldown),
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
 * Manipula o subcomando para depositar dinheiro no banco
 */
async function handleDeposit(interaction, userId) {
  const amount = interaction.options.getInteger("valor");
  
  const result = await depositMoney(userId, amount);
  
  if (result.success) {
    const embed = new EmbedBuilder()
      .setColor(0x4CAF50) // Verde
      .setTitle("💰 Depósito Realizado")
      .setDescription(`Você depositou **${formatarDinheiro(result.depositAmount)}** em sua conta bancária.`)
      .addFields(
        { name: "🏦 Saldo Bancário", value: formatarDinheiro(result.bankBalance), inline: true },
        { name: "👛 Saldo na Carteira", value: formatarDinheiro(result.walletBalance), inline: true },
        { 
          name: "ℹ️ Informações", 
          value: "Seu dinheiro está seguro no banco e pode ser sacado quando necessário.", 
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
        { name: "👛 Saldo na Carteira", value: formatarDinheiro(result.walletBalance), inline: true },
        { 
          name: "⏳ Cooldown de Saque", 
          value: `Você precisará esperar ${BANK_CONFIG.WITHDRAW_COOLDOWN / 60000} minutos para sacar novamente.`, 
          inline: false 
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Saque realizado por ${interaction.user.username}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    // Se estiver em cooldown, mostrar um embed específico com temporizador
    if (result.cooldown) {
      const minutes = Math.ceil(result.timeRemaining / 60000);
      
      const cooldownEmbed = new EmbedBuilder()
        .setColor(0xFFC107) // Amarelo
        .setTitle("⏳ Cooldown de Saque Ativo")
        .setDescription(`Você precisa esperar **${minutes} minutos** antes de fazer outro saque.`)
        .addFields(
          { 
            name: "ℹ️ Por que existe um cooldown?", 
            value: "O período de espera entre saques protege seu dinheiro contra acesso não autorizado e estimula um planejamento financeiro melhor.", 
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
    const emoji = transaction.type === "DEPÓSITO" ? "⬇️" : transaction.type === "SAQUE" ? "⬆️" : "🔄";
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