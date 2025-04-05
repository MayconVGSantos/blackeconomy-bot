import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import businessService from "../services/business.js";
import embedUtils from "../utils/embed.js";
import { formatarDinheiro } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("empresa")
  .setDescription("Sistema de empresas - ganhe dinheiro passivamente")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("criar")
      .setDescription("Crie uma empresa para ganhar dinheiro passivamente")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("coletar")
      .setDescription("Colete os lucros da sua empresa")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Veja informações sobre sua empresa")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("melhorar")
      .setDescription("Melhore sua empresa para aumentar os lucros")
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply();

  try {
    switch (subcommand) {
      case "criar":
        await handleCreateBusiness(interaction, userId);
        break;
      case "coletar":
        await handleCollectProfit(interaction, userId);
        break;
      case "info":
        await handleBusinessInfo(interaction, userId);
        break;
      case "melhorar":
        await handleUpgradeBusiness(interaction, userId);
        break;
    }
  } catch (error) {
    console.error(`Erro no comando empresa (${subcommand}):`, error);
    const errorEmbed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Sistema de Empresas",
      mensagem: "Ocorreu um erro ao processar o comando. Tente novamente mais tarde."
    });
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Manipula o subcomando de criação de empresa
 */
async function handleCreateBusiness(interaction, userId) {
  // Verificar se já tem uma empresa
  const businessInfo = await businessService.getBusinessInfo(userId);
  
  if (businessInfo.hasBusiness) {
    const embed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Você já tem uma empresa",
      mensagem: `Você já possui uma ${businessInfo.name} nível ${businessInfo.level}. Use \`/empresa info\` para mais detalhes.`
    });
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Criar embed com opções de empresas
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle("🏢 Criar Uma Empresa")
    .setDescription("Escolha o tipo de empresa que deseja criar. Cada empresa tem diferentes custos e lucros.")
    .setFooter({ text: "Empresas geram lucros passivamente que podem ser coletados regularmente." });

  // Criar menu de seleção
  const options = [];
  for (const [id, data] of Object.entries(businessService.BUSINESS_TYPES)) {
    options.push({
      label: data.name,
      description: `Custo: R$${data.cost.toLocaleString()} | Lucro: R$${data.profit.toLocaleString()} a cada ${data.interval / 60000} minutos`,
      value: id
    });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_business_type")
      .setPlaceholder("Selecione um tipo de empresa")
      .addOptions(options)
  );
  
  const response = await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
  
  // Criar coletor para resposta
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000 // 1 minuto
  });
  
  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      return i.reply({ content: "Você não pode usar esta interação.", ephemeral: true });
    }
    
    await i.deferUpdate();
    const selectedType = i.values[0];
    const businessType = businessService.BUSINESS_TYPES[selectedType];
    
    // Confirmar criação
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Confirmar criação: ${businessType.name}`)
      .setDescription(`Você está prestes a criar uma **${businessType.name}** por **${formatarDinheiro(businessType.cost)}**`)
      .addFields(
        { name: "💰 Custo", value: formatarDinheiro(businessType.cost), inline: true },
        { name: "💵 Lucro", value: `${formatarDinheiro(businessType.profit)} a cada ${businessType.interval / 60000} minutos`, inline: true },
        { name: "ℹ️ Descrição", value: businessType.description }
      );
    
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_business_create")
        .setLabel("Confirmar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancel_business_create")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Danger)
    );
    
    const confirmResponse = await i.editReply({
      embeds: [confirmEmbed],
      components: [confirmRow]
    });
    
    // Novo coletor para os botões
    const buttonCollector = confirmResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000 // 30 segundos
    });
    
    buttonCollector.on("collect", async (btn) => {
      if (btn.user.id !== userId) {
        return btn.reply({ content: "Você não pode usar esta interação.", ephemeral: true });
      }
      
      await btn.deferUpdate();
      
      if (btn.customId === "confirm_business_create") {
        // Criar empresa
        const result = await businessService.createBusiness(userId, selectedType);
        
        if (result.success) {
          const successEmbed = embedUtils.criarEmbedEconomia({
            usuario: interaction.user.username,
            avatarURL: interaction.user.displayAvatarURL(),
            conteudo: `Você criou uma **${result.business.name}** com sucesso! Use \`/empresa coletar\` regularmente para receber seus lucros.`,
            valor: -businessType.cost,
            novoSaldo: result.newBalance,
            ganhou: false,
            comando: "empresa"
          });
          
          await btn.editReply({
            embeds: [successEmbed],
            components: []
          });
        } else {
          const errorEmbed = embedUtils.criarEmbedErro({
            usuario: interaction.user.username,
            titulo: "Erro ao criar empresa",
            mensagem: result.message
          });
          
          await btn.editReply({
            embeds: [errorEmbed],
            components: []
          });
        }
      } else {
        // Cancelado
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle("Criação Cancelada")
          .setDescription("Você cancelou a criação da empresa.");
        
        await btn.editReply({
          embeds: [cancelEmbed],
          components: []
        });
      }
      
      buttonCollector.stop();
    });
    
    buttonCollector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle("Tempo Esgotado")
          .setDescription("Você não respondeu a tempo. Tente novamente.");
        
        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: []
        });
      }
    });
    
    collector.stop();
  });
  
  collector.on("end", async (collected, reason) => {
    if (reason === "time" && collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("Tempo Esgotado")
        .setDescription("Você não selecionou nenhuma empresa. Tente novamente.");
      
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: []
      });
    }
  });
}

/**
 * Manipula o subcomando de coleta de lucros
 */
async function handleCollectProfit(interaction, userId) {
  const result = await businessService.collectProfit(userId);
  
  if (result.success) {
    let description = `Você coletou **${formatarDinheiro(result.profit)}** da sua **${result.businessName}** nível ${result.businessLevel}.`;
    
    if (result.intervals > 1) {
      description += `\n\n✨ Bônus: Coleta de ${result.intervals} períodos acumulados!`;
    }
    
    const embed = embedUtils.criarEmbedEconomia({
      usuario: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
      conteudo: description,
      valor: result.profit,
      novoSaldo: result.newBalance,
      ganhou: true,
      comando: "empresa"
    });
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    const businessInfo = await businessService.getBusinessInfo(userId);
    
    if (!businessInfo.hasBusiness) {
      const embed = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Você não tem uma empresa",
        mensagem: "Você precisa criar uma empresa com `/empresa criar` primeiro."
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle("⏳ Aguarde para coletar")
      .setDescription(`${result.message}`)
      .addFields(
        { name: "Empresa", value: businessInfo.name, inline: true },
        { name: "Nível", value: `${businessInfo.level}`, inline: true },
        { name: "Próximo lucro", value: `${formatarDinheiro(businessInfo.currentProfit)}`, inline: true }
      )
      .setFooter({ text: "As empresas geram lucro em intervalos regulares." });
    
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Manipula o subcomando de informações da empresa
 */
async function handleBusinessInfo(interaction, userId) {
  const businessInfo = await businessService.getBusinessInfo(userId);
  
  if (!businessInfo.hasBusiness) {
    const embed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Você não tem uma empresa",
      mensagem: "Você precisa criar uma empresa com `/empresa criar` primeiro."
    });
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Formatar data de criação
  const createdDate = new Date(businessInfo.createdAt);
  const formattedDate = `${createdDate.toLocaleDateString('pt-BR')} às ${createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  
  // Criar embed
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`🏢 ${businessInfo.name} - Nível ${businessInfo.level}`)
    .setDescription(businessInfo.description)
    .addFields(
      { name: "💵 Lucro atual", value: formatarDinheiro(businessInfo.currentProfit), inline: true },
      { name: "⏱️ Intervalo", value: `${businessInfo.interval.minutes} minutos`, inline: true },
      { name: "📊 Status", value: businessInfo.canCollect ? "✅ Pronto para coletar" : `⏳ ${businessInfo.formattedTimeRemaining} restantes`, inline: true },
      { name: "📈 Estatísticas", value: `• Lucro total: ${formatarDinheiro(businessInfo.stats.totalProfit)}\n• Total de coletas: ${businessInfo.stats.collections.toLocaleString()}`, inline: false },
      { name: "📅 Criada em", value: formattedDate, inline: true }
    );
  
  // Adicionar informações de melhoria se não estiver no nível máximo
  if (businessInfo.nextLevel) {
    embed.addFields(
      { name: "⬆️ Próximo nível", value: `Nível ${businessInfo.nextLevel}`, inline: true },
      { name: "💰 Custo para melhorar", value: formatarDinheiro(businessInfo.upgradeCost), inline: true },
      { name: "💵 Lucro após melhoria", value: formatarDinheiro(businessInfo.nextLevelProfit), inline: true }
    );
  } else {
    embed.addFields(
      { name: "🏆 Nível Máximo", value: "Sua empresa já atingiu o nível máximo!", inline: false }
    );
  }
  
  // Adicionar botão para coletar se estiver disponível
  const components = [];
  if (businessInfo.canCollect) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("collect_business_profit")
        .setLabel("Coletar Lucros")
        .setStyle(ButtonStyle.Success)
        .setEmoji("💰")
    );
    components.push(row);
  }
  
  const response = await interaction.editReply({
    embeds: [embed],
    components: components
  });
  
  // Se tiver botão de coleta, adicionar coletor
  if (businessInfo.canCollect) {
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });
    
    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        return i.reply({ content: "Você não pode usar esta interação.", ephemeral: true });
      }
      
      await i.deferUpdate();
      
      const result = await businessService.collectProfit(userId);
      
      if (result.success) {
        const successEmbed = embedUtils.criarEmbedEconomia({
          usuario: interaction.user.username,
          avatarURL: interaction.user.displayAvatarURL(),
          conteudo: `Você coletou **${formatarDinheiro(result.profit)}** da sua **${result.businessName}** nível ${result.businessLevel}.`,
          valor: result.profit,
          novoSaldo: result.newBalance,
          ganhou: true,
          comando: "empresa"
        });
        
        await i.editReply({
          embeds: [successEmbed],
          components: []
        });
      } else {
        const errorEmbed = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Erro ao coletar",
          mensagem: result.message
        });
        
        await i.editReply({
          embeds: [errorEmbed],
          components: []
        });
      }
    });
  }
}

/**
 * Manipula o subcomando de melhoria da empresa
 */
async function handleUpgradeBusiness(interaction, userId) {
  const businessInfo = await businessService.getBusinessInfo(userId);
  
  if (!businessInfo.hasBusiness) {
    const embed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Você não tem uma empresa",
      mensagem: "Você precisa criar uma empresa com `/empresa criar` primeiro."
    });
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  if (!businessInfo.nextLevel) {
    const embed = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Nível Máximo Atingido",
      mensagem: "Sua empresa já está no nível máximo."
    });
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Criar embed de confirmação
  const confirmEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`Melhorar ${businessInfo.name}`)
    .setDescription(`Você está prestes a melhorar sua empresa para o nível ${businessInfo.nextLevel}.`)
    .addFields(
      { name: "💰 Custo", value: formatarDinheiro(businessInfo.upgradeCost), inline: true },
      { name: "📈 Lucro atual", value: formatarDinheiro(businessInfo.currentProfit), inline: true },
      { name: "📈 Novo lucro", value: formatarDinheiro(businessInfo.nextLevelProfit), inline: true }
    )
    .setFooter({ text: "Melhorar sua empresa aumenta permanentemente o lucro." });
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_upgrade")
      .setLabel("Confirmar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cancel_upgrade")
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Danger)
  );
  
  const response = await interaction.editReply({
    embeds: [confirmEmbed],
    components: [row]
  });
  
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30000
  });
  
  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      return i.reply({ content: "Você não pode usar esta interação.", ephemeral: true });
    }
    
    await i.deferUpdate();
    
    if (i.customId === "confirm_upgrade") {
      const result = await businessService.upgradeBusiness(userId);
      
      if (result.success) {
        const successEmbed = embedUtils.criarEmbedEconomia({
          usuario: interaction.user.username,
          avatarURL: interaction.user.displayAvatarURL(),
          conteudo: `Você melhorou sua **${result.businessName}** para o nível **${result.newLevel}**! Seu lucro por coleta aumentou para **${formatarDinheiro(result.newProfit)}**.`,
          valor: -result.upgradeCost,
          novoSaldo: result.newBalance,
          ganhou: false,
          comando: "empresa"
        });
        
        await i.editReply({
          embeds: [successEmbed],
          components: []
        });
      } else {
        const errorEmbed = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Erro ao melhorar",
          mensagem: result.message
        });
        
        await i.editReply({
          embeds: [errorEmbed],
          components: []
        });
      }
    } else {
      // Cancelado
      const cancelEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("Melhoria Cancelada")
        .setDescription("Você cancelou a melhoria da empresa.");
      
      await i.editReply({
        embeds: [cancelEmbed],
        components: []
      });
    }
    
    collector.stop();
  });
  
  collector.on("end", async (collected, reason) => {
    if (reason === "time" && collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle("Tempo Esgotado")
        .setDescription("Você não respondeu a tempo. Tente novamente.");
      
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: []
      });
    }
  });
}