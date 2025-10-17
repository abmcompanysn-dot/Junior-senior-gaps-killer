
/**
 * @file SCRIPT CENTRAL - Gestionnaire de Catalogue
 * @description Gère la liste des catégories de cours et agrège les données de chaque catégorie pour le front-end.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 * @version 2.0.0
 * @author abmcy tech 
 */

// --- CONFIGURATION ---
const CENTRAL_SHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg"; // IMPORTANT: ID de la feuille centrale
const DEFAULT_IMAGE_URL = "https://i.postimg.cc/pX3dYj8B/course-microservices.jpg";

// Liste des origines autorisées pour CORS.
const ALLOWED_ORIGINS_FRONTEND = [
  "https://junior-senior-gaps-killer.vercel.app/", // URL de production
  "http://127.0.0.1:5500"          // URL de développement local
];

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Catalogue Central')
      .addSeparator()
      .addItem('⚙️ Initialiser la feuille centrale', 'setupCentralSheet')
      .addToUi();
}

/**
 * NOUVEAU: Se déclenche à chaque modification de la feuille de calcul centrale.
 * Si la feuille "Catégories" est modifiée, le cache est invalidé.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // On ne s'intéresse qu'aux modifications sur la feuille des catégories
  if (sheetName === "Catégories") {
    Logger.log(`Modification détectée sur la feuille '${sheetName}'. Invalidation du cache.`);
    const cache = PropertiesService.getScriptProperties();
    const newVersion = new Date().getTime().toString();
    cache.setProperty('cacheVersion', newVersion);
  }
}

/**
 * Gère les requêtes OPTIONS pour le pré-vol CORS.
 */
function doOptions(e) {
  // Autorise toutes les origines pour les requêtes de pré-vol.
  return ContentService.createTextOutput()
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Fournit la liste des catégories au front-end (AdminInterface.html).
 */
function doGet(e) {
  // CORRECTION: Déclarer 'origin' ici pour qu'il soit accessible dans les blocs try et catch.
  const origin = e.headers ? e.headers.Origin : null;
  try {
    const action = e.parameter.action;

    // CORRECTION: Gérer l'invalidation du cache appelée par les feuilles de catégorie
    if (action === 'invalidateCache') {
      const cache = PropertiesService.getScriptProperties();
      const newVersion = new Date().getTime().toString();
      cache.setProperty('cacheVersion', newVersion);
      return createJsonResponse({ success: true, message: `Cache invalidé. Nouvelle version: ${newVersion}` }, origin);
    }

    // NOUVEAU: Point d'entrée léger pour juste vérifier la version du cache
    if (action === 'getCacheVersion') {
      const cacheVersion = PropertiesService.getScriptProperties().getProperty('cacheVersion') || '0';
      return createJsonResponse({ success: true, cacheVersion: cacheVersion }, origin);
    }

    // NOUVEAU: Point d'entrée unique pour le front-end public (main.js)
    // Renvoie la liste des catégories et tous les cours de toutes les catégories.
    if (action === 'getPublicCatalog') {
      const catalog = getPublicCatalog();
      const cacheVersion = PropertiesService.getScriptProperties().getProperty('cacheVersion');
      return createJsonResponse({ success: true, data: catalog, cacheVersion: cacheVersion }, origin);
    }

    // Comportement par défaut (peut être utilisé pour des tests ou l'ancienne logique)
    return createJsonResponse({ success: true, message: "API Centrale ABMCY Market - Active" }, origin);

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message }, origin);
  } 
}

/**
 * Récupère la liste simple des catégories.
 */
function getCategories() {
  const ss = SpreadsheetApp.openById(CENTRAL_SHEET_ID);
  const sheet = ss.getSheetByName("Catégories");
  if (!sheet) throw new Error("La feuille 'Catégories' est introuvable.");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * NOUVEAU: Récupère le catalogue public complet (catégories et tous les produits).
 * C'est cette fonction qui est appelée par main.js.
 */
function getPublicCatalog() {
  const categories = getCategories();
  const activeCategories = categories.filter(c => c.ScriptURL && !c.ScriptURL.startsWith('REMPLIR_'));

  if (activeCategories.length === 0) {
    // Retourne les catégories vides et un tableau de produits vide
    return { categories: categories, products: [] };
  }

  // Utilise UrlFetchApp.fetchAll pour appeler tous les scripts de catégorie en parallèle
  const requests = activeCategories.map(category => ({
    url: `${category.ScriptURL}?action=getProducts`, // L'action 'getProducts' est conservée pour la compatibilité
    method: 'get',
    muteHttpExceptions: true // Important: pour ne pas bloquer si une catégorie échoue
  }));

  const responses = UrlFetchApp.fetchAll(requests);
  let allCourses = [];

  responses.forEach((response, index) => {
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      if (result.success && Array.isArray(result.data)) {
        // Ajoute la catégorie à chaque cours pour une utilisation facile sur le front-end
        const categoryName = activeCategories[index].NomCategorie;
        const coursesWithCategory = result.data.map(course => ({ ...course, Catégorie: categoryName }));
        allCourses = allCourses.concat(coursesWithCategory);
      }
    }
  });

  // Le front-end s'attend à une clé "products", donc nous la conservons.
  return { categories: categories, products: allCourses };
}

// --- UTILITAIRES ---

/**
 * Crée une réponse JSON standard pour l'API, gérant CORS.
 * @param {object} data Les données à retourner en JSON.
 * @param {string} [origin] L'origine de la requête, si disponible.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput avec le contenu JSON et les en-têtes CORS.
 */
function createJsonResponse(data, origin) {
  // CORRECTION DÉFINITIVE : On crée l'objet, on définit son type, et on retourne.
  // L'en-tête CORS est géré par la fonction doOptions et la réponse globale.
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Utilitaire pour convertir une feuille en JSON.
 */
function sheetToJSON(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
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
 * Initialise la feuille de calcul centrale.
 */
function setupCentralSheet() {
  const ss = SpreadsheetApp.openById(CENTRAL_SHEET_ID);
  let sheet = ss.getSheetByName("Catégories");
  if (!sheet) {
    sheet = ss.insertSheet("Catégories");
  }
  sheet.clear();
  // Les en-têtes pour définir les catégories de cours
  const headers = ["IDCategorie", "NomCategorie", "SheetID", "ScriptURL", "ImageURL", "Numero"];
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  
  // Ajout de quelques catégories d'exemple pour les cours
  const exampleCategories = [
    ["CAT-001", "Développement Backend", "REMPLIR_ID_FEUILLE_BACKEND", "REMPLIR_URL_SCRIPT_BACKEND", DEFAULT_IMAGE_URL, "+221771234567"],
    ["CAT-002", "DevOps & Cloud", "REMPLIR_ID_FEUILLE_DEVOPS", "REMPLIR_URL_SCRIPT_DEVOPS", DEFAULT_IMAGE_URL, "+221771234567"],
    ["CAT-003", "Data Science & IA", "REMPLIR_ID_FEUILLE_DATA", "REMPLIR_URL_SCRIPT_DATA", DEFAULT_IMAGE_URL, "+221771234567"]
  ];

  if (exampleCategories.length > 0) {
    sheet.getRange(2, 1, exampleCategories.length, headers.length).setValues(exampleCategories);
  }

  SpreadsheetApp.getUi().alert(`Initialisation terminée. ${exampleCategories.length} catégories de cours ont été ajoutées à la feuille "Catégories".`);
}