// config/config.js - Versão com economia rebalanceada
import dotenv from "dotenv";

// Garantir que dotenv seja carregado
dotenv.config();

// Log para debug
console.log("Carregando configurações...");
console.log(
  `DISCORD_TOKEN disponível: ${process.env.DISCORD_TOKEN ? "Sim" : "Não"}`
);
console.log(`CLIENT_ID disponível: ${process.env.CLIENT_ID ? "Sim" : "Não"}`);

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  economia: {
    // Recompensas de trabalhar REDUZIDAS
    trabalhar: {
      min: 10, // Antes: 20
      max: 80, // Antes: 250
    },
    // Recompensas e penalidades de seduzir AJUSTADAS
    seduzir: {
      min: 40, // Antes: 50
      max: 160, // Antes: 200
      perda: {
        min: 0.2, // Aumentado: antes 0.15
        max: 0.4, // Aumentado: antes 0.30
      },
      // Taxa de sucesso menor: 40% em vez de 50%
      taxaSucesso: 0.4,
    },
    // Recompensas e penalidades de crime AJUSTADAS
    crime: {
      min: 60, // Antes: 100
      max: 250, // Antes: 350
      perda: {
        min: 0.35, // Aumentado: antes 0.30
        max: 0.7, // Aumentado: antes 0.60
      },
      // Taxa de sucesso menor: 45% em vez de 50%
      taxaSucesso: 0.45,
    },
    // Configurações para roubo
    roubar: {
      // Percentual mínimo e máximo da vítima que pode ser roubado
      min: 0.08, // Antes: 0.10
      max: 0.25, // Antes: 0.30 ou 0.40
      // Taxa de sucesso base
      taxaSuccessoBase: 0.4, // Antes: 0.50 ou não especificado
      // Multa se for pego: percentual do próprio saldo
      multaMin: 0.15, // Antes: 0.10
      multaMax: 0.25, // Antes: 0.20
    },
    // Taxa para troca de fichas por dinheiro
    taxaTrocaFichas: 0.15, // Antes: 0.10 (15% em vez de 10%)
    // Multiplicadores para cassino (ajustados para menor retorno)
    cassino: {
      // Valor de compra: 1 ficha = R$ 10
      // Valor de venda: 1 ficha = R$ 8,50 (após taxa de 15%)
      multiplicadoresSlots: {
        simbolosIguais3: 8, // Antes: 10
        simbolosIguais2: 3, // Antes: 4
        jackpot: 20, // Antes: 25
      },
      multiplicadoresRoleta: {
        numero: 31, // Antes: 36
        cor: 1.9, // Antes: 2
        parImpar: 1.9, // Antes: 2
        duziaColuna: 2.8, // Antes: 3
      },
      multiplicadoresDados: {
        numerosComuns: {
          7: 4, // Antes: 5
          6: 5, // Antes: 6
          8: 5, // Antes: 6
        },
        numerosRaros: {
          2: 30, // Antes: 35
          3: 15, // Antes: 17
          4: 10, // Antes: 11
          5: 7, // Antes: 8
          9: 7, // Antes: 8
          10: 10, // Antes: 11
          11: 15, // Antes: 17
          12: 30, // Antes: 35
        },
      },
      blackjack: {
        vitoria: 1.9, // Antes: 2
        blackjack: 2.3, // Antes: 2.5
        empate: 1, // Igual: devolve a aposta
      },
    },
  },
  cooldown: {
    trabalhar: 20, // Aumentado: antes 15 minutos
    seduzir: 40, // Aumentado: antes 30 minutos
    crime: 75, // Aumentado: antes 60 minutos
    roubar: 90, // Aumentado: antes 60 minutos
    estudar: 1440, // 24 horas (em minutos)
  },
  firebase: {
    apiKey:
      process.env.FIREBASE_API_KEY || "AIzaSyCe_5sZfPnyByoB-gI7ebKbaS8yy7cawEg",
    authDomain: `${
      process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"
    }.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac",
    storageBucket: `${
      process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"
    }.firebasestorage.app`,
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID || "394363116218",
    appId:
      process.env.FIREBASE_APP_ID ||
      "1:394363116218:web:9fff42705eaef4f5800083",
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      "https://blackeconomy-874ac-default-rtdb.firebaseio.com",
  },
  educacao: {
    // Configurações para o sistema educacional (AUMENTADOS)
    custos: {
      fundamental: 0, // Gratuito
      medio: 3500, // Antes: 3000
      tecnico: {
        base: 18000, // Antes: 15000
        informatica: 24000, // Antes: 20000
        administracao: 13000, // Antes: 10000
        enfermagem: 18000, // Antes: 15000
        mecanica: 22000, // Antes: 18000
        eletricidade: 19000, // Antes: 16000
        seguranca: 15000, // Antes: 12000
      },
      graduacao: {
        base: 60000, // Antes: 50000
        medicina: 95000, // Antes: 80000
        direito: 70000, // Antes: 60000
        engenharia_civil: 82000, // Antes: 70000
        engenharia_eletrica: 78000, // Antes: 65000
        engenharia_mecanica: 78000, // Antes: 65000
        engenharia_software: 72000, // Antes: 60000
        administracao: 48000, // Antes: 40000
        economia: 54000, // Antes: 45000
        contabilidade: 42000, // Antes: 35000
        psicologia: 60000, // Antes: 50000
        arquitetura: 66000, // Antes: 55000
        computacao: 66000, // Antes: 55000
        marketing: 36000, // Antes: 30000
      },
      pos_graduacao: 48000, // Antes: 40000
      doutorado: 120000, // Antes: 100000
    },
    // Mesmos valores do anterior
    bolsa: {
      moralidadeMinima: 30, // Moralidade mínima para bolsa
      descontoMinimo: 30, // Desconto mínimo (%)
      descontoMaximo: 50, // Desconto máximo (%)
    },
    exame: {
      pontosMinimos: 0.5, // 50% dos pontos necessários para fazer exame
      diasEntreExames: 10, // Dias entre exames
      bonusAprovacao: 3, // Pontos extras por aprovar
      penalReprovacao: 1, // Pontos perdidos por reprovar
    },
  },
  // Ajustes nas recompensas diárias e semanais
  recompensas: {
    diaria: {
      base: 80, // Antes: 100
      bonusPorStreak: 12, // Antes: 15
      maximo: 320, // Antes: 400
    },
    semanal: {
      base: 400, // Antes: 500
      bonusPorStreak: 75, // Antes: 100
      maximo: 1200, // Antes: 1500
    },
  },
  // Ajuste no sistema de loja
  loja: {
    fichas: {
      // Pacote 100 fichas
      pequeno: {
        quantidade: 100,
        preco: 1200, // Antes: 1000 (agora: R$12 por ficha)
      },
      // Pacote 500 fichas
      medio: {
        quantidade: 500,
        preco: 5500, // Antes: 4500 (agora: R$11 por ficha)
      },
      // Pacote 1000 fichas
      grande: {
        quantidade: 1000,
        preco: 10000, // Antes: 8000 (agora: R$10 por ficha)
      },
    },
  },
};
