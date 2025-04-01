// store-items.js - Versão reestruturada com preços significativamente aumentados
import config from "../../config/config.js";

/**
 * Serviço para gerenciar os itens disponíveis na loja
 * Com preços reajustados para uma economia mais desafiadora
 */
class StoreItemsService {
  constructor() {
    this.items = {
      // Categoria: Cassino
      casino: [
        {
          id: "fichas_cassino_50",
          name: "50 Fichas de Cassino",
          description: "50 fichas para usar nos jogos do cassino.",
          price: 1000,
          category: "casino",
          quantidade: 50,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "fichas_cassino_200",
          name: "200 Fichas de Cassino",
          description:
            "200 fichas para usar nos jogos do cassino. Melhor custo-benefício!",
          price: 3800,
          category: "casino",
          quantidade: 200,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "fichas_cassino_500",
          name: "500 Fichas de Cassino",
          description:
            "500 fichas para usar nos jogos do cassino. Pacote Premium!",
          price: 9000,
          category: "casino",
          quantidade: 500,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "fichas_cassino_1000",
          name: "1000 Fichas de Cassino",
          description:
            "1000 fichas para usar nos jogos do cassino. Pacote VIP Exclusivo!",
          price: 18000,
          category: "casino",
          quantidade: 1000,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "amuleto_sorte",
          name: "Amuleto da Sorte",
          description:
            "Aumenta suas chances de ganhos no cassino por 24 horas!",
          price: 8500,
          category: "casino",
          icon: "🍀",
          usavel: true,
          effect: "boost_casino",
          effectValue: 1.15,
          duration: 24 * 60 * 60 * 1000,
          cooldown: 48 * 60 * 60 * 1000,
        },
        {
          id: "fichas_vip",
          name: "Fichas VIP",
          description:
            "100 fichas especiais que garantem ao menos 1 vitória a cada 3 jogadas no cassino.",
          price: 12000,
          category: "casino",
          quantidade: 100,
          icon: "💎",
          usavel: false,
        },
      ],

      // Categoria: Consumíveis - Reestruturada
      consumiveis: [
        {
          id: "redutor_cooldown",
          name: "Energético",
          description:
            "Reduz os tempos de espera de todos os comandos em 50% uma vez.",
          price: 2500,
          category: "consumiveis",
          icon: "⚡",
          usavel: true,
          effect: "reduce_cooldown",
          effectValue: 0.5,
          cooldown: 24 * 60 * 60 * 1000,
        },
        {
          id: "redutor_cooldown_basico",
          name: "Café Extra-Forte",
          description:
            "Reduz os tempos de espera de um comando específico em 30%.",
          price: 1500,
          category: "consumiveis",
          icon: "☕",
          usavel: true,
          effect: "reduce_cooldown_single",
          effectValue: 0.3,
          cooldown: 6 * 60 * 60 * 1000,
          tier: "básico",
        },
        // Alterado para id único: "redutor_cooldown_premium"
        {
          id: "redutor_cooldown_premium",
          name: "Bebida Energética",
          description:
            "Reduz os tempos de espera de todos os comandos em 50% uma vez.",
          price: 7500,
          category: "consumiveis",
          icon: "⚡",
          usavel: true,
          effect: "reduce_cooldown",
          effectValue: 0.5,
          cooldown: 24 * 60 * 60 * 1000,
          tier: "premium",
        },
        {
          id: "contrato_temporario_basico",
          name: "Contrato de Estágio",
          description:
            "Aumenta os ganhos do comando trabalhar em 15% por 6 horas.",
          price: 2000,
          category: "consumiveis",
          icon: "📄",
          usavel: true,
          effect: "boost_work",
          effectValue: 1.15,
          duration: 6 * 60 * 60 * 1000,
          cooldown: 12 * 60 * 60 * 1000,
          tier: "básico",
        },
        {
          id: "contrato_temporario",
          name: "Contrato Profissional",
          description:
            "Aumenta os ganhos do comando trabalhar em 40% por 12 horas.",
          price: 6500,
          category: "consumiveis",
          icon: "📑",
          usavel: true,
          effect: "boost_work",
          effectValue: 1.4,
          duration: 12 * 60 * 60 * 1000,
          cooldown: 24 * 60 * 60 * 1000,
          tier: "premium",
        },
        {
          id: "mascara_basica",
          name: "Máscara Simples",
          description:
            "Aumenta os ganhos e chances de sucesso do crime em 15% por 3 horas.",
          price: 2500,
          category: "consumiveis",
          icon: "🎭",
          usavel: true,
          effect: "boost_crime",
          effectValue: 1.15,
          duration: 3 * 60 * 60 * 1000,
          cooldown: 12 * 60 * 60 * 1000,
          tier: "básico",
        },
        {
          id: "mascara_anonima",
          name: "Máscara Profissional",
          description:
            "Aumenta os ganhos e chances de sucesso do crime em 35% por 8 horas.",
          price: 7500,
          category: "consumiveis",
          icon: "🎭",
          usavel: true,
          effect: "boost_crime",
          effectValue: 1.35,
          duration: 8 * 60 * 60 * 1000,
          cooldown: 24 * 60 * 60 * 1000,
          tier: "premium",
        },
        {
          id: "pocao_estudos",
          name: "Poção de Estudos",
          description: "Dobra os pontos ganhos no próximo comando /estudar.",
          price: 5000,
          category: "consumiveis",
          icon: "🧪",
          usavel: true,
          effect: "boost_study",
          effectValue: 2.0,
          duration: 24 * 60 * 60 * 1000,
          cooldown: 3 * 24 * 60 * 60 * 1000,
          tier: "premium",
        },
        {
          id: "borracha_magica",
          name: "Borracha Mágica",
          description: "Aumenta em 25% as chances de passar no próximo exame.",
          price: 7000,
          category: "consumiveis",
          icon: "✏️",
          usavel: true,
          effect: "boost_exam",
          effectValue: 0.25,
          duration: 10 * 24 * 60 * 60 * 1000,
          cooldown: 15 * 24 * 60 * 60 * 1000,
          tier: "premium",
        },
      ],

      // Categoria: VIP - Reestruturada com valores mais altos
      vip: [
        {
          id: "vip_basico",
          name: "Status VIP Básico",
          description:
            "Reduz cooldowns em 15% e aumenta ganhos em 15% por 7 dias.",
          price: 25000,
          category: "vip",
          icon: "✨",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.15,
            incomeBoost: 0.15,
          },
          duration: 7 * 24 * 60 * 60 * 1000,
          cooldown: 0,
          tier: "básico",
        },
        {
          id: "vip_premium",
          name: "Status VIP Premium",
          description:
            "Reduz cooldowns em 30% e aumenta ganhos em 30% por 15 dias.",
          price: 60000,
          category: "vip",
          icon: "💫",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.3,
            incomeBoost: 0.3,
          },
          duration: 15 * 24 * 60 * 60 * 1000,
          cooldown: 0,
          tier: "premium",
        },
        {
          id: "vip_deluxe",
          name: "Status VIP Deluxe",
          description:
            "Reduz cooldowns em 50% e aumenta ganhos em 50% por 30 dias.",
          price: 125000,
          category: "vip",
          icon: "👑",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.5,
            incomeBoost: 0.5,
          },
          duration: 30 * 24 * 60 * 60 * 1000,
          cooldown: 0,
          tier: "deluxe",
        },
        {
          id: "vip_eternal",
          name: "Status VIP Eterno",
          description:
            "Reduz cooldowns em 30% e aumenta ganhos em 30% PERMANENTEMENTE.",
          price: 500000,
          category: "vip",
          icon: "🌟",
          usavel: true,
          effect: "vip_permanent",
          effectValue: {
            cooldownReduction: 0.3,
            incomeBoost: 0.3,
          },
          duration: 999999 * 24 * 60 * 60 * 1000,
          cooldown: 0,
          tier: "eternal",
        },
      ],

      // Categoria: Itens Especiais
      especiais: [
        {
          id: "apagador_moral",
          name: "Apagador Moral",
          description:
            "Redefine sua reputação moral para neutro (0). Útil para vilões que querem recomeçar.",
          price: 200000,
          category: "especiais",
          icon: "🧿",
          usavel: true,
          effect: "reset_morality",
          cooldown: 30 * 24 * 60 * 60 * 1000,
          tier: "rare",
        },
        {
          id: "diploma_falsificado",
          name: "Diploma Falsificado",
          description:
            "Permite pular um nível educacional sem estudar. Não substitui os benefícios de aprendizado real.",
          price: 150000,
          category: "especiais",
          icon: "📜",
          usavel: true,
          effect: "skip_education_level",
          cooldown: 45 * 24 * 60 * 60 * 1000,
          tier: "rare",
        },
        {
          id: "maquina_tempo",
          name: "Máquina do Tempo",
          description: "Reseta TODOS os cooldowns imediatamente. Uso único.",
          price: 100000,
          category: "especiais",
          icon: "⏰",
          usavel: true,
          effect: "reset_all_cooldowns",
          cooldown: 14 * 24 * 60 * 60 * 1000,
          tier: "rare",
        },
        {
          id: "pacto_magico",
          name: "Pacto Mágico",
          description:
            "Duplica seus ganhos em todos os comandos por 24 horas, mas perde toda sua reputação.",
          price: 250000,
          category: "especiais",
          icon: "🔮",
          usavel: true,
          effect: "double_income_lose_rep",
          effectValue: 2.0,
          duration: 24 * 60 * 60 * 1000,
          cooldown: 60 * 24 * 60 * 60 * 1000,
          tier: "legendary",
        },
      ],
    };
  }

  getAllItems() {
    return this.items;
  }

  getItemsByCategory(category) {
    return this.items[category] || [];
  }

  getCategories() {
    return Object.keys(this.items).filter(
      (category) => this.items[category].length > 0
    );
  }

  getItemById(itemId) {
    for (const category in this.items) {
      const item = this.items[category].find((item) => item.id === itemId);
      if (item) return item;
    }
    return null;
  }

  itemExists(itemId) {
    return this.getItemById(itemId) !== null;
  }

  getCategoryDisplayName(category) {
    const displayNames = {
      casino: "🎰 Cassino",
      consumiveis: "🧪 Consumíveis",
      vip: "✨ Status VIP",
      especiais: "🌟 Itens Especiais",
    };
    return displayNames[category] || category;
  }

  getCategoryIcon(category) {
    const icons = {
      casino: "🎰",
      consumiveis: "🧪",
      vip: "✨",
      especiais: "🌟",
    };
    return icons[category] || "📦";
  }

  getCategoryColor(category) {
    const colors = {
      casino: 0xffd700,
      consumiveis: 0x9966cc,
      vip: 0x4169e1,
      especiais: 0xff4500,
    };
    return colors[category] || 0xffffff;
  }
}

export default new StoreItemsService();
