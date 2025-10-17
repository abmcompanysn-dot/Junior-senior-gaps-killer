/**
 * @file Gestion Cours - API Centrale d'Apprentissage
 * @description Gère les achats de cours, la progression des utilisateurs et les données des tableaux de bord.
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const SHEET_NAMES = {
    COURS_ACHETES: "Cours_Achetés",
    PROGRESSION: "Progression_Utilisateur",
    REPONSES_QUIZ: "Reponses_Quiz",
    CONFIG: "Config"
};
const ALLOWED_ORIGIN = 'https://junior-senior-gaps-killer.vercel.app';

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Module Apprentissage')
      .addItem('🚀 Initialiser le module', 'setupProject')
      .addToUi();
}

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    try {
        const { action, userId, courseId } = e.parameter;
        switch (action) {
            case 'getCoursAchetes':
                return createJsonResponse(getCoursAchetes(userId));
            case 'getProgressionCours':
                return createJsonResponse(getProgressionCours(userId, courseId));
            case 'getSeniorDashboardData': // NOUVEAU
                return createJsonResponse(getSeniorDashboardData(e.parameter.formateurNom));
            default:
                return createJsonResponse({ success: true, message: 'API Gestion Cours - Active' });
        }
    } catch (error) {
        return createJsonResponse({ success: false, error: `Erreur GET: ${error.message}` });
    }
}

function doPost(e) {
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        switch (action) {
            case 'acheterCours':
                return createJsonResponse(acheterCours(data));
            case 'enregistrerReponseQuiz':
                return createJsonResponse(enregistrerReponseQuiz(data));
            default:
                return createJsonResponse({ success: false, error: "Action POST non reconnue." });
        }
    } catch (error) {
        return createJsonResponse({ success: false, error: `Erreur POST: ${error.message}` });
    }
}

function doOptions(e) {
  return ContentService.createTextOutput(null)
    .addHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
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
    const headers = ["ID_Achat", "ID_Client", "ID_Cours", "Nom_Cours", "Prix_Achat", "Formateur_Nom", "Date_Achat"];

    items.forEach(item => {
        const idAchat = `ACH-${new Date().getTime()}-${item.productId.slice(-4)}`;
        sheet.appendRow([idAchat, userId, item.productId, item.name, item.price, item.instructor, dateAchat]);
    });

    // Ici, on pourrait aussi déclencher une notification
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
    return { success: true, data: { completedChapters: ["CH-001-1-1"] } };
}

/**
 * NOUVEAU: Calcule les statistiques pour le tableau de bord d'un Senior.
 */
function getSeniorDashboardData(formateurNom) {
    if (!formateurNom) return { success: false, error: "Nom du formateur manquant." };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.COURS_ACHETES);
    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();
    
    const formateurIndex = headers.indexOf("Formateur_Nom");
    const prixIndex = headers.indexOf("Prix_Achat");
    const clientIndex = headers.indexOf("ID_Client");
    const coursIndex = headers.indexOf("ID_Cours");

    const salesByFormateur = allData.filter(row => row[formateurIndex] === formateurNom);

    const totalRevenue = salesByFormateur.reduce((sum, row) => sum + (parseFloat(row[prixIndex]) || 0), 0);
    
    const uniqueStudents = new Set(salesByFormateur.map(row => row[clientIndex]));

    const courseSales = salesByFormateur.reduce((acc, row) => {
        const courseId = row[coursIndex];
        acc[courseId] = (acc[courseId] || 0) + 1;
        return acc;
    }, {});

    return { success: true, data: {
        revenue: totalRevenue,
        students: uniqueStudents.size,
        courseSales: courseSales
    }};
}


// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  output.addHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  output.addHeader('Access-Control-Allow-Credentials', 'true');
  return output;
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