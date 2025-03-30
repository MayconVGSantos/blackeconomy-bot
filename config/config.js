// config/config.js
export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY
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
        min: 0.10, // 10%
        max: 0.20  // 20%
      }
    },
    crime: {
      min: 250,
      max: 700,
      perda: {
        min: 0.20, // 20%
        max: 0.40  // 40%
      }
    }
  },
  cooldown: {
    trabalhar: parseInt(process.env.COOLDOWN_TRABALHAR) || 15, // Em minutos
    seduzir: parseInt(process.env.COOLDOWN_SEDUZIR) || 30,     // Em minutos
    crime: parseInt(process.env.COOLDOWN_CRIME) || 60,         // Em minutos
    roubar: parseInt(process.env.COOLDOWN_ROUBAR) || 60        // Em minutos
  },
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCe_5sZfPnyByoB-gI7ebKbaS8yy7cawEg",
    authDomain: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac",
    storageBucket: `${process.env.FIREBASE_PROJECT_ID || "blackeconomy-874ac"}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "394363116218",
    appId: process.env.FIREBASE_APP_ID || "1:394363116218:web:9fff42705eaef4f5800083",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://blackeconomy-874ac-default-rtdb.firebaseio.com"
  }
};