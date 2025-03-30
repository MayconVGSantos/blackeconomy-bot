// gemini.js - versão atualizada com melhor tratamento de erros
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import config from '../../config/config.js';

dotenv.config();

/**
 * Cliente otimizado para a API Gemini
 * Utilizando o modelo Gemini mais recente para melhor desempenho
 * e tratamento de erros aprimorado
 */
class GeminiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || config.api.gemini.apiKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    // Usar um modelo de fallback se o principal falhar
    this.models = {
      primary: "gemini-1.5-flash",
      fallback: "gemini-1.0-pro"
    };
    
    this.model = this.genAI.getGenerativeModel({ model: this.models.primary });
    this.fallbackModel = this.genAI.getGenerativeModel({ model: this.models.fallback });
    
    // Verificar se a API Key é válida
    this.validateApiKey();
  }

  /**
   * Valida se a API Key é válida
   */
  async validateApiKey() {
    try {
      if (!this.apiKey || this.apiKey === "AIzaSyDxqp5Q4LMVowmML6Pj2pAXqBLdD2k9_uI") {
        console.warn('\x1b[33m%s\x1b[0m', 'AVISO: Chave da API Gemini inválida ou não configurada corretamente.');
        console.warn('\x1b[33m%s\x1b[0m', 'Obtenha uma chave em https://makersuite.google.com/app/apikey e configure-a no arquivo .env');
        this.validApiKey = false;
      } else {
        // Testar a API com uma requisição simples
        await this.model.generateContent("Test");
        this.validApiKey = true;
        console.log('API Gemini conectada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao validar API Gemini:', error.message);
      this.validApiKey = false;
      
      // Tenta o modelo de fallback
      try {
        await this.fallbackModel.generateContent("Test");
        console.log('Usando modelo de fallback para Gemini API');
        this.model = this.fallbackModel;
        this.validApiKey = true;
      } catch (fallbackError) {
        console.error('Erro ao usar modelo de fallback:', fallbackError.message);
      }
    }
  }

  /**
   * Gera respostas de fallback quando a API falha
   * @param {string} comando - Nome do comando
   * @param {number} valor - Valor ganho/perdido
   * @param {boolean} ganhou - Se ganhou ou perdeu
   * @returns {string} - Resposta gerada localmente
   */
  generateFallbackResponse(comando, valor, ganhou = true) {
    const valorFormatado = Math.abs(valor).toFixed(2);
    
    // Respostas pré-definidas para quando a API falha
    const fallbackRespostas = {
      trabalhar: [
        `Uau, você trabalhou 12 horas e ganhou apenas R$${valorFormatado}. O capitalismo agradece seu sacrifício.`,
        `R$${valorFormatado} por um dia de trabalho? Até escravidão parece oferecer melhores benefícios.`,
        `Parabéns pelos R$${valorFormatado}! Já dá pra comprar um pacote de miojo e fingir que é gente.`,
        `R$${valorFormatado} pelo seu suor. Nem para comprar um antidepressivo depois dessa jornada de trabalho.`
      ],
      seduzir: {
        ganhou: [
          `Você seduziu alguém e conseguiu R$${valorFormatado}. Parabéns por monetizar seu charme!`,
          `Uau! R$${valorFormatado} por alguns minutos de flerte? Sua dignidade vale menos do que imaginei.`,
          `R$${valorFormatado} na conta! Parece que alguém achou que sua companhia vale mais que um jantar barato.`,
          `Ganhou R$${valorFormatado} seduzindo alguém. Você seria ótimo vendendo carros usados!`
        ],
        perdeu: [
          `Gastou R$${valorFormatado} tentando seduzir alguém que claramente tem padrões. Que embaraçoso.`,
          `Perdeu R$${valorFormatado} na tentativa. Nem seu dinheiro conseguiu compensar sua falta de personalidade.`,
          `R$${valorFormatado} jogados fora! Talvez um curso de autoajuda seja um investimento melhor.`,
          `Menos R$${valorFormatado} na conta. Nem pagando consegue que alguém te suporte por mais de 5 minutos.`
        ]
      },
      crime: {
        ganhou: [
          `Você roubou R$${valorFormatado} e não foi pego. Ótimo começo para sua carreira no crime!`,
          `R$${valorFormatado} obtidos ilegalmente! Sua família estaria orgulhosa... ou não.`,
          `Ganhou R$${valorFormatado} com atividades questionáveis. Pelo menos não precisou declarar no imposto de renda.`,
          `R$${valorFormatado} de lucro no crime! Quem precisa de trabalho honesto quando se tem tão pouca moral?`
        ],
        perdeu: [
          `Tentou ser criminoso e perdeu R$${valorFormatado}. Nem para o crime você serve.`,
          `R$${valorFormatado} de prejuízo! Criminoso incompetente é pleonasmo no seu caso.`,
          `Perdeu R$${valorFormatado} tentando cometer um crime. Isso é o que chamam de taxa de burrice.`,
          `Menos R$${valorFormatado} por ser um criminoso de quinta categoria. Melhor voltar a vender bolo de pote.`
        ]
      }
    };
    
    // Selecionar uma resposta aleatória
    let respostas = [];
    if (comando === 'trabalhar') {
      respostas = fallbackRespostas.trabalhar;
    } else if (comando === 'seduzir') {
      respostas = ganhou ? fallbackRespostas.seduzir.ganhou : fallbackRespostas.seduzir.perdeu;
    } else if (comando === 'crime') {
      respostas = ganhou ? fallbackRespostas.crime.ganhou : fallbackRespostas.crime.perdeu;
    }
    
    const indiceAleatorio = Math.floor(Math.random() * respostas.length);
    return respostas[indiceAleatorio];
  }

  /**
   * Gera uma resposta com base em um prompt
   * @param {string} prompt - O prompt para enviar à API Gemini
   * @returns {Promise<string>} - A resposta gerada
   */
  async generateResponse(prompt) {
    if (!this.validApiKey) {
      return 'Não foi possível gerar uma resposta criativa. A API Gemini não está configurada corretamente.';
    }
    
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
    if (!this.validApiKey) {
      return this.generateFallbackResponse('trabalhar', valor);
    }
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase humorística, sarcástica e com humor negro pesado para o comando /trabalhar de um bot de Discord. 
    A frase deve conter o valor R$${valor} de forma natural e explícita.
    O usuário ganhou esse valor "trabalhando". 
    Seja criativo, cínico e use ironia. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    try {
      return await this.generateResponse(prompt);
    } catch (error) {
      console.error('Erro ao gerar resposta para trabalhar:', error);
      return this.generateFallbackResponse('trabalhar', valor);
    }
  }

  /**
   * Gera uma resposta para o comando seduzir
   * @param {number} valor - Valor ganho/perdido
   * @param {boolean} ganhou - Se o usuário ganhou ou perdeu
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaSeduzir(valor, ganhou) {
    if (!this.validApiKey) {
      return this.generateFallbackResponse('seduzir', valor, ganhou);
    }
    
    const valorFormatado = ganhou ? `R$${valor}` : `-R$${Math.abs(valor)}`;
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase humorística, provocativa e ofensiva para o comando /seduzir de um bot de Discord.
    O usuário ${ganhou ? 'ganhou' : 'perdeu'} ${valorFormatado} tentando seduzir alguém. 
    A frase deve conter o valor ${valorFormatado} de forma natural e explícita.
    Seja criativo, cínico e use tom provocativo e ofensivo. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    try {
      return await this.generateResponse(prompt);
    } catch (error) {
      console.error('Erro ao gerar resposta para seduzir:', error);
      return this.generateFallbackResponse('seduzir', valor, ganhou);
    }
  }

  /**
   * Gera uma resposta para o comando crime
   * @param {number} valor - Valor ganho/perdido
   * @param {boolean} ganhou - Se o usuário ganhou ou perdeu
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaCrime(valor, ganhou) {
    if (!this.validApiKey) {
      return this.generateFallbackResponse('crime', valor, ganhou);
    }
    
    const valorFormatado = ganhou ? `R$${valor}` : `-R$${Math.abs(valor)}`;
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere uma frase sombria, ácida e sem filtros para o comando /crime de um bot de Discord.
    O usuário ${ganhou ? 'lucrou' : 'perdeu'} ${valorFormatado} ao tentar cometer um crime.
    A frase deve embutir claramente o valor em reais (${valorFormatado}) de forma natural e explícita.
    Seja criativo, cínico e use tom sombrio. Faça referência a crimes específicos. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a frase, sem explicações adicionais.
    `;
    
    try {
      return await this.generateResponse(prompt);
    } catch (error) {
      console.error('Erro ao gerar resposta para crime:', error);
      return this.generateFallbackResponse('crime', valor, ganhou);
    }
  }

   /**
   * Gera uma resposta para o comando roubar
   * @param {number} valor - Valor roubado/multa
   * @param {boolean} sucesso - Se o roubo foi bem-sucedido
   * @param {string} nomeAlvo - Nome do alvo do roubo
   * @returns {Promise<string>} - Resposta gerada
   */
   async gerarRespostaRoubo(valor, sucesso, nomeAlvo) {
    if (!this.validApiKey) {
      return sucesso 
        ? `Você roubou R$${valor.toFixed(2)} de ${nomeAlvo}. Criminoso de sucesso, parabéns!`
        : `Tentou roubar ${nomeAlvo}, foi pego e pagou R$${valor.toFixed(2)} de multa. Criminoso iniciante!`;
    }
    
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
    
    try {
      return await this.generateResponse(prompt);
    } catch (error) {
      console.error('Erro ao gerar resposta para roubo:', error);
      return sucesso 
        ? `Você roubou R$${valor.toFixed(2)} de ${nomeAlvo}. Criminoso de sucesso, parabéns!`
        : `Tentou roubar ${nomeAlvo}, foi pego e pagou R$${valor.toFixed(2)} de multa. Criminoso iniciante!`;
    }
  }

  /**
   * Gera um motivo para transferência PIX
   * @param {string} remetente - Nome do remetente
   * @param {string} destinatario - Nome do destinatário
   * @param {number} valor - Valor transferido
   * @returns {Promise<string>} - Motivo gerado
   */
  async gerarMotivoPix(remetente, destinatario, valor) {
    if (!this.validApiKey) {
      return `Transferência de R$${valor.toFixed(2)} de ${remetente} para ${destinatario}`;
    }
    
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Gere um motivo criativo, irônico e com humor negro leve para uma transferência PIX entre usuários do Discord.
    O usuário ${remetente} transferiu R$${valor.toFixed(2)} para ${destinatario}.
    O motivo deve ser breve, criativo e engraçado, podendo fazer referências a contextos absurdos, ilegais ou constrangedores de forma leve e cômica.
    Seja criativo e certifique-se de incluir o valor transferido de forma natural na explicação.
    Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com o motivo, sem explicações adicionais.
    `;
    
    try {
      return await this.generateResponse(prompt);
    } catch (error) {
      console.error('Erro ao gerar motivo para PIX:', error);
      return `Transferência de R$${valor.toFixed(2)} de ${remetente} para ${destinatario}`;
    }
  }
}

// Criar uma instância do cliente e exportá-la
const geminiClient = new GeminiClient();
export default geminiClient;