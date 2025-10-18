/**
 * @file Gestion Cours - API Centrale d'Apprentissage
 * @description Gère les achats de cours, la progression des utilisateurs et les données des tableaux de bord.
 * @version 1.0.1 (Correction TypeError addHeader)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const SHEET_NAMES = {
    COURS_ACHETES: "Cours_Achetés",
    PROGRESSION: "Progression_Utilisateur",
    REPONSES_QUIZ: "Reponses_Quiz",
    CONFIG: "Config",
    // NOUVEAU: ID de la feuille centrale pour trouver tous les cours
    CENTRAL_SHEET_ID: "1xcW_lPim1AvD-RWDD0FtpAMYSrWq-FSv9XGa1ys2Xv4"
};

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Module Apprentissage')
      .addItem('🚀 Initialiser le module', 'setupProject')
      .addToUi();
}

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
    try {
        const { action, userId, courseId } = e.parameter;
        switch (action) {
            case 'getCoursAchetes':
                // Retourne directement la réponse TextOutput
                return createJsonResponse(getCoursAchetes(userId), origin);
            case 'getProgressionCours':
                // Retourne directement la réponse TextOutput
                return createJsonResponse(getProgressionCours(userId, courseId), origin);
            case 'getSeniorDashboardData': // NOUVEAU
                // Retourne directement la réponse TextOutput
                return createJsonResponse(getSeniorDashboardData(e.parameter.formateurNom), origin);
            case 'getCoursesBySenior': // NOUVEAU
                // Retourne directement la réponse TextOutput
                return createJsonResponse(getCoursesBySenior(e.parameter.formateurNom), origin);
            default:
                // Retourne directement la réponse TextOutput
                return createJsonResponse({ success: true, message: 'API Gestion Cours - Active' }, origin);
        }
    } catch (error) {
        // Assurez-vous de passer l'origine même en cas d'erreur
        return createJsonResponse({ success: false, error: `Erreur GET: ${error.message}` }, origin);
    }
}

function doPost(e) {
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        switch (action) {
            case 'acheterCours':
                // Retourne directement la réponse TextOutput
                return createJsonResponse(acheterCours(data), origin);
            case 'enregistrerReponseQuiz':
                // Retourne directement la réponse TextOutput
                return createJsonResponse(enregistrerReponseQuiz(data), origin);
            default:
                return createJsonResponse({ success: false, error: "Action POST non reconnue." }, origin);
        }
    } catch (error) {
        return createJsonResponse({ success: false, error: `Erreur POST: ${error.message}` }, origin);
    }
}

function doOptions(e) {
  // Les headers CORS sont ajoutés UNIQUEMENT dans doOptions pour le pré-vol (pre-flight)
  return ContentService.createTextOutput(null)
    .addHeader('Access-Control-Allow-Origin', (e.headers.Origin || e.headers.origin))
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- LOGIQUE MÉTIER ---

/**
 * Enregistre l'achat d'un ou plusieurs cours pour un utilisateur.
 */
function acheterCours(data) {
    const { userId, items } = data;
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: "Données d'achat invalides." };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.COURS_ACHETES);
    const dateAchat = new Date();
    // Les en-têtes sont pour référence, la fonction appendRow utilise l'ordre.

    items.forEach(item => {
        const idAchat = `ACH-${new Date().getTime()}-${item.productId.slice(-4)}`;
        sheet.appendRow([idAchat, userId, item.productId, item.name, item.price, item.instructor, dateAchat]);
    });

    return { success: true, message: `${items.length} cours acheté(s) avec succès.` };
}

/**
 * Récupère la liste des cours achetés par un utilisateur.
 */
function getCoursAchetes(userId) {
    if (!userId) return { success: false, error: "ID utilisateur manquant." };
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.COURS_ACHETES);
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();
    const userIdIndex = headers.indexOf("ID_Client");

    const coursIds = allData
        .filter(row => row[userIdIndex] === userId)
        .map(row => row[headers.indexOf("ID_Cours")]);

    return { success: true, data: [...new Set(coursIds)] }; // Retourne les ID de cours uniques
}

/**
 * Enregistre la réponse d'un utilisateur à un quiz.
 */
function enregistrerReponseQuiz(data) {
    const { userId, questionId, reponseDonnee, estCorrecte } = data;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.REPONSES_QUIZ);
    const idReponse = `REP-${new Date().getTime()}`;
    sheet.appendRow([idReponse, userId, questionId, reponseDonnee, estCorrecte, new Date()]);
    return { success: true, id: idReponse };
}

/**
 * Récupère la progression d'un utilisateur pour un cours donné.
 * (Placeholder - à développer)
 */
function getProgressionCours(userId, courseId) {
    // Cette fonction lirait la feuille "Progression_Utilisateur"
    // pour retourner les chapitres/modules complétés.
    // Ajout d'une gestion basique de la progression fictive
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRESSION);
    
    // Logic: find existing progression data or return a default/placeholder
    return { success: true, data: { completedChapters: ["CH-001-1-1"] } };
}

/**
 * NOUVEAU: Calcule les statistiques pour le tableau de bord d'un Senior.
 */
function getSeniorDashboardData(formateurNom) {
    if (!formateurNom) return { success: false, error: "Nom du formateur manquant." };
    
    try {
        // --- Calcul des statistiques de ventes ---
        const salesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.COURS_ACHETES);
        const salesData = salesSheet.getDataRange().getValues();
        const salesHeaders = salesData.shift();
        const formateurIndex = salesHeaders.indexOf("Formateur_Nom");
        const prixIndex = salesHeaders.indexOf("Prix_Achat");
        const clientIndex = salesHeaders.indexOf("ID_Client");

        const salesByFormateur = salesData.filter(row => row[formateurIndex] === formateurNom);
        const totalRevenue = salesByFormateur.reduce((sum, row) => sum + (parseFloat(row[prixIndex]) || 0), 0);
        const uniqueStudents = new Set(salesByFormateur.map(row => row[clientIndex]));

        // --- NOUVEAU: Calcul du nombre de cours créés ---
        const centralSheet = SpreadsheetApp.openById(SHEET_NAMES.CENTRAL_SHEET_ID).getSheetByName("Catégories");
        const allCourses = getPublicCatalog().products; // Réutiliser la logique existante
        const coursesBySenior = allCourses.filter(course => course.Formateur_Nom === formateurNom);

        return { success: true, data: {
            revenue: totalRevenue,
            students: uniqueStudents.size,
            deployedCourses: coursesBySenior.length
        }};
    } catch (error) {
        return { success: false, error: `Erreur lors du calcul des statistiques: ${error.message}` };
    }
}

/**
 * NOUVEAU: Récupère la liste des cours créés par un formateur.
 */
function getCoursesBySenior(formateurNom) {
    if (!formateurNom) return { success: false, error: "Nom du formateur manquant." };

    try {
        const allCourses = getPublicCatalog().products; // Réutiliser la logique existante
        const coursesBySenior = allCourses.filter(course => course.Formateur_Nom === formateurNom);

        return { success: true, data: coursesBySenior };
    } catch (error) {
        return { success: false, error: `Erreur lors de la récupération des cours: ${error.message}` };
    }
}


// --- FONCTIONS UTILITAIRES ---

/**
 * Crée une réponse JSON standardisée avec le MimeType.
 * NOTE CRUCIALE: Cette fonction ne doit pas ajouter de headers CORS.
 * C'est le rôle de doOptions() et de la configuration de déploiement Apps Script.
 * @param {object} data - L'objet à convertir en JSON.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput.
 */
function createJsonResponse(data, origin) {
    const output = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    // Les en-têtes CORS sont gérés exclusivement par doOptions pour éviter les erreurs TypeError.
    return output;
}

/**
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 */
function getConfig() {
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'script_config_cours';
    const cachedConfig = cache.get(CACHE_KEY);
    if (cachedConfig) {
        return JSON.parse(cachedConfig);
    }

    const defaultConfig = {
        allowed_origins: ["https://junior-senior-gaps-killer.vercel.app", "http://127.0.0.1:5500"],
    };

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
        if (!configSheet) return defaultConfig;

        const data = configSheet.getDataRange().getValues();
        const config = {};
        data.forEach(row => {
            if (row[0] && row[1]) { config[row[0]] = row[1]; }
        });

        const finalConfig = {
            allowed_origins: config.allowed_origins ? config.allowed_origins.split(',').map(s => s.trim()) : defaultConfig.allowed_origins,
        };

        cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600); // Cache 10 minutes
        return finalConfig;
    } catch (e) {
        return defaultConfig;
    }
}

/**
 * NOUVEAU: Récupère le catalogue public complet.
 * Cette fonction est une copie simplifiée de celle dans "Gestion Produits & Front-End.js"
 * pour rendre ce script autonome pour le calcul des statistiques.
 */
function getPublicCatalog() {
    const centralSheet = SpreadsheetApp.openById(SHEET_NAMES.CENTRAL_SHEET_ID);
    const categoriesSheet = centralSheet.getSheetByName("Catégories");
    const categoriesData = categoriesSheet.getDataRange().getValues();
    const categoriesHeaders = categoriesData.shift();
    const activeCategories = categoriesData.map(row => {
        const obj = {};
        categoriesHeaders.forEach((header, index) => obj[header] = row[index]);
        return obj;
    }).filter(c => c.ScriptURL && !c.ScriptURL.startsWith('REMPLIR_'));

    const requests = activeCategories.map(category => ({
        url: `${category.ScriptURL}?action=getProducts`,
        method: 'get',
        muteHttpExceptions: true
    }));

    const responses = UrlFetchApp.fetchAll(requests);
    let allCourses = [];
    responses.forEach(response => {
        if (response.getResponseCode() === 200) {
            const result = JSON.parse(response.getContentText());
            if (result.success && Array.isArray(result.data)) {
                allCourses = allCourses.concat(result.data);
            }
        }
    });
    return { products: allCourses };
}

/**
 * Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.COURS_ACHETES]: ["ID_Achat", "ID_Client", "ID_Cours", "Nom_Cours", "Prix_Achat", "Formateur_Nom", "Date_Achat"],
    [SHEET_NAMES.PROGRESSION]: ["ID_Progression", "ID_Client", "ID_Element", "Type_Element", "Statut", "Date_Completion"], // ID_Element peut être un ID de chapitre ou de module
    [SHEET_NAMES.REPONSES_QUIZ]: ["ID_Reponse", "ID_Client", "ID_Question", "Reponse_Donnee", "Est_Correcte", "Timestamp"],
    [SHEET_NAMES.CONFIG]: ["Clé", "Valeur"]
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clear(); // Vider la feuille avant de mettre les en-têtes
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  });

  // Remplir la configuration par défaut
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  const configData = configSheet.getDataRange().getValues();
  const configMap = new Map(configData.map(row => [row[0], row[1]]));

  const defaultConfigValues = {
    'allowed_origins': 'https://junior-senior-gaps-killer.vercel.app,http://127.0.0.1:5500',
    'allowed_methods': 'POST,GET,OPTIONS',
    'allowed_headers': 'Content-Type',
  };

  Object.entries(defaultConfigValues).forEach(([key, value]) => {
    if (!configMap.has(key)) {
      configSheet.appendRow([key, value]);
    }
  });

  ui.alert("Module 'Gestion Cours' initialisé avec succès !");
}
