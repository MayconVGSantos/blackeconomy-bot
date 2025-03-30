// store-items.js
import config from "../../config/config.js";

/**
 * Serviço para gerenciar os itens disponíveis na loja
 * Simplificado para conter apenas fichas de cassino
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
          price: 1000,
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
          price: 4500,
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
          price: 8000,
          category: "casino",
          quantidade: 1000,
          icon: "🎰",
          usavel: false,
        },
      ],

      // Categorias vazias (mantidas para compatibilidade)
      consumiveis: [],
      vip: [],
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
