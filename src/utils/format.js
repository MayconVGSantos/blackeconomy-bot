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

/**
 * Formata o tempo de espera em uma string legível com dias, horas, minutos e segundos
 * @param {number} tempoRestanteMs - Tempo restante em milissegundos
 * @returns {string} - Tempo formatado (ex: "2d 5h 30m 15s")
 */
function formatarTempoEspera(tempoRestanteMs) {
  // Converter para segundos
  let tempoTotal = Math.ceil(tempoRestanteMs / 1000);

  // Calcular dias, horas, minutos e segundos
  const dias = Math.floor(tempoTotal / (24 * 60 * 60));
  tempoTotal %= 24 * 60 * 60;

  const horas = Math.floor(tempoTotal / (60 * 60));
  tempoTotal %= 60 * 60;

  const minutos = Math.floor(tempoTotal / 60);
  const segundos = tempoTotal % 60;

  // Construir a string de tempo
  let resultado = "";

  if (dias > 0) {
    resultado += `${dias}d `;
  }

  if (horas > 0 || dias > 0) {
    resultado += `${horas}h `;
  }

  if (minutos > 0 || horas > 0 || dias > 0) {
    resultado += `${minutos}m `;
  }

  resultado += `${segundos}s`;

  return resultado;
}

/**
 * Formata uma data no fuso horário do Brasil
 * @param {Date|number} date - A data para formatar
 * @param {boolean} includeDate - Se deve incluir a data ou só a hora
 * @returns {string} Data formatada
 */
function formatarDataBrasil(date, includeDate = false) {
  const dateObj = new Date(date);
  const options = { 
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', 
    minute: '2-digit'
  };
  
  if (includeDate) {
    options.day = '2-digit';
    options.month = '2-digit';
    options.year = 'numeric';
    return dateObj.toLocaleString('pt-BR', options);
  }
  
  return dateObj.toLocaleTimeString('pt-BR', options);
}

export { formatarDinheiro, formatarNumero, formatarTempoEspera, formatarDataBrasil };
