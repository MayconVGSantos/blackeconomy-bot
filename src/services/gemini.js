// gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cliente otimizado para a API Gemini
 * Utilizando o modelo Gemini 2.0 Flash para melhor desempenho
 * e tratamento de erros aprimorado
 */
class GeminiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  /**
   * Gera uma resposta com base em um prompt
   * @param {string} prompt - O prompt para enviar à API Gemini
   * @returns {Promise<string>} - A resposta gerada
   */
  async generateResponse(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Erro ao gerar resposta com Gemini:', error);
      return 'Não foi possível gerar uma resposta criativa. Tente novamente mais tarde.';
    }
  }

  /**
   * Gera uma resposta para o comando trabalhar
   * @param {number} valor - Valor ganho
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaTrabalhar(valor) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase humorística, sarcástica e com humor negro pesado para o comando /trabalhar de um bot de Discord. 
    A frase deve conter o valor R$${valor} de forma natural e explícita.
    O usuário ganhou esse valor "trabalhando". 
    Seja criativo, cínico e use ironia. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    return this.generateResponse(prompt);
  }

  /**
   * Gera uma resposta para o comando seduzir
   * @param {number} valor - Valor ganho/perdido
   * @param {boolean} ganhou - Se o usuário ganhou ou perdeu
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaSeduzir(valor, ganhou) {
    const valorFormatado = ganhou ? `R$${valor}` : `-R$${Math.abs(valor)}`;
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase humorística, provocativa e ofensiva para o comando /seduzir de um bot de Discord.
    O usuário ${ganhou ? 'ganhou' : 'perdeu'} ${valorFormatado} tentando seduzir alguém. 
    A frase deve conter o valor ${valorFormatado} de forma natural e explícita.
    Seja criativo, cínico e use tom provocativo e ofensivo. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    return this.generateResponse(prompt);
  }

  /**
   * Gera uma resposta para o comando crime
   * @param {number} valor - Valor ganho/perdido
   * @param {boolean} ganhou - Se o usuário ganhou ou perdeu
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaCrime(valor, ganhou) {
    const valorFormatado = ganhou ? `R$${valor}` : `-R$${Math.abs(valor)}`;
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase sombria, ácida e sem filtros para o comando /crime de um bot de Discord.
    O usuário ${ganhou ? 'lucrou' : 'perdeu'} ${valorFormatado} ao tentar cometer um crime.
    A frase deve embutir claramente o valor em reais (${valorFormatado}) de forma natural e explícita.
    Seja criativo, cínico e use tom sombrio. Faça referência a crimes específicos. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    return this.generateResponse(prompt);
  }

   /**
   * Gera uma resposta para o comando roubar
   * @param {number} valor - Valor roubado/multa
   * @param {boolean} sucesso - Se o roubo foi bem-sucedido
   * @param {string} nomeAlvo - Nome do alvo do roubo
   * @returns {Promise<string>} - Resposta gerada
   */
   async gerarRespostaRoubo(valor, sucesso, nomeAlvo) {
    const prompt = sucesso 
      ? `
      Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
      
      Gere uma frase sarcástica e com humor negro pesado para um comando de roubo bem-sucedido em um bot de Discord.
      O usuário roubou R$${valor.toFixed(2)} de ${nomeAlvo}.
      A frase deve conter o valor roubado de forma natural e explícita.
      Seja criativo e use um tom irônico ou provocativo. Limite a resposta a 1-2 frases curtas.
      
      Responda apenas com a frase, sem explicações adicionais.
      `
      : `
      Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
      
      Gere uma frase sarcástica e com humor negro pesado para um comando de roubo que falhou em um bot de Discord.
      O usuário tentou roubar ${nomeAlvo}, foi pego e pagou uma multa de R$${valor.toFixed(2)}.
      A frase deve conter o valor da multa de forma natural e explícita.
      Seja criativo e use um tom de zombaria com o fracasso. Limite a resposta a 1-2 frases curtas.
      
      Responda apenas com a frase, sem explicações adicionais.
      `;
    
    return this.generateResponse(prompt);
  }

  /**
   * Gera um motivo para transferência PIX
   * @param {string} remetente - Nome do remetente
   * @param {string} destinatario - Nome do destinatário
   * @param {number} valor - Valor transferido
   * @returns {Promise<string>} - Motivo gerado
   */
  async gerarMotivoPix(remetente, destinatario, valor) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere um motivo criativo, irônico e com humor negro leve para uma transferência PIX entre usuários do Discord.
    O usuário ${remetente} transferiu R$${valor.toFixed(2)} para ${destinatario}.
    O motivo deve ser breve, criativo e engraçado, podendo fazer referências a contextos absurdos, ilegais ou constrangedores de forma leve e cômica.
    Seja criativo e certifique-se de incluir o valor transferido de forma natural na explicação.
    Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com o motivo, sem explicações adicionais.
    `;
    
    return this.generateResponse(prompt);
  }
}

export default new GeminiClient();