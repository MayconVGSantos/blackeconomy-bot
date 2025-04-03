// education.js
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  increment,
} from "firebase/database";
import { initializeApp } from "firebase/app";
import config from "../../config/config.js";
import dotenv from "dotenv";

dotenv.config();

// Configuração do Firebase (mesmo modelo dos outros serviços)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || config.firebase.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || config.firebase.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || config.firebase.projectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || config.firebase.storageBucket,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    config.firebase.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || config.firebase.appId,
  databaseURL: process.env.FIREBASE_DATABASE_URL || config.firebase.databaseURL,
};

// Reutilizar a app existente ou criar uma nova
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  app = initializeApp(firebaseConfig, "education-service");
}

/**
 * Serviço para gerenciar o sistema educacional
 */
class EducationService {
  constructor() {
    // Definir níveis educacionais e seus requisitos
    this.EDUCATION_LEVELS = {
      fundamental: {
        name: "Ensino Fundamental",
        points: 7, // Pontos necessários para completar
        cost: 0, // Gratuito
        icon: "📚",
        prerequisite: null, // Não tem pré-requisito
      },
      medio: {
        name: "Ensino Médio",
        points: 15,
        cost: 3000,
        icon: "📘",
        prerequisite: "fundamental",
      },
      tecnico: {
        name: "Ensino Técnico",
        points: 30,
        cost: 15000, // Custo médio entre os cursos técnicos
        icon: "🔧",
        prerequisite: "medio",
        // Áreas técnicas disponíveis
        areas: {
          informatica: { name: "Técnico em Informática", cost: 20000 },
          administracao: { name: "Técnico em Administração", cost: 10000 },
          enfermagem: { name: "Técnico em Enfermagem", cost: 15000 },
          mecanica: { name: "Técnico em Mecânica", cost: 18000 },
          eletricidade: { name: "Técnico em Eletricidade", cost: 16000 },
          seguranca: { name: "Técnico em Segurança", cost: 12000 },
        },
      },
      graduacao: {
        name: "Graduação",
        points: 60,
        cost: 50000, // Custo médio entre os cursos de graduação
        icon: "🎓",
        prerequisite: "medio",
        // Cursos de graduação disponíveis
        areas: {
          medicina: { name: "Medicina", cost: 80000 },
          direito: { name: "Direito", cost: 60000 },
          engenharia_civil: { name: "Engenharia Civil", cost: 70000 },
          engenharia_eletrica: { name: "Engenharia Elétrica", cost: 65000 },
          engenharia_mecanica: { name: "Engenharia Mecânica", cost: 65000 },
          engenharia_software: { name: "Engenharia de Software", cost: 60000 },
          administracao: { name: "Administração", cost: 40000 },
          economia: { name: "Economia", cost: 45000 },
          contabilidade: { name: "Contabilidade", cost: 35000 },
          psicologia: { name: "Psicologia", cost: 50000 },
          arquitetura: { name: "Arquitetura", cost: 55000 },
          computacao: { name: "Ciência da Computação", cost: 55000 },
          marketing: { name: "Marketing", cost: 30000 },
        },
      },
      pos_graduacao: {
        name: "Pós-Graduação",
        points: 30,
        cost: 40000, // Custo médio
        icon: "🔬",
        prerequisite: "graduacao",
        // Requer uma graduação completa na área relacionada
      },
      doutorado: {
        name: "Doutorado",
        points: 60,
        cost: 100000,
        icon: "🧪",
        prerequisite: "pos_graduacao",
        // Requer uma pós-graduação completa
      },
    };
  }

  /**
   * Inicializa os dados educacionais de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Dados educacionais
   */
  async initUserEducation(userId) {
    try {
      const database = getDatabase();
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        // Se o usuário existe mas não tem dados educacionais, inicializa
        if (!userData.education) {
          const initialEducation = {
            currentLevel: "fundamental", // Todos começam no ensino fundamental
            currentPoints: 0, // Pontos iniciais
            completedLevels: {}, // Níveis completados
            studyStreak: 0, // Sequência de dias estudando
            lastStudyDate: null, // Última data de estudo
            nextExamDate: null, // Data do próximo exame
            examsTaken: 0, // Número de exames realizados
            examsPassed: 0, // Número de exames aprovados
          };

          await update(userRef, { education: initialEducation });
          return initialEducation;
        }

        return userData.education;
      } else {
        // Se o usuário não existir, retorna null
        return null;
      }
    } catch (error) {
      console.error("Erro ao inicializar dados educacionais:", error);
      throw error;
    }
  }

  /**
   * Obtém os dados educacionais de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Dados educacionais
   */
  async getUserEducation(userId) {
    try {
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);
      const snapshot = await get(educationRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        // Se não existir, inicializa e retorna
        return this.initUserEducation(userId);
      }
    } catch (error) {
      console.error("Erro ao obter dados educacionais:", error);
      throw error;
    }
  }

  /**
   * Verifica se o usuário tem saldo suficiente para o nível educacional
   * @param {string} userId - ID do usuário
   * @param {string} level - Nível educacional
   * @param {string} [area] - Área específica (opcional)
   * @returns {Promise<boolean>} - True se tiver saldo suficiente
   */
  async hasEnoughBalance(userId, level, area = null) {
    try {
      // Importar firebaseService para verificar saldo
      const firebaseService = (await import("./firebase.js")).default;
      const userData = await firebaseService.getUserData(userId);
      const userBalance = userData.saldo || 0;

      // Obter o custo do nível
      let cost = this.EDUCATION_LEVELS[level].cost;

      // Se tiver área específica, ajustar o custo
      if (
        area &&
        this.EDUCATION_LEVELS[level].areas &&
        this.EDUCATION_LEVELS[level].areas[area]
      ) {
        cost = this.EDUCATION_LEVELS[level].areas[area].cost;
      }

      return userBalance >= cost;
    } catch (error) {
      console.error("Erro ao verificar saldo:", error);
      return false;
    }
  }

  /**
   * Verifica se o usuário concluiu o pré-requisito para o nível
   * @param {string} userId - ID do usuário
   * @param {string} level - Nível educacional
   * @returns {Promise<boolean>} - True se tiver concluído o pré-requisito
   */
  async hasCompletedPrerequisite(userId, level) {
    try {
      const prerequisite = this.EDUCATION_LEVELS[level].prerequisite;

      // Se não tiver pré-requisito, retorna true
      if (!prerequisite) {
        return true;
      }

      const educationData = await this.getUserEducation(userId);
      return (
        educationData.completedLevels &&
        educationData.completedLevels[prerequisite]
      );
    } catch (error) {
      console.error("Erro ao verificar pré-requisito:", error);
      return false;
    }
  }

  /**
   * Inicia um novo nível educacional para o usuário
   * @param {string} userId - ID do usuário
   * @param {string} level - Nível educacional
   * @param {string} [area] - Área específica (opcional)
   * @returns {Promise<boolean>} - True se iniciou com sucesso
   */
  async startEducationLevel(userId, level, area = null) {
    try {
      // Verificar se o nível existe
      if (!this.EDUCATION_LEVELS[level]) {
        return false;
      }

      // Verificar se concluiu o pré-requisito
      const hasPrerequisite = await this.hasCompletedPrerequisite(
        userId,
        level
      );
      if (!hasPrerequisite) {
        return false;
      }

      // Verificar se tem saldo suficiente
      const hasBalance = await this.hasEnoughBalance(userId, level, area);
      if (!hasBalance) {
        return false;
      }

      // Calcular o custo
      let cost = this.EDUCATION_LEVELS[level].cost;
      if (
        area &&
        this.EDUCATION_LEVELS[level].areas &&
        this.EDUCATION_LEVELS[level].areas[area]
      ) {
        cost = this.EDUCATION_LEVELS[level].areas[area].cost;
      }

      // Debitar o saldo
      const firebaseService = (await import("./firebase.js")).default;
      await firebaseService.updateUserBalance(userId, -cost);

      // Atualizar os dados educacionais
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);

      await update(educationRef, {
        currentLevel: level,
        currentPoints: 0,
        selectedArea: area,
        nextExamDate: Date.now() + 10 * 24 * 60 * 60 * 1000, // 10 dias para o próximo exame
      });

      return true;
    } catch (error) {
      console.error("Erro ao iniciar nível educacional:", error);
      throw error;
    }
  }

  /**
   * Estuda para ganhar pontos de educação
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado do estudo
   */
  async study(userId) {
    try {
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);
      const snapshot = await get(educationRef);

      if (!snapshot.exists()) {
        await this.initUserEducation(userId);
        return this.study(userId);
      }

      const educationData = snapshot.val();
      const now = Date.now();
      const lastStudyDate = educationData.lastStudyDate;

      // Verificar se já estudou hoje (24h)
      if (lastStudyDate && now - lastStudyDate < 24 * 60 * 60 * 1000) {
        return {
          success: false,
          error: "cooldown",
          timeRemaining: 24 * 60 * 60 * 1000 - (now - lastStudyDate),
        };
      }

      // Verificar se há um nível atual
      const currentLevel = educationData.currentLevel;
      if (!currentLevel || !this.EDUCATION_LEVELS[currentLevel]) {
        return {
          success: false,
          error: "no_level",
        };
      }

      // Calcular pontos de estudo base
      let studyPoints = 1;

      // Verificar streak diário
      let streak = educationData.studyStreak || 0;
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toDateString();
      const lastStudyDay = lastStudyDate
        ? new Date(lastStudyDate).toDateString()
        : null;

      if (lastStudyDay === yesterday) {
        // Mantém ou aumenta o streak
        streak++;
      } else if (lastStudyDate) {
        // Quebra o streak (mas não no primeiro estudo)
        streak = 0;
      }

      // Bônus por moralidade positiva
      const moralityService = (await import("./morality.js")).default;
      const morality = await moralityService.getMorality(userId);

      if (morality > 0) {
        // Bônus de até 0.5 para moralidade máxima (100)
        studyPoints += morality / 200;
      }

      // Bônus por materiais de estudo (a ser implementado na fase de aprimoramentos)
      // studyPoints += 0.5; // Temporariamente desabilitado

      // Bônus por mentoria (a ser implementado na fase de aprimoramentos)
      // studyPoints += 1.0; // Temporariamente desabilitado

      // Arredondar para uma casa decimal
      studyPoints = Math.round(studyPoints * 10) / 10;

      // Verificar se está na hora de um exame
      let examRequired = false;
      if (educationData.nextExamDate && now >= educationData.nextExamDate) {
        examRequired = true;
      }

      // Atualizar os pontos e a data de estudo
      const currentPoints = (educationData.currentPoints || 0) + studyPoints;
      const updates = {
        currentPoints: currentPoints,
        lastStudyDate: now,
        studyStreak: streak,
      };

      await update(educationRef, updates);

      // Verificar se completou o nível
      const levelCompleted =
        currentPoints >= this.EDUCATION_LEVELS[currentLevel].points;

      return {
        success: true,
        studyPoints,
        currentPoints,
        currentLevel,
        levelCompleted,
        examRequired,
        streak,
      };
    } catch (error) {
      console.error("Erro ao estudar:", error);
      throw error;
    }
  }

  /**
   * Realiza um exame para avançar no nível educacional
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado do exame
   */
  async takeExam(userId) {
    try {
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);
      const snapshot = await get(educationRef);

      if (!snapshot.exists()) {
        await this.initUserEducation(userId);
        return {
          success: false,
          error: "no_education_data",
        };
      }

      const educationData = snapshot.val();
      const currentLevel = educationData.currentLevel;
      const currentPoints = educationData.currentPoints || 0;

      // Verificar se há um nível atual
      if (!currentLevel || !this.EDUCATION_LEVELS[currentLevel]) {
        return {
          success: false,
          error: "no_level",
        };
      }

      // Verificar se tem pontos suficientes para fazer o exame
      const requiredPoints = this.EDUCATION_LEVELS[currentLevel].points * 0.5; // 50% dos pontos necessários
      if (currentPoints < requiredPoints) {
        return {
          success: false,
          error: "insufficient_points",
          currentPoints,
          requiredPoints,
        };
      }

      // Calcular probabilidade de aprovação com base nos pontos
      const passPercentage = Math.min(
        95, // Máximo de 95% de chance
        50 + (currentPoints / this.EDUCATION_LEVELS[currentLevel].points) * 50 // 50% base + até 50% adicional
      );

      // Determinar se passou no exame
      const passed = Math.random() * 100 < passPercentage;

      // Atualizar dados do exame
      const examsTaken = (educationData.examsTaken || 0) + 1;
      const examsPassed = passed
        ? (educationData.examsPassed || 0) + 1
        : educationData.examsPassed || 0;

      const updates = {
        examsTaken,
        examsPassed,
      };

      // Se passou, adicionar pontos bônus
      if (passed) {
        updates.currentPoints = currentPoints + 3;
      } else {
        // Se falhou, perder 1 dia de progresso
        updates.currentPoints = Math.max(0, currentPoints - 1);
      }

      // Definir a data do próximo exame
      updates.nextExamDate = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 dias

      await update(educationRef, updates);

      // Verificar se completou o nível após o exame
      const levelCompleted =
        updates.currentPoints >= this.EDUCATION_LEVELS[currentLevel].points;

      return {
        success: true,
        passed,
        currentPoints: updates.currentPoints,
        levelCompleted,
        passPercentage: Math.round(passPercentage),
      };
    } catch (error) {
      console.error("Erro ao realizar exame:", error);
      throw error;
    }
  }

  /**
   * Conclui o nível educacional atual do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado da conclusão
   */
  async completeCurrentLevel(userId) {
    try {
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);
      const snapshot = await get(educationRef);

      if (!snapshot.exists()) {
        return {
          success: false,
          error: "no_education_data",
        };
      }

      const educationData = snapshot.val();
      const currentLevel = educationData.currentLevel;
      const selectedArea = educationData.selectedArea;

      // Verificar se há um nível atual
      if (!currentLevel || !this.EDUCATION_LEVELS[currentLevel]) {
        return {
          success: false,
          error: "no_level",
        };
      }

      // Verificar se completou os pontos necessários
      const currentPoints = educationData.currentPoints || 0;
      const requiredPoints = this.EDUCATION_LEVELS[currentLevel].points;

      if (currentPoints < requiredPoints) {
        return {
          success: false,
          error: "insufficient_points",
          currentPoints,
          requiredPoints,
        };
      }

      // Atualizar os níveis completados
      const completedLevels = educationData.completedLevels || {};
      completedLevels[currentLevel] = {
        completedAt: Date.now(),
        // Só definir a área se ela existir, para evitar undefined
        ...(selectedArea ? { area: selectedArea } : {}),
      };

      // Resetar o nível atual (o usuário precisará escolher o próximo nível)
      await update(educationRef, {
        currentLevel: null,
        currentPoints: 0,
        selectedArea: null,
        completedLevels,
      });

      return {
        success: true,
        completedLevel: {
          level: currentLevel,
          name: this.EDUCATION_LEVELS[currentLevel].name,
          area: selectedArea,
          areaName:
            selectedArea && this.EDUCATION_LEVELS[currentLevel].areas
              ? this.EDUCATION_LEVELS[currentLevel].areas[selectedArea].name
              : null,
        },
      };
    } catch (error) {
      console.error("Erro ao concluir nível educacional:", error);
      throw error;
    }
  }
  /**
   * Obtém o próximo nível educacional disponível para o usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Array>} - Lista de próximos níveis disponíveis
   */
  async getNextAvailableLevels(userId) {
    try {
      const educationData = await this.getUserEducation(userId);
      const completedLevels = educationData.completedLevels || {};

      const availableLevels = [];

      for (const level in this.EDUCATION_LEVELS) {
        // Pular níveis já completados
        if (completedLevels[level]) continue;

        // Verificar pré-requisito
        const prerequisite = this.EDUCATION_LEVELS[level].prerequisite;
        if (!prerequisite || completedLevels[prerequisite]) {
          availableLevels.push({
            id: level,
            name: this.EDUCATION_LEVELS[level].name,
            icon: this.EDUCATION_LEVELS[level].icon,
            cost: this.EDUCATION_LEVELS[level].cost,
            points: this.EDUCATION_LEVELS[level].points,
            areas: this.EDUCATION_LEVELS[level].areas,
          });
        }
      }

      return availableLevels;
    } catch (error) {
      console.error("Erro ao obter próximos níveis:", error);
      throw error;
    }
  }

  /**
   * Verifica se o usuário é elegível para uma bolsa de estudos
   * @param {string} userId - ID do usuário
   * @returns {Promise<{eligible: boolean, discount: number}>} - Elegibilidade e desconto
   */
  async checkScholarshipEligibility(userId) {
    try {
      // Verificar moralidade para determinar elegibilidade para bolsa
      const moralityService = (await import("./morality.js")).default;
      const morality = await moralityService.getMorality(userId);

      // Apenas jogadores com alta moralidade são elegíveis para bolsas
      if (morality < 30) {
        return { eligible: false, discount: 0 };
      }

      // Calcular desconto baseado na moralidade (30-100)
      // Moralidade 30 = 30% de desconto, Moralidade 100 = 50% de desconto
      const discount = 30 + Math.floor(((morality - 30) / 70) * 20);

      return { eligible: true, discount };
    } catch (error) {
      console.error("Erro ao verificar elegibilidade para bolsa:", error);
      return { eligible: false, discount: 0 };
    }
  }

  /**
   * Solicita uma bolsa de estudos
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado da solicitação
   */
  async applyForScholarship(userId) {
    try {
      const { eligible, discount } = await this.checkScholarshipEligibility(
        userId
      );

      if (!eligible) {
        return {
          success: false,
          error: "not_eligible",
          message:
            "Sua moralidade não é alta o suficiente para obter uma bolsa de estudos.",
        };
      }

      // Atualizar dados do usuário com a bolsa
      const database = getDatabase();
      const educationRef = ref(database, `users/${userId}/education`);

      await update(educationRef, {
        scholarship: {
          discount,
          grantedAt: Date.now(),
        },
      });

      return {
        success: true,
        discount,
      };
    } catch (error) {
      console.error("Erro ao solicitar bolsa:", error);
      throw error;
    }
  }

  /**
   * Exibe informações educacionais formatadas para um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Informações formatadas
   */
  async getFormattedEducationInfo(userId) {
    try {
      const educationData = await this.getUserEducation(userId);
      const result = {
        current: null,
        completed: [],
        progress: 0,
        nextExamDate: null,
        scholarship: null,
      };

      // Verificar bolsa de estudos
      if (educationData.scholarship) {
        result.scholarship = {
          discount: educationData.scholarship.discount,
          grantedAt: educationData.scholarship.grantedAt,
        };
      }

      // Verificar nível atual
      if (educationData.currentLevel) {
        const levelData = this.EDUCATION_LEVELS[educationData.currentLevel];
        const currentPoints = educationData.currentPoints || 0;
        const requiredPoints = levelData.points;

        result.current = {
          level: educationData.currentLevel,
          name: levelData.name,
          icon: levelData.icon,
          currentPoints,
          requiredPoints,
          progress: Math.min(
            100,
            Math.floor((currentPoints / requiredPoints) * 100)
          ),
          area: educationData.selectedArea,
          areaName:
            educationData.selectedArea && levelData.areas
              ? levelData.areas[educationData.selectedArea].name
              : null,
        };

        result.progress = result.current.progress;
      }

      // Adicionar níveis completados
      if (educationData.completedLevels) {
        for (const level in educationData.completedLevels) {
          const levelData = this.EDUCATION_LEVELS[level];
          const completionData = educationData.completedLevels[level];

          result.completed.push({
            level,
            name: levelData.name,
            icon: levelData.icon,
            completedAt: completionData.completedAt,
            area: completionData.area,
            areaName:
              completionData.area && levelData.areas
                ? levelData.areas[completionData.area].name
                : null,
          });
        }

        // Ordenar por data de conclusão
        result.completed.sort((a, b) => a.completedAt - b.completedAt);
      }

      // Adicionar informações de exame
      if (educationData.nextExamDate) {
        result.nextExamDate = educationData.nextExamDate;
      }

      return result;
    } catch (error) {
      console.error("Erro ao formatar informações educacionais:", error);
      throw error;
    }
  }
}

// Criar instância e exportar
const educationService = new EducationService();
export default educationService;
