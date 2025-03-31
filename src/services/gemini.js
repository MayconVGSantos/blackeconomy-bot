// gemini.js
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Cliente otimizado para a API Gemini
 * Utilizando o modelo Gemini 2.0 Flash para melhor desempenho,
 * respostas mais criativas e tratamento de erros aprimorado
 */
class GeminiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.apiKey);

    // Configurar modelo com configurações otimizadas para respostas criativas
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.9, // Maior temperatura para respostas mais criativas
        topP: 0.95, // Amostragem de probabilidade mais diversa
        topK: 40, // Maior diversidade de tokens
        maxOutputTokens: 150, // Limite de tokens para resposta concisa
      },
      safetySettings: [
        // Configurações de segurança mais permissivas para humor negro
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  /**
   * Gera uma resposta para o comando diario
   * @param {number} valor - Valor ganho em dinheiro
   * @param {number} fichas - Quantidade de fichas ganhas
   * @param {number} streak - Streak atual
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaDiario(valor, fichas, streak) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Crie uma mensagem engraçada e com humor negro leve para o comando /diario de um bot de Discord.
    O usuário acabou de coletar R$${valor} e ${fichas} fichas de cassino como recompensa diária.
    Seu streak atual é de ${streak} ${streak === 1 ? "dia" : "dias"}.
    
    A mensagem deve incorporar o valor e a quantidade de fichas de forma natural e soar motivadora para que o usuário volte no dia seguinte.
    Seja criativo e divertido. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a mensagem, sem explicações adicionais.
    `;

    return this.generateResponse(prompt);
  }

  /**
   * Gera uma resposta para o comando semanal
   * @param {number} valor - Valor ganho em dinheiro
   * @param {number} fichas - Quantidade de fichas ganhas
   * @param {number} streak - Streak atual
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaSemanal(valor, fichas, streak) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Crie uma mensagem engraçada e com humor negro leve para o comando /semanal de um bot de Discord.
    O usuário acabou de coletar R$${valor} e ${fichas} fichas de cassino como recompensa semanal.
    Seu streak atual é de ${streak} ${streak === 1 ? "semana" : "semanas"}.
    
    A mensagem deve incorporar o valor e a quantidade de fichas de forma natural e soar como uma "grande recompensa" comparada à diária.
    Seja criativo, use um tom exagerado para destacar que é uma recompensa maior. Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com a mensagem, sem explicações adicionais.
    `;

    return this.generateResponse(prompt);
  }

  /**
   * Gera uma resposta com base em um prompt
   * Implementa retry e timeout para maior confiabilidade
   * @param {string} prompt - O prompt para enviar à API Gemini
   * @param {number} [maxRetries=2] - Número máximo de tentativas
   * @returns {Promise<string>} - A resposta gerada
   */
  async generateResponse(prompt, maxRetries = 2) {
    let retries = 0;
    let lastError = null;

    while (retries <= maxRetries) {
      try {
        // Implementar timeout para evitar esperas longas
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout na requisição para API Gemini")),
            10000
          )
        );

        const responsePromise = this.model.generateContent(prompt);
        const result = await Promise.race([responsePromise, timeoutPromise]);
        const response = await result.response;

        // Validar resposta
        const text = response.text().trim();
        if (!text) {
          throw new Error("Resposta vazia da API Gemini");
        }

        return text;
      } catch (error) {
        lastError = error;
        console.error(
          `Tentativa ${retries + 1}/${maxRetries + 1} falhou:`,
          error.message
        );
        retries++;

        // Aguardar um pouco mais a cada retry (backoff exponencial)
        if (retries <= maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, retries))
          );
        }
      }
    }

    console.error("Todas as tentativas à API Gemini falharam:", lastError);
    return this.getFallbackResponse();
  }

  /**
   * Retorna uma resposta de fallback quando a API falha
   * @returns {string} - Resposta de fallback genérica
   */
  getFallbackResponse() {
    const respostas = [
      "Após muito trabalho, você conseguiu um valor razoável para suas despesas.",
      "Seu esforço foi recompensado com um montante interessante.",
      "Nem sempre o que fazemos vale o que recebemos, mas desta vez você teve sorte.",
      "O mundo é cruel, mas às vezes ele te dá uma pausa e te recompensa.",
    ];

    return respostas[Math.floor(Math.random() * respostas.length)];
  }

  /**
   * Gera uma resposta para o comando trabalhar
   * @param {number} valor - Valor ganho
   * @returns {Promise<string>} - Resposta gerada
   */
  async gerarRespostaTrabalhar(valor) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Crie uma frase humorística, sarcástica e com humor negro pesado para o comando /trabalhar de um bot de Discord. 
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
    
    Crie uma frase humorística, provocativa e com humor negro para o comando /seduzir de um bot de Discord.
    O usuário ${
      ganhou ? "ganhou" : "perdeu"
    } ${valorFormatado} tentando seduzir alguém. 
    A frase deve incorporar o valor ${valorFormatado} de forma natural e explícita.
    Seja criativo, cínico e use tom provocativo. Limite a resposta a 1-2 frases curtas.
    
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
    
    Crie uma frase sombria, ácida e sem filtros para o comando /crime de um bot de Discord.
    O usuário ${
      ganhou ? "lucrou" : "perdeu"
    } ${valorFormatado} ao tentar cometer um crime.
    A frase deve embutir claramente o valor em reais (${valorFormatado}) de forma natural e explícita.
    Seja criativo, cínico e use tom sombrio. Faça referência a crimes específicos como assalto, fraude, tráfico, etc. Limite a resposta a 1-2 frases curtas.
    
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
      
      Crie uma frase sarcástica e com humor negro pesado para um comando de roubo bem-sucedido em um bot de Discord.
      O usuário roubou R$${valor.toFixed(2)} de ${nomeAlvo}.
      A frase deve conter o valor roubado de forma natural e explícita.
      Seja criativo e use um tom irônico ou provocativo. Limite a resposta a 1-2 frases curtas.
      
      Responda apenas com a frase, sem explicações adicionais.
      `
      : `
      Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
      
      Crie uma frase sarcástica e com humor negro pesado para um comando de roubo que falhou em um bot de Discord.
      O usuário tentou roubar ${nomeAlvo}, foi pego e pagou uma multa de R$${valor.toFixed(
          2
        )}.
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
    
    Crie um motivo criativo, irônico e com humor negro leve para uma transferência PIX entre usuários do Discord.
    O usuário ${remetente} transferiu R$${valor.toFixed(
      2
    )} para ${destinatario}.
    O motivo deve ser breve, criativo e engraçado, podendo fazer referências a contextos absurdos, ilegais ou constrangedores de forma leve e cômica.
    Seja criativo e certifique-se de incluir o valor transferido de forma natural na explicação.
    Limite a resposta a 1-2 frases curtas.
    
    Responda apenas com o motivo, sem explicações adicionais.
    `;

    return this.generateResponse(prompt);
  }

  /**
   * Gera uma descrição de item para a loja
   * @param {string} itemName - Nome do item
   * @param {string} itemType - Tipo do item (consumível, boost, VIP)
   * @param {number} price - Preço do item
   * @returns {Promise<string>} - Descrição gerada
   */
  async gerarDescricaoItem(itemName, itemType, price) {
    const prompt = `
    Você é um assistente de bot de economia do Discord que gera respostas em português brasileiro.
    
    Crie uma descrição curta e atrativa para um item da loja virtual chamado "${itemName}" que custa R$${price.toFixed(
      2
    )}.
    Este é um item do tipo "${itemType}".
    A descrição deve ser breve (até 30 palavras), atraente e com um toque de humor.
    
    Responda apenas com a descrição, sem explicações adicionais.
    `;

    return this.generateResponse(prompt);
  }
}

export default new GeminiClient();
