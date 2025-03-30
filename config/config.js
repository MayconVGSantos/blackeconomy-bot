// config.js
import dotenv from 'dotenv';

dotenv.config();

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.0-flash" // Usando o modelo mais recente e eficiente
  },
  economia: {
    trabalhar: {
      min: 20,
      max: 250
    },
    seduzir: {
      min: 100,
      max: 400,
      perda: {
        min: 0.1, // 10%
        max: 0.2  // 20%
      }
    },
    crime: {
      min: 250,
      max: 700,
      perda: {
        min: 0.2, // 20%
        max: 0.4  // 40%
      }
    },
    roubar: {
      multa: {
        min: 0.1, // 10%
        max: 0.3  // 30%
      }
    }
  },
  cooldown: {
    trabalhar: parseInt(process.env.COOLDOWN_TRABALHAR) || 15,     // minutos
    seduzir: parseInt(process.env.COOLDOWN_SEDUZIR) || 30,         // minutos
    crime: parseInt(process.env.COOLDOWN_CRIME) || 60,             // minutos
    roubar: parseInt(process.env.COOLDOWN_ROUBAR) || 60            // minutos
  }
};

export default config;