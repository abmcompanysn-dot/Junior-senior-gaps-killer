/**
 * @file Template - Gestion de Cours par Catégorie
 * @description Script Google Apps pour lire et assembler des données de cours structurées
 *              à partir de plusieurs feuilles dans un Google Sheet.
 * @version 1.0.2 (Correction TypeError setHeader et getCategoryName)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION ---

// URL du script central qui gère le catalogue. Ce script l'appellera pour invalider le cache.
const CENTRAL_ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbyV__ejuztXjqzNjopK6MCPItPVfPj-2_tmLHxMULghms9UmuE2wG0XWLKD5XtvlqLPjw/exec";
const ALLOWED_ORIGIN = 'https://junior-senior-gaps-killer.vercel.app'; // Domaine autorisé pour CORS

// --- GESTIONNAIRES D'ÉVÉNEMENTS (TRIGGERS) ---

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gestion des Cours')
      .addItem('🚀 Initialiser les feuilles de cours', 'setupCourseSheets')
      .addSeparator()
      .addItem('➕ Ajouter un Cours', 'addCourse')
      .addItem('➕ Ajouter un Module', 'addModule')
      .addItem('➕ Ajouter un Chapitre', 'addChapter')
      .addSeparator()
      .addItem('🗑️ Supprimer les données de démo', 'clearDemoData')
      .addSeparator()
      .addItem('Forcer la mise à jour du cache global', 'invalidateGlobalCache')
      .addToUi();
}

/**
 * Se déclenche automatiquement à chaque modification de la feuille.
 * Invalide le cache global pour que le front-end récupère les nouvelles données.
 */
function onEdit(e) {
  Logger.log("Modification détectée. Invalidation du cache global demandée.");
  invalidateGlobalCache();
}

// --- POINTS D'ENTRÉE DE L'API WEB (doGet, doPost, doOptions) ---

/**
 * Gère les requêtes OPTIONS pour le pré-vol CORS. Essentiel pour les requêtes POST.
 */
function doOptions(e) {
  // Répond aux requêtes de pré-vérification CORS
  return ContentService.createTextOutput()
    .setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    .setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- CONFIGURATION ---
const CENTRAL_SHEET_ID = "1xcW_lPim1AvD-RWDD0FtpAMYSrWq-FSv9XGa1ys2Xv4"; // IMPORTANT: ID de la feuille centrale
const DEFAULT_IMAGE_URL = "https://i.postimg.cc/D0b7ZxQc/Logo-for-Training-Platform-Dynamic-Emblem.png";


/**
 * Point d'entrée pour les requêtes GET.
 * L'action principale est `getProducts` (conservé pour la compatibilité) qui renvoie les fiches de cours complètes.
 */
function doGet(e) {
  const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
  try {
    const action = e.parameter.action;

    if (action === 'getProducts') {
      const categoryName = getCategoryName();
      const fichesCours = getAllCoursData(categoryName);
      const responseData = { success: true, data: fichesCours };
      return createJsonResponse(responseData, origin);
    }

    return createJsonResponse({ success: false, error: "Action GET non reconnue." }, origin);
  } catch (error) {
    Logger.log("ERREUR dans doGet : " + error.toString());
    return createJsonResponse({ success: false, error: error.message }, origin);
  }
}

/**
 * Point d'entrée pour les requêtes POST. Actuellement non utilisé, mais prêt pour de futures actions.
 */
function doPost(e) {
  const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
  try {
    const request = JSON.parse(e.postData.contents);
    const { action, data } = request;

    switch (action) {
      case 'addCourseFromDashboard':
        return addCourseFromDashboard(data, origin);
      default:
        return createJsonResponse({ success: false, error: `Action POST non reconnue: ${action}` }, origin);
    }

  } catch (error) {
    Logger.log("ERREUR dans doPost : " + error.toString());
    return createJsonResponse({ success: false, error: error.message }, origin);
  }
}

// --- LOGIQUE MÉTIER : ASSEMBLAGE DES DONNÉES DE COURS ---

/**
 * Fonction principale qui orchestre la récupération et l'assemblage de toutes les données de cours.
 * @param {string} categoryName - Le nom de la catégorie (ex: "Backend").
 * @returns {Array<Object>} Un tableau de fiches de cours complètes.
 */
function getAllCoursData(categoryName) {
  Logger.log(`Début de l'assemblage pour la catégorie : ${categoryName}`);

  // 1. Lire toutes les données de toutes les feuilles en une seule fois pour l'efficacité.
  const allData = {
    cours: sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Cours_${categoryName}`)),
    modules: sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Modules_${categoryName}`)),
    chapitres: sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Chapitres_${categoryName}`)),
    quizChapitres: sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Quiz_Chapitres_${categoryName}`)),
    quizModules: sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Quiz_Modules_${categoryName}`))
  };

  Logger.log(`Données brutes lues : ${allData.cours.length} cours, ${allData.modules.length} modules, ${allData.chapitres.length} chapitres.`);

  // 2. Pour chaque cours, générer sa fiche complète.
  const fichesCompletes = allData.cours.map(cours => generateFicheCours(cours.ID_Cours, allData));

  Logger.log("Toutes les fiches de cours ont été générées.");
  return fichesCompletes.filter(f => f !== null);
}

/**
 * Génère une fiche de cours complète et structurée pour un ID de cours donné.
 * @param {string} idCours - L'ID du cours à assembler.
 * @param {Object} allData - Un objet contenant les données de toutes les feuilles.
 * @returns {Object} La fiche de cours complète.
 */
function generateFicheCours(idCours, allData) {
  Logger.log(`Génération de la fiche pour le cours ID: ${idCours}`);

  // 1. Trouver le cours de base.
  const coursBase = allData.cours.find(c => c.ID_Cours == idCours);
  if (!coursBase) {
    Logger.log(`Cours ID: ${idCours} non trouvé.`);
    return null;
  }

  // 2. Récupérer les modules pour ce cours.
  const modulesDuCours = getModulesByCours(idCours, allData.modules);

  // 3. Pour chaque module, récupérer ses chapitres et ses quiz.
  modulesDuCours.forEach(module => {
    // Récupérer les chapitres du module
    const chapitresDuModule = getChapitresByModule(module.ID_Module, allData.chapitres);

    // Pour chaque chapitre, récupérer ses quiz
    chapitresDuModule.forEach(chapitre => {
      chapitre.quiz = getQuizByChapitre(chapitre.ID_Chapitre, allData.quizChapitres);
    });

    module.chapitres = chapitresDuModule;
    module.quiz = getQuizByModule(module.ID_Module, allData.quizModules);
  });

  // 4. Assembler la fiche finale.
  const ficheFinale = {
    ...coursBase,
    modules: modulesDuCours
  };

  logFiche(ficheFinale);
  return ficheFinale;
}

// --- FONCTIONS DE RÉCUPÉRATION DE DONNÉES (FILTRAGE) ---

function getModulesByCours(idCours, allModules) {
  return allModules.filter(m => m.ID_Cours == idCours).sort((a, b) => a.Ordre_Module - b.Ordre_Module);
}

function getChapitresByModule(idModule, allChapitres) {
  return allChapitres.filter(c => c.ID_Module == idModule).sort((a, b) => a.Ordre_Chapitre - b.Ordre_Chapitre);
}

function getQuizByChapitre(idChapitre, allQuiz) {
  return allQuiz.filter(q => q.ID_Chapitre == idChapitre);
}

function getQuizByModule(idModule, allQuiz) {
  return allQuiz.filter(q => q.ID_Module == idModule);
}

// --- FONCTIONS UTILITAIRES ---

/**
 * Renvoie uniquement le nom de la catégorie (ex: "Backend") à partir du nom de la feuille (ex: "Cours_Backend").
 */
function getCategoryName() {
  const sheetName = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName();
  // On retire le préfixe "Cours_" pour obtenir uniquement le nom de la catégorie
  return sheetName.replace('Cours_', '');
}

function initialiserAvecDonnéesDémos() {
  const categoryName = getCategoryName();
  seedDefaultCourseData(categoryName);
  SpreadsheetApp.getUi().alert(`Les feuilles ont été remplies avec des données d'exemple pour la catégorie "${categoryName}".`);
}
/**
 * Utilitaire pour invalider le cache global en appelant le script central.
 */
function invalidateGlobalCache() {
  // Appelle le script central pour lui dire de mettre à jour la version du cache.
  UrlFetchApp.fetch(CENTRAL_ADMIN_API_URL + "?action=invalidateCache", {
    method: 'get', muteHttpExceptions: true
  });
  Logger.log("Demande d'invalidation du cache global envoyée.");
}

/**
 * Crée une réponse JSON standard.
 * CORRECTION: Suppression des appels à setHeader qui causaient l'erreur TypeError.
 */
function createJsonResponse(data, origin) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  // La gestion CORS pour GET est assurée par la configuration du déploiement
  // et la fonction doOptions pour le pre-flight.
  return output;
}

/**
 * Utilitaire pour convertir une feuille en JSON.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - La feuille à convertir.
 * @returns {Array<Object>} Un tableau d'objets représentant les lignes.
 */
function sheetToJSON(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index];
      }
    });
    return obj;
  });
}

/**
 * Affiche une version simplifiée de la fiche de cours dans les journaux d'exécution.
 * @param {Object} fiche - La fiche de cours complète.
 */
function logFiche(fiche) {
  Logger.log(`--- FICHE COURS : ${fiche.Nom_Cours} (ID: ${fiche.ID_Cours}) ---`);
  Logger.log(`  Modules: ${fiche.modules.length}`);
  fiche.modules.forEach(m => {
    Logger.log(`    - Module: ${m.Nom_Module} (Chapitres: ${m.chapitres.length}, Quiz: ${m.quiz.length})`);
  });
  Logger.log('----------------------------------------------------');
}

/**
 * Initialise toutes les feuilles nécessaires pour la gestion des cours d'une catégorie.
 */
function setupCourseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt('Configuration', 'Entrez le nom de la catégorie (ex: Backend, DevOps):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || !response.getResponseText()) {
    ui.alert('Opération annulée.');
    return;
  }
  const categoryName = response.getResponseText().trim();
  ss.rename(categoryName); // Renomme la feuille de calcul elle-même

  const sheetStructures = {
    [`Cours_${categoryName}`]: ["ID_Cours", "Nom_Cours", "Résumé", "Durée_Totale", "Niveau", "Prix", "URL_Vidéo_Intro", "Image_Couverture", "Freemium_Start", "Freemium_End", "Objectifs", "Prérequis", "Avantage_Senior", "Public_Cible", "Formateur_Nom", "Formateur_Titre", "Formateur_Bio", "Note_Moyenne", "Avis"],
    [`Modules_${categoryName}`]: ["ID_Cours", "ID_Module", "Nom_Module", "Description_Module", "Durée_Module", "Ordre_Module"],
    [`Chapitres_${categoryName}`]: ["ID_Module", "ID_Chapitre", "Nom_Chapitre", "URL_Vidéo_Chapitre", "Durée", "Ressource", "Ordre_Chapitre"],
    [`Quiz_Chapitres_${categoryName}`]: ["ID_Chapitre", "Question", "Réponse_1", "Réponse_2", "Réponse_3", "Réponse_4", "Bonne_Réponse"],
    [`Quiz_Modules_${categoryName}`]: ["ID_Module", "Question", "Réponse_1", "Réponse_2", "Réponse_3", "Réponse_4", "Bonne_Réponse"]
  };

  // Supprimer les feuilles existantes sauf la première
  const allSheets = ss.getSheets();
  for (let i = allSheets.length - 1; i > 0; i--) {
    ss.deleteSheet(allSheets[i]);
  }

  let firstSheet = true;
  for (const sheetName in sheetStructures) {
    const headers = sheetStructures[sheetName];
    let sheet;
    if (firstSheet) {
      sheet = ss.getSheets()[0];
      sheet.setName(sheetName);
      sheet.clear();
      firstSheet = false;
    } else {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }

  // CORRECTION: Appeler la fonction pour ajouter les données de démo juste après la création.
  seedDefaultCourseData(categoryName);
  ui.alert(`Structure de cours pour la catégorie "${categoryName}" initialisée et remplie avec des données de démo !`);
}

/**
 * NOUVEAU: Ajoute des données d'exemple dans les feuilles fraîchement créées.
 * @param {string} categoryName - Le nom de la catégorie pour laquelle ajouter les données.
 */
function seedDefaultCourseData(categoryName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // Récupération des feuilles
    const coursSheet = ss.getSheetByName(`Cours_${categoryName}`);
    const modulesSheet = ss.getSheetByName(`Modules_${categoryName}`);
    const chapitresSheet = ss.getSheetByName(`Chapitres_${categoryName}`);
    const quizChapitresSheet = ss.getSheetByName(`Quiz_Chapitres_${categoryName}`);
    const quizModulesSheet = ss.getSheetByName(`Quiz_Modules_${categoryName}`);

    // --- Données d'exemple ---

    // Cours
    const coursData = [
      ["C-001", "Maîtriser l'architecture microservices : les 10 pièges d'un CTO", "Un cours intensif qui va au-delà des tutoriels basiques pour vous enseigner les stratégies et les erreurs à éviter, tirées de 15 ans d'expérience terrain.", "8h 30min", "Expert", 75000, "https://www.youtube.com/embed/Plq333-4k6E", "https://i.postimg.cc/pX3dYj8B/course-microservices.jpg", "0", "1200", "Maîtriser les patterns de communication; Concevoir des API résilientes; Gérer la consistance des données.", "Bases en backend; Connaissance des API REST.", "Pensez comme un architecte système.", "Professionnels du Backend avec 3+ ans d'expérience.", "Jean Dupont", "CTO @ TechInnov", "Après avoir mené 3 transformations monolithiques, j'ai condensé mes leçons (et échecs) dans ce cours.", "4.8", "125 Avis"],
      ["C-002", "React Avancé : Hooks, Performance et State Management", "Optimisez vos applications React en maîtrisant les concepts avancés que les tutoriels survolent.", "12h 15min", "Intermédiaire", 60000, "https://www.youtube.com/embed/N3AkSS5hXMA", "https://i.postimg.cc/Yq7p4Y4j/course-react.jpg", "0", "1200", "Utiliser les hooks personnalisés; Optimiser le rendu avec useMemo et useCallback; Gérer un état global sans Redux.", "Bonnes bases de React (composants, props, state).", "Écrivez du code React plus propre, plus rapide et plus maintenable.", "Professionnels du Frontend voulant passer au niveau supérieur.", "Aïcha Diallo", "Lead Frontend Dev @ WebScale", "J'ai vu trop de projets React devenir des usines à gaz. Ce cours vous donne les clés pour éviter ça.", "4.9", "210 Avis"],
      ["C-003", "CI/CD de A à Z avec GitLab et Kubernetes", "Déployez vos applications en continu et sans stress. Le guide pratique que tout DevOps senior aurait voulu avoir.", "10h 00min", "Intermédiaire", 80000, "https://www.youtube.com/embed/rG3_c42X_gQ", "https://i.postimg.cc/tJkRzZ6v/course-devops.jpg", "0", "1200", "Créer des pipelines CI/CD complexes; Déployer sur un cluster Kubernetes; Gérer les secrets de manière sécurisée.", "Connaissances de base de Git et Docker.", "Automatisez 90% de vos tâches de déploiement.", "Développeurs, SysAdmins, et futurs ingénieurs DevOps.", "Moussa Traoré", "Ingénieur DevOps Senior", "L'automatisation est une passion. J'ai conçu ce cours pour vous faire gagner des centaines d'heures.", "4.7", "98 Avis"],
      ["C-004", "Introduction au Machine Learning avec Python", "Un cours pour les professionnels qui veulent comprendre et appliquer le ML, sans le jargon mathématique complexe.", "15h 45min", "Débutant", 55000, "https://www.youtube.com/embed/I_gGAbJ623A", "https://i.postimg.cc/L8yWpB0x/course-ml.jpg", "0", "1200", "Entraîner des modèles de régression et classification; Utiliser Scikit-Learn et Pandas; Évaluer la performance d'un modèle.", "Bases de Python.", "Démythifiez l'IA et construisez votre premier modèle prédictif en quelques heures.", "Professionnels curieux du Machine Learning.", "Fatou N'diaye", "Data Scientist @ DataPredict", "Le ML n'est pas de la magie. C'est un outil puissant que je vais vous apprendre à manier.", "4.8", "350 Avis"],
      ["C-005", "Design System en Pratique pour Équipes Scalables", "Arrêtez de réinventer la roue. Construisez un Design System qui accélère votre développement et garantit la cohérence.", "7h 20min", "Intermédiaire", 65000, "https://www.youtube.com/embed/z9hGg122p4w", "https://i.postimg.cc/W1P4gL2d/course-design-system.jpg", "0", "1200", "Structurer un Design System; Documenter les composants avec Storybook; Mettre en place la gouvernance.", "Expérience en développement Frontend (React, Vue, etc.).", "Le secret des GAFAM pour scaler leurs interfaces.", "Lead Développeurs, Designers UI/UX.", "David Lefebvre", "Principal Engineer @ UI-Kit", "Un bon Design System, c'est 50% de la vélocité d'une équipe. Je vous montre comment.", "4.9", "180 Avis"],
      ["C-006", "Optimisation de Performance SQL : Requêtes et Index", "Vos requêtes sont lentes ? Apprenez les techniques de pro pour diviser par 10 le temps de réponse de votre base de données.", "9h 00min", "Intermédiaire", 70000, "https://www.youtube.com/embed/H_Ofy5PAjE8", "https://i.postimg.cc/HkC0CjJ9/course-sql.jpg", "0", "1200", "Analyser un plan d'exécution; Créer des index efficaces; Réécrire des requêtes complexes.", "Bonnes connaissances de SQL (JOIN, GROUP BY).", "Transformez une requête de 5 secondes en une requête de 50 millisecondes.", "Professionnels du Backend, Administrateurs de BDD.", "Carlos Gomez", "Architecte de Données", "J'ai passé 20 ans à optimiser des bases de données. Voici mes secrets.", "4.8", "155 Avis"],
      ["C-007", "Sécurité Web : Le Guide Pratique de l'OWASP Top 10", "Passez de professionnel à défenseur. Apprenez à trouver et corriger les failles de sécurité avant qu'elles ne soient exploitées.", "11h 30min", "Intermédiaire", 75000, "https://www.youtube.com/embed/T8gu61i3G8g", "https://i.postimg.cc/J4fV7Y0Y/course-security.jpg", "0", "1200", "Identifier les injections SQL; Prévenir les attaques XSS; Sécuriser l'authentification et les sessions.", "Expérience en développement web.", "Le checklist de sécurité que tout professionnel senior doit connaître.", "Professionnels du web soucieux de la qualité.", "Sofia Chen", "Pentester Éthique", "Je suis payée pour casser des sites. Je vous apprends à les construire pour qu'ils soient incassables.", "4.9", "230 Avis"],
      ["C-008", "Architecture Cloud : AWS vs GCP vs Azure pour les Décideurs", "Ne choisissez plus votre cloud au hasard. Comprenez les forces, faiblesses et coûts de chaque plateforme.", "6h 00min", "Tous niveaux", 90000, "https://www.youtube.com/embed/j_s2_t4d6sU", "https://i.postimg.cc/d1gSgKzQ/course-cloud.jpg", "0", "1200", "Comparer les services de calcul, stockage et BDD; Estimer les coûts d'une architecture; Choisir la bonne plateforme pour un projet.", "Aucun prérequis technique.", "La décision la plus importante de votre projet, expliquée simplement.", "CTOs, Chefs de projet, Architectes.", "Omar Benali", "Consultant Cloud Indépendant", "J'aide les entreprises à choisir le bon cloud. Ce cours est la synthèse de mes missions.", "4.7", "80 Avis"],
      ["C-009", "Gestion de Projet Agile pour Leaders Techniques", "Devenez le Leader que tout le monde veut suivre. Maîtrisez Scrum et Kanban du point de vue technique et managérial.", "8h 45min", "Intermédiaire", 68000, "https://www.youtube.com/embed/J49_xa-2Vz4", "https://i.postimg.cc/prM8gJzG/course-agile.jpg", "0", "1200", "Estimer des tâches complexes; Animer des réunions efficaces; Gérer la dette technique dans un sprint.", "Expérience en gestion de projet ou en développement.", "Le pont entre la technique et la stratégie produit.", "Professionnels seniors, Tech Leads, Team Leads.", "Hélène Martin", "Engineering Manager @ AgileSoft", "J'ai transformé des équipes en machines de livraison agiles. Voici ma méthode.", "4.8", "115 Avis"],
      ["C-010", "Tests E2E avec Cypress : De Zéro à Héros", "Arrêtez les tests manuels répétitifs. Automatisez vos tests de bout en bout et livrez avec confiance.", "10h 10min", "Débutant", 58000, "https://www.youtube.com/embed/u8vMu9MSr9E", "https://i.postimg.cc/L6N6pB3x/course-testing.jpg", "0", "1200", "Écrire des tests Cypress fiables; Interagir avec une application web; Intégrer les tests dans une CI/CD.", "Bases de JavaScript.", "La compétence qui vous fera passer de 'ça marche sur ma machine' à 'ça marche en production'.", "Développeurs Frontend, Ingénieurs QA.", "Kenji Tanaka", "QA Automation Lead", "Mes tests ont évité des millions de dollars de bugs. Je vous montre comment écrire les vôtres.", "4.9", "190 Avis"]
    ];

    // Modules
    const modulesData = [
      ["C-001", "M-001-1", "Fondations et Anti-Patterns", "Comprendre les erreurs communes qui mènent à l'échec.", "1h 05min", 1],
      ["C-001", "M-001-2", "Communication Inter-Services", "Choisir la bonne stratégie de communication (synchrone vs asynchrone).", "55min", 2],
      ["C-002", "M-002-1", "Les Hooks en Profondeur", "Au-delà de useState et useEffect.", "2h 00min", 1],
      ["C-002", "M-002-2", "Stratégies de State Management", "Zustand, Jotai et les alternatives à Redux.", "3h 15min", 2],
      ["C-003", "M-003-1", "Les Bases de GitLab CI", "Créer son premier pipeline.", "1h 30min", 1],
      ["C-003", "M-003-2", "Déploiement sur Kubernetes", "De l'image Docker au pod.", "2h 30min", 2]
    ];

    // Chapitres
    const chapitresData = [
      ["M-001-1", "CH-001-1-1", "Introduction : Pourquoi les microservices échouent (Freemium)", "https://www.youtube.com/embed/Plq333-4k6E", "20min", "PDF: Checklist des prérequis", 1],
      ["M-001-1", "CH-001-1-2", "Le piège du Monolithe Distribué", "https://www.youtube.com/embed/Plq333-4k6E", "45min", "Code: Exemple à ne pas suivre", 2],
      ["M-001-2", "CH-001-2-1", "REST vs gRPC vs Message Queues", "https://www.youtube.com/embed/Plq333-4k6E", "55min", "Quiz d'évaluation", 3],
      ["M-002-1", "CH-002-1-1", "Créer son premier Hook personnalisé", "https://www.youtube.com/embed/N3AkSS5hXMA", "30min", "Code source", 1],
      ["M-002-1", "CH-002-1-2", "useReducer pour les états complexes", "https://www.youtube.com/embed/N3AkSS5hXMA", "45min", "Code source", 2],
      ["M-002-2", "CH-002-2-1", "Gérer l'état global avec Zustand", "https://www.youtube.com/embed/N3AkSS5hXMA", "1h 15min", "Quiz d'évaluation", 3],
      ["M-003-1", "CH-003-1-1", "Anatomie d'un fichier .gitlab-ci.yml", "https://www.youtube.com/embed/rG3_c42X_gQ", "25min", "Fichier de configuration type", 1],
      ["M-003-2", "CH-003-2-1", "Écrire un Dockerfile optimisé pour la production", "https://www.youtube.com/embed/rG3_c42X_gQ", "40min", "Dockerfile", 2]
    ];

    // Quiz
    const quizData = [
      ["CH-001-2-1", "Quel est le principal inconvénient d'une communication synchrone (REST) ?", "Couplage temporel fort", "Performance", "Sécurité", "Complexité du code", "Couplage temporel fort"],
      ["CH-002-2-1", "Quel est l'avantage principal de Zustand sur Redux ?", "Moins de boilerplate", "Plus performant", "Meilleur pour TypeScript", "Plus de fonctionnalités", "Moins de boilerplate"],
      ["CH-003-2-1", "Quelle instruction Docker est utilisée pour copier des fichiers dans l'image ?", "COPY", "ADD", "MOVE", "INCLUDE", "COPY"]
    ];

    // --- Insertion des données ---

    if (coursSheet && coursData.length > 0) {
      coursSheet.getRange(coursSheet.getLastRow() + 1, 1, coursData.length, coursData[0].length).setValues(coursData);
    }
    if (modulesSheet && modulesData.length > 0) {
      modulesSheet.getRange(modulesSheet.getLastRow() + 1, 1, modulesData.length, modulesData[0].length).setValues(modulesData);
    }
    if (chapitresSheet && chapitresData.length > 0) {
      chapitresSheet.getRange(chapitresSheet.getLastRow() + 1, 1, chapitresData.length, chapitresData[0].length).setValues(chapitresData);
    }
    if (quizChapitresSheet && quizData.length > 0) {
      quizChapitresSheet.getRange(quizChapitresSheet.getLastRow() + 1, 1, quizData.length, quizData[0].length).setValues(quizData);
    }
    if (quizModulesSheet) {
      // Pas de données de quiz de module pour l'instant
    }

    ui.alert("Données de démonstration ajoutées avec succès !");

  } catch (e) {
    ui.alert("Erreur lors de l'ajout des données de démo : " + e.message);
  }
}

/**
 * NOUVEAU: Supprime toutes les données (sauf les en-têtes) des feuilles de cours.
 */
function clearDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Confirmation',
    'Voulez-vous vraiment supprimer toutes les données des feuilles de cours (les en-têtes seront conservés) ? Cette action est irréversible.',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Opération annulée.');
    return;
  }

  try {
    const allSheets = ss.getSheets();
    let clearedCount = 0;

    allSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      // Cible uniquement les feuilles qui suivent la structure des cours
      if (sheetName.startsWith('Cours_') || sheetName.startsWith('Modules_') || sheetName.startsWith('Chapitres_') || sheetName.startsWith('Quiz_')) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
          clearedCount++;
        }
      }
    });

    ui.alert(`${clearedCount} feuille(s) ont été nettoyées.`);
    invalidateGlobalCache(); // Invalider le cache après suppression

  } catch (e) {
    ui.alert("Erreur lors de la suppression des données : " + e.message);
  }
}

// --- NOUVEAU: Fonctions de gestion de contenu via le menu ---

/**
 * Affiche une boîte de dialogue pour ajouter un nouveau cours.
 */
function addCourse() {
  const ui = SpreadsheetApp.getUi();
  const categoryName = getCategoryName();
  const coursSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Cours_${categoryName}`);

  if (!coursSheet) {
    ui.alert(`La feuille "Cours_${categoryName}" est introuvable.`);
    return;
  }

  const result = ui.prompt(
    'Ajouter un nouveau cours',
    'Entrez le nom du nouveau cours :',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() == ui.Button.OK && result.getResponseText()) {
    const courseName = result.getResponseText().trim();
    const newId = `C-${new Date().getTime().toString().slice(-6)}`;
    
    // Ajoute une nouvelle ligne avec l'ID et le nom, les autres champs sont à remplir manuellement.
    coursSheet.appendRow([newId, courseName]);
    ui.alert(`Cours "${courseName}" ajouté avec l'ID ${newId}. Veuillez compléter les autres informations dans la ligne.`);
  }
}

/**
 * Affiche une boîte de dialogue pour ajouter un nouveau module à un cours.
 */
function addModule() {
  const ui = SpreadsheetApp.getUi();
  const categoryName = getCategoryName();
  const modulesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Modules_${categoryName}`);

  if (!modulesSheet) {
    ui.alert(`La feuille "Modules_${categoryName}" est introuvable.`);
    return;
  }

  let courseId = ui.prompt('ID du Cours', 'À quel ID de cours ce module appartient-il ? (ex: C-001)', ui.ButtonSet.OK_CANCEL);
  if (courseId.getSelectedButton() !== ui.Button.OK || !courseId.getResponseText()) return;
  courseId = courseId.getResponseText().trim();

  let moduleName = ui.prompt('Nom du Module', 'Entrez le nom du nouveau module :', ui.ButtonSet.OK_CANCEL);
  if (moduleName.getSelectedButton() !== ui.Button.OK || !moduleName.getResponseText()) return;
  moduleName = moduleName.getResponseText().trim();

  let moduleDesc = ui.prompt('Description du Module', 'Entrez une courte description pour ce module :', ui.ButtonSet.OK_CANCEL);
  moduleDesc = moduleDesc.getResponseText().trim();

  // Calculer le prochain numéro d'ordre pour ce cours
  const allModules = sheetToJSON(modulesSheet);
  const modulesForCourse = allModules.filter(m => m.ID_Cours == courseId);
  const nextOrder = modulesForCourse.length + 1;

  const newId = `M-${courseId.split('-')[1]}-${nextOrder}`;

  modulesSheet.appendRow([courseId, newId, moduleName, moduleDesc, "", nextOrder]);
  ui.alert(`Module "${moduleName}" (Ordre: ${nextOrder}) ajouté au cours ${courseId}.`);
}

/**
 * Affiche une boîte de dialogue pour ajouter un nouveau chapitre à un module.
 */
function addChapter() {
  const ui = SpreadsheetApp.getUi();
  const categoryName = getCategoryName();
  const chapitresSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Chapitres_${categoryName}`);

  if (!chapitresSheet) {
    ui.alert(`La feuille "Chapitres_${categoryName}" est introuvable.`);
    return;
  }

  let moduleId = ui.prompt('ID du Module', 'À quel ID de module ce chapitre appartient-il ? (ex: M-001-1)', ui.ButtonSet.OK_CANCEL);
  if (moduleId.getSelectedButton() !== ui.Button.OK || !moduleId.getResponseText()) return;
  moduleId = moduleId.getResponseText().trim();

  let chapterName = ui.prompt('Nom du Chapitre', 'Entrez le nom du nouveau chapitre :', ui.ButtonSet.OK_CANCEL);
  if (chapterName.getSelectedButton() !== ui.Button.OK || !chapterName.getResponseText()) return;
  chapterName = chapterName.getResponseText().trim();

  let duration = ui.prompt('Durée', 'Entrez la durée du chapitre (ex: 7min, 1h15) :', ui.ButtonSet.OK_CANCEL);
  if (duration.getSelectedButton() !== ui.Button.OK || !duration.getResponseText()) return;
  duration = duration.getResponseText().trim();

  // Calculer le prochain numéro d'ordre pour ce module
  const allChapters = sheetToJSON(chapitresSheet);
  const chaptersForModule = allChapters.filter(c => c.ID_Module == moduleId);
  const nextOrder = chaptersForModule.length + 1;

  const newId = `CH-${moduleId.split('-')[1]}-${moduleId.split('-')[2]}-${nextOrder}`;

  chapitresSheet.appendRow([moduleId, newId, chapterName, "", duration, "", nextOrder]);
  ui.alert(`Chapitre "${chapterName}" (Ordre: ${nextOrder}) ajouté au module ${moduleId}.`);
}

/**
 * NOUVEAU: Ajoute un cours à partir d'une requête POST (ex: tableau de bord).
 */
function addCourseFromDashboard(data, origin) {
  try {
    const categoryName = getCategoryName();
    const coursSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Cours_${categoryName}`);
    if (!coursSheet) {
      throw new Error(`Feuille "Cours_${categoryName}" introuvable.`);
    }

    const newId = `C-${new Date().getTime().toString().slice(-6)}`;
    
    // Préparer la ligne avec les données fournies, en respectant l'ordre des colonnes
    // ["ID_Cours", "Nom_Cours", "Résumé", "Durée_Totale", "Niveau", "Prix", "URL_Vidéo_Intro", "Image_Couverture", "Freemium_Start", "Freemium_End", "Objectifs", "Prérequis", "Avantage_Senior", "Public_Cible", "Formateur_Nom", "Formateur_Titre", "Formateur_Bio", "Note_Moyenne", "Avis"]
    const newRow = [
      newId,                // ID_Cours
      data.nom,               // Nom_Cours
      data.resume,            // Résumé
      data.duree,             // Durée_Totale
      data.niveau,            // Niveau
      data.prix,              // Prix
      data.videoIntro,        // URL_Vidéo_Intro
      data.imageCouverture,   // Image_Couverture
      "0",                    // Freemium_Start (valeur par défaut)
      "1200",                 // Freemium_End (valeur par défaut, 20min)
      data.objectifs,         // Objectifs
      data.prerequis,         // Prérequis
      data.avantageSenior || `Le savoir-faire d'un expert.`, // Avantage_Senior (avec une valeur par défaut)
      data.publicCible,       // Public_Cible
      data.formateurNom,      // Formateur_Nom
      data.formateurTitre,    // Formateur_Titre
      data.formateurBio,      // Formateur_Bio
      "0",                    // Note_Moyenne (initiale)
      "0 Avis"                // Avis (initial)
    ];

    coursSheet.appendRow(newRow);
    invalidateGlobalCache(); // Important pour que le nouveau cours apparaisse
    return createJsonResponse({ success: true, id: newId, message: "Cours ajouté avec succès." }, origin);
  } catch (e) {
    return createJsonResponse({ success: false, error: e.message }, origin);
  }
}
