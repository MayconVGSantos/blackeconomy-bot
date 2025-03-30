// format.js - Utilitários para formatação de valores
/**
 * Formata um valor numérico para o formato de moeda brasileira (R$)
 * @param {number} valor - Valor a ser formatado
 * @returns {string} - Valor formatado (ex: R$ 1.250,00)
 */
function formatarDinheiro(valor) {
  // Arredonda para 2 casas decimais
  const valorArredondado = Math.round(valor * 100) / 100;

  // Formata o valor usando o locale pt-BR
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(valorArredondado);
}

/**
 * Formata um número no padrão brasileiro
 * @param {number} valor - Valor a ser formatado
 * @param {number} [casasDecimais=0] - Número de casas decimais
 * @returns {string} - Valor formatado (ex: 1.250,75)
 */
function formatarNumero(valor, casasDecimais = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  }).format(valor);
}

export { formatarDinheiro, formatarNumero };
