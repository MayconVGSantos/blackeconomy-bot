// store-items.js - Versão modificada com preços ajustados
import config from "../../config/config.js";

/**
 * Serviço para gerenciar os itens disponíveis na loja
 * Com preços reajustados para uma economia mais equilibrada
 */
class StoreItemsService {
  constructor() {
    this.items = {
      // Categoria: Cassino
      casino: [
        {
          id: "fichas_cassino_100",
          name: "100 Fichas de Cassino",
          description: "100 fichas para usar nos jogos do cassino.",
          price: 1200, // Aumentado: antes 1000
          category: "casino",
          quantidade: 100,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "fichas_cassino_500",
          name: "500 Fichas de Cassino",
          description:
            "500 fichas para usar nos jogos do cassino. Melhor custo-benefício!",
          price: 5500, // Aumentado: antes 4500
          category: "casino",
          quantidade: 500,
          icon: "🎰",
          usavel: false,
        },
        {
          id: "fichas_cassino_1000",
          name: "1000 Fichas de Cassino",
          description:
            "1000 fichas para usar nos jogos do cassino. Pacote VIP!",
          price: 10000, // Aumentado: antes 8000
          category: "casino",
          quantidade: 1000,
          icon: "🎰",
          usavel: false,
        },
        // Novo item: Amuleto da Sorte - Consumível temporário
        {
          id: "amuleto_sorte",
          name: "Amuleto da Sorte",
          description:
            "Aumenta suas chances de ganhos no cassino por 24 horas!",
          price: 5000,
          category: "casino",
          icon: "🍀",
          usavel: true,
          effect: "boost_casino",
          effectValue: 1.15, // 15% de aumento
          duration: 24 * 60 * 60 * 1000, // 24 horas em ms
          cooldown: 48 * 60 * 60 * 1000, // 48 horas em ms
        },
      ],

      // Nova categoria: Consumíveis
      consumiveis: [
        // Item para redução de cooldown
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
          effectValue: 0.5, // Reduz em 50%
          cooldown: 24 * 60 * 60 * 1000, // 24 horas em ms
        },
        // Bônus de trabalho
        {
          id: "contrato_temporario",
          name: "Contrato Temporário",
          description:
            "Aumenta os ganhos do comando trabalhar em 30% por 12 horas.",
          price: 3000,
          category: "consumiveis",
          icon: "📑",
          usavel: true,
          effect: "boost_work",
          effectValue: 1.3, // 30% de aumento
          duration: 12 * 60 * 60 * 1000, // 12 horas em ms
          cooldown: 24 * 60 * 60 * 1000, // 24 horas em ms
        },
        // Bônus de crime
        {
          id: "mascara_anonima",
          name: "Máscara Anônima",
          description:
            "Aumenta os ganhos e chances de sucesso do crime em 25% por 6 horas.",
          price: 4000,
          category: "consumiveis",
          icon: "🎭",
          usavel: true,
          effect: "boost_crime",
          effectValue: 1.25, // 25% de aumento
          duration: 6 * 60 * 60 * 1000, // 6 horas em ms
          cooldown: 24 * 60 * 60 * 1000, // 24 horas em ms
        },
      ],

      // Nova categoria: VIP
      vip: [
        {
          id: "vip_basico",
          name: "Status VIP Básico",
          description:
            "Reduz cooldowns em 10% e aumenta ganhos em 10% por 7 dias.",
          price: 15000,
          category: "vip",
          icon: "✨",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.1, // 10% de redução
            incomeBoost: 0.1, // 10% de aumento
          },
          duration: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
          cooldown: 0, // Sem cooldown, mas apenas um pode estar ativo
        },
        {
          id: "vip_premium",
          name: "Status VIP Premium",
          description:
            "Reduz cooldowns em 20% e aumenta ganhos em 20% por 15 dias.",
          price: 35000,
          category: "vip",
          icon: "💫",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.2, // 20% de redução
            incomeBoost: 0.2, // 20% de aumento
          },
          duration: 15 * 24 * 60 * 60 * 1000, // 15 dias em ms
          cooldown: 0, // Sem cooldown, mas apenas um pode estar ativo
        },
        {
          id: "vip_deluxe",
          name: "Status VIP Deluxe",
          description:
            "Reduz cooldowns em 30% e aumenta ganhos em 30% por 30 dias.",
          price: 75000,
          category: "vip",
          icon: "👑",
          usavel: true,
          effect: "vip_status",
          effectValue: {
            cooldownReduction: 0.3, // 30% de redução
            incomeBoost: 0.3, // 30% de aumento
          },
          duration: 30 * 24 * 60 * 60 * 1000, // 30 dias em ms
          cooldown: 0, // Sem cooldown, mas apenas um pode estar ativo
        },
      ],
    };
  }

  /**
   * Retorna todos os itens disponíveis
   * @returns {Object} - Objeto com categorias e itens
   */
  getAllItems() {
    return this.items;
  }

  /**
   * Retorna todos os itens de uma categoria específica
   * @param {string} category - Nome da categoria
   * @returns {Array} - Array de itens da categoria
   */
  getItemsByCategory(category) {
    return this.items[category] || [];
  }

  /**
   * Retorna todas as categorias disponíveis
   * @returns {Array} - Array com nomes das categorias
   */
  getCategories() {
    // Retorna apenas categorias com itens
    return Object.keys(this.items).filter(
      (category) => this.items[category].length > 0
    );
  }

  /**
   * Encontra um item pelo ID
   * @param {string} itemId - ID do item
   * @returns {Object|null} - Item encontrado ou null
   */
  getItemById(itemId) {
    for (const category in this.items) {
      const item = this.items[category].find((item) => item.id === itemId);
      if (item) return item;
    }
    return null;
  }

  /**
   * Verifica se um item existe
   * @param {string} itemId - ID do item
   * @returns {boolean} - Verdadeiro se o item existir
   */
  itemExists(itemId) {
    return this.getItemById(itemId) !== null;
  }

  /**
   * Traduz o nome da categoria para exibição
   * @param {string} category - Nome da categoria
   * @returns {string} - Nome formatado da categoria
   */
  getCategoryDisplayName(category) {
    const displayNames = {
      casino: "🎰 Cassino",
      consumiveis: "🧪 Consumíveis",
      vip: "✨ VIP",
    };

    return displayNames[category] || category;
  }

  /**
   * Retorna o ícone da categoria
   * @param {string} category - Nome da categoria
   * @returns {string} - Ícone da categoria
   */
  getCategoryIcon(category) {
    const icons = {
      casino: "🎰",
      consumiveis: "🧪",
      vip: "✨",
    };

    return icons[category] || "📦";
  }
}

export default new StoreItemsService();
