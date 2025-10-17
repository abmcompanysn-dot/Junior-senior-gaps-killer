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
  const origin = e.headers ? e.headers.Origin : null;
  try {
    const request = JSON.parse(e.postData.contents);
    return createJsonResponse({ success: false, error: `Action POST non reconnue: ${request.action}` }, origin);
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
    [`Cours_${categoryName}`]: ["ID_Cours", "Nom_Cours", "Résumé", "Durée_Totale", "Niveau", "Prix", "URL_Vidéo", "Image_Couverture", "Freemium_Start", "Freemium_End", "Objectifs", "Prérequis", "Avantage_Senior", "Public_Cible", "Formateur_Nom", "Formateur_Titre", "Formateur_Bio", "Note_Moyenne", "Avis"],
    [`Modules_${categoryName}`]: ["ID_Cours", "ID_Module", "Nom_Module", "Ordre_Module"],
    [`Chapitres_${categoryName}`]: ["ID_Module", "ID_Chapitre", "Nom_Chapitre", "Durée", "Ressource", "Ordre_Chapitre"],
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

    // --- Données d'exemple ---

    // Cours
    const coursData = [
      ["C-001", "Maîtriser l'architecture microservices : les 10 pièges que seul un CTO connaît", "Un cours intensif qui va au-delà des tutoriels basiques pour vous enseigner les stratégies et les erreurs à éviter, tirées de 15 ans d'expérience terrain.", "8h 30min", "Intermédiaire vers Expert", 75000, "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://i.postimg.cc/pX3dYj8B/course-microservices.jpg", "0", "1200", "Maîtriser les patterns de communication; Concevoir des API résilientes; Gérer la consistance des données distribuées.", "Bases en développement backend (Node.js, Java, ou autre); Connaissance des API REST.", "Apprenez à penser comme un architecte système et non plus comme un simple développeur.", "Développeurs Backend avec 3+ ans d'expérience.", "Jean Dupont", "CTO @ TechInnov", "Après avoir mené 3 transformations monolithiques vers microservices, j'ai condensé mes plus grandes leçons (et échecs) dans ce cours.", "4.8", "125 Avis"]
    ];

    // Modules
    const modulesData = [
      ["C-001", "M-001-1", "Fondations et Anti-Patterns", 1],
      ["C-001", "M-001-2", "Communication Inter-Services", 2]
    ];

    // Chapitres
    const chapitresData = [
      ["M-001-1", "CH-001-1-1", "Introduction : Pourquoi les microservices échouent (Freemium)", "20min", "PDF: Checklist des prérequis", 1],
      ["M-001-1", "CH-001-1-2", "Le piège du Monolithe Distribué", "45min", "Code: Exemple à ne pas suivre", 2],
      ["M-001-2", "CH-001-2-1", "REST vs gRPC vs Message Queues", "55min", "Quiz d'évaluation", 3]
    ];

    // Quiz
    const quizData = [
      ["CH-001-2-1", "Quel est le principal inconvénient d'une communication synchrone (REST) dans un système microservice ?", "Couplage temporel fort", "Performance", "Sécurité", "Complexité du code", "Couplage temporel fort"]
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
