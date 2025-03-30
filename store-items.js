// store-items.js
import config from '../../config/config.js';

/**
* Serviço para gerenciar os itens disponíveis na loja
* Organizados por categorias e com suas respectivas funcionalidades
*/
class StoreItemsService {
 constructor() {
   this.items = {
     // Categoria: Cassino
     casino: [
       {
         id: 'fichas_cassino_100',
         name: '100 Fichas de Cassino',
         description: '100 fichas para usar nos jogos do cassino.',
         price: 1000,
         category: 'casino',
         quantidade: 100,
         icon: '🎰',
         usavel: false
       },
       {
         id: 'fichas_cassino_500',
         name: '500 Fichas de Cassino',
         description: '500 fichas para usar nos jogos do cassino. Melhor custo-benefício!',
         price: 4500,
         category: 'casino',
         quantidade: 500,
         icon: '🎰',
         usavel: false
       },
       {
         id: 'fichas_cassino_1000',
         name: '1000 Fichas de Cassino',
         description: '1000 fichas para usar nos jogos do cassino. Pacote VIP!',
         price: 8000,
         category: 'casino',
         quantidade: 1000,
         icon: '🎰',
         usavel: false
       }
     ],
     
     // Categoria: Consumíveis
     consumiveis: [
       {
         id: 'redutor_cooldown',
         name: 'Pó do Tempo',
         description: 'Reduz o cooldown de qualquer comando em 50%.',
         price: 3000,
         category: 'consumiveis',
         icon: '⏱️',
         usavel: true,
         cooldown: 24 * 60 * 60 * 1000, // 24 horas
         effect: 'reduce_cooldown',
         effectValue: 0.5 // 50% de redução
       },
       {
         id: 'boost_trabalho',
         name: 'Certificado Profissional',
         description: 'Aumenta os ganhos do comando /trabalhar em 25% por 2 horas.',
         price: 5000,
         category: 'consumiveis',
         icon: '💼',
         usavel: true,
         cooldown: 4 * 60 * 60 * 1000, // 4 horas
         duration: 2 * 60 * 60 * 1000, // 2 horas
         effect: 'boost_work',
         effectValue: 1.25 // 25% de aumento
       },
       {
         id: 'boost_crime',
         name: 'Manual do Crime',
         description: 'Aumenta o sucesso e os ganhos do comando /crime em 20% por 1 hora.',
         price: 7500,
         category: 'consumiveis',
         icon: '📒',
         usavel: true,
         cooldown: 8 * 60 * 60 * 1000, // 8 horas
         duration: 1 * 60 * 60 * 1000, // 1 hora
         effect: 'boost_crime',
         effectValue: 1.2 // 20% de aumento
       }
     ],
     
     // Categoria: VIP
     vip: [
       {
         id: 'vip_bronze',
         name: 'VIP Bronze',
         description: 'Reduz cooldowns em 10% e aumenta ganhos em 5% por 7 dias.',
         price: 10000,
         category: 'vip',
         icon: '🥉',
         usavel: true,
         cooldown: 7 * 24 * 60 * 60 * 1000, // 7 dias
         duration: 7 * 24 * 60 * 60 * 1000, // 7 dias
         effect: 'vip_status',
         effectValue: {
           cooldownReduction: 0.1, // 10% de redução
           incomeBoost: 0.05 // 5% de aumento
         }
       },
       {
         id: 'vip_prata',
         name: 'VIP Prata',
         description: 'Reduz cooldowns em 25% e aumenta ganhos em 15% por 7 dias.',
         price: 25000,
         category: 'vip',
         icon: '🥈',
         usavel: true,
         cooldown: 7 * 24 * 60 * 60 * 1000, // 7 dias
         duration: 7 * 24 * 60 * 60 * 1000, // 7 dias
         effect: 'vip_status',
         effectValue: {
           cooldownReduction: 0.25, // 25% de redução
           incomeBoost: 0.15 // 15% de aumento
         }
       },
       {
         id: 'vip_ouro',
         name: 'VIP Ouro',
         description: 'Reduz cooldowns em 40% e aumenta ganhos em 30% por 7 dias.',
         price: 50000,
         category: 'vip',
         icon: '🥇',
         usavel: true,
         cooldown: 7 * 24 * 60 * 60 * 1000, // 7 dias
         duration: 7 * 24 * 60 * 60 * 1000, // 7 dias
         effect: 'vip_status',
         effectValue: {
           cooldownReduction: 0.4, // 40% de redução
           incomeBoost: 0.3 // 30% de aumento
         }
       }
     ]
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
   return Object.keys(this.items);
 }

 /**
  * Encontra um item pelo ID
  * @param {string} itemId - ID do item
  * @returns {Object|null} - Item encontrado ou null
  */
 getItemById(itemId) {
   for (const category in this.items) {
     const item = this.items[category].find(item => item.id === itemId);
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
     'casino': '🎰 Cassino',
     'consumiveis': '🧪 Consumíveis',
     'vip': '✨ VIP'
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
     'casino': '🎰',
     'consumiveis': '🧪',
     'vip': '✨'
   };
   
   return icons[category] || '📦';
 }
}

export default new StoreItemsService();