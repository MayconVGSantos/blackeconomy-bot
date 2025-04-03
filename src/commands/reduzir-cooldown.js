// reduzir-cooldown.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import { getDatabase, ref, get, update } from "firebase/database";
import embedUtils from "../utils/embed.js";
import { formatarTempoEspera } from "../utils/format.js";

export const data = new SlashCommandBuilder()
  .setName("reduzir-cooldown")
  .setDescription("Reduz o tempo de espera de um comando específico");

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    const userId = interaction.user.id;

    // Verificar se o usuário tem efeito ativo de redução de cooldown
    const database = getDatabase();
    const effectsRef = ref(
      database,
      `users/${userId}/activeEffects/reduce_cooldown_single`
    );
    const snapshot = await get(effectsRef);

    if (!snapshot.exists()) {
      const embedErro = embedUtils.criarEmbedErro({
        usuario: interaction.user.username,
        titulo: "Sem Efeito Ativo",
        mensagem:
          "Você não tem um efeito de redução de cooldown ativo.\nUse um item como 'Café Extra-Forte' primeiro.",
      });

      return interaction.editReply({ embeds: [embedErro] });
    }

    const effect = snapshot.val();
    const reduction = effect.value || 0.3; // Valor padrão de 30% se não for especificado

    // Obter todos os comandos em cooldown
    const cooldownsRef = ref(database, `users/${userId}/cooldowns`);
    const cooldownsSnapshot = await get(cooldownsRef);

    if (!cooldownsSnapshot.exists()) {
      const embedInfo = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Sem Cooldowns")
        .setDescription("Você não tem nenhum comando em cooldown para reduzir.")
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embedInfo] });
    }

    const cooldowns = cooldownsSnapshot.val();
    const commands = [];
    const now = Date.now();

    // Verificar quais comandos estão em cooldown
    for (const cmd in cooldowns) {
      const lastUsed = cooldowns[cmd];
      let cooldownTime = 0;

      // Determinar o tempo de cooldown baseado no comando
      switch (cmd) {
        case "trabalhar":
        case "crime":
        case "roubar":
        case "seduzir":
          cooldownTime = 30 * 60000; // 30 minutos em ms (exemplo)
          break;
        case "diario":
          cooldownTime = 24 * 60 * 60000; // 24 horas em ms
          break;
        case "semanal":
          cooldownTime = 7 * 24 * 60 * 60000; // 7 dias em ms
          break;
        default:
          cooldownTime = 60 * 60000; // 1 hora em ms (padrão)
      }

      const timeElapsed = now - lastUsed;

      if (timeElapsed < cooldownTime) {
        commands.push({
          name: cmd,
          remaining: cooldownTime - timeElapsed,
          lastUsed: lastUsed,
        });
      }
    }

    if (commands.length === 0) {
      const embedInfo = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Sem Cooldowns")
        .setDescription("Você não tem nenhum comando em cooldown para reduzir.")
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embedInfo] });
    }

    // Criar menu de seleção
    const options = commands.map((cmd) => {
      const formattedTime = formatarTempoEspera(cmd.remaining);
      return {
        label: `/${cmd.name}`,
        description: `Tempo restante: ${formattedTime}`,
        value: cmd.name,
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("reduce_cooldown")
        .setPlaceholder("Selecione um comando para reduzir o cooldown")
        .addOptions(options)
    );

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("⏱️ Reduzir Tempo de Espera")
      .setDescription(
        `Selecione qual comando você deseja reduzir o tempo de espera em ${
          reduction * 100
        }%:`
      )
      .setFooter({ text: `Solicitado por ${interaction.user.username}` })
      .setTimestamp();

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Coletor para o menu
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: "Você não pode usar este menu.",
          ephemeral: true,
        });
        return;
      }

      const selectedCommand = i.values[0];
      await i.deferUpdate();

      // Aplicar a redução
      if (cooldowns[selectedCommand]) {
        const lastUsed = cooldowns[selectedCommand];
        const timeElapsed = now - lastUsed;
        const newLastUsed = lastUsed + timeElapsed * reduction;

        // Atualizar o cooldown
        await update(
          ref(database, `users/${userId}/cooldowns/${selectedCommand}`),
          newLastUsed
        );

        // Remover o efeito usado
        await update(
          ref(database, `users/${userId}/activeEffects/reduce_cooldown_single`),
          null
        );

        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("⏱️ Cooldown Reduzido")
          .setDescription(
            `O tempo de espera do comando /${selectedCommand} foi reduzido em ${
              reduction * 100
            }%!`
          )
          .setFooter({ text: `Solicitado por ${interaction.user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] });
      } else {
        const embedErro = embedUtils.criarEmbedErro({
          usuario: interaction.user.username,
          titulo: "Comando Inválido",
          mensagem: "O comando selecionado não está mais em cooldown.",
        });

        await interaction.editReply({ embeds: [embedErro], components: [] });
      }

      collector.stop();
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && reply.editable) {
        const timeoutEmbed = EmbedBuilder.from(embed)
          .setTitle("⏱️ Tempo Esgotado")
          .setDescription("O tempo para selecionar um comando expirou.");

        const disabledRow = new ActionRowBuilder().addComponents(
          StringSelectMenuBuilder.from(row.components[0])
            .setDisabled(true)
            .setPlaceholder("Menu expirado")
        );

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [disabledRow],
        });
      }
    });
  } catch (error) {
    console.error("Erro ao executar comando reduzir-cooldown:", error);

    const embedErro = embedUtils.criarEmbedErro({
      usuario: interaction.user.username,
      titulo: "Erro no Comando",
      mensagem:
        "Ocorreu um erro ao processar o comando. Tente novamente mais tarde.",
    });

    return interaction.editReply({ embeds: [embedErro] });
  }
}
