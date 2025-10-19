/**
 * @file SCRIPT CENTRAL - Gestionnaire de Catalogue
 * @description Gère la liste des catégories de cours et agrège les données de chaque catégorie pour le front-end.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 * @version 2.0.2 (Suppression setXFrameOptionsMode)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION ---
const CENTRAL_SHEET_ID = "1xcW_lPim1AvD-RWDD0FtpAMYSrWq-FSv9XGa1ys2Xv4"; // IMPORTANT: ID de la feuille centrale
const DEFAULT_IMAGE_URL = "https://i.postimg.cc/pX3dYj8B/course-microservices.jpg";
const ALLOWED_ORIGIN = 'https://junior-senior-gaps-killer.vercel.app'; // Domaine autorisé pour CORS

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Catalogue Central')
      .addSeparator()
      .addItem('⚙️ Initialiser la feuille centrale', 'setupCentralSheet')
      .addToUi();
}

/**
 * Se déclenche à chaque modification de la feuille de calcul centrale.
 * Si la feuille "Catégories" est modifiée, le cache est invalidé.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // On ne s'intéresse qu'aux modifications sur la feuille des catégories
  if (sheetName === "Catégories") {
    Logger.log(`Modification détectée sur la feuille '${sheetName}'. Invalidation du cache.`);
    // Utiliser CacheService pour le cache rapide et PropertiesService pour la version
    const properties = PropertiesService.getScriptProperties();
    const newVersion = new Date().getTime().toString();
    properties.setProperty('cacheVersion', newVersion);
    // On invalide aussi le cache des données agrégées si on l'avait mis en place (meilleure pratique)
    CacheService.getScriptCache().remove('publicCatalogData'); 
  }
}

/**
 * Gère les requêtes OPTIONS pour le pré-vol CORS.
 */
function doOptions(e) {
  // Répond aux requêtes de pré-vérification CORS
  return ContentService.createTextOutput()
    .setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    .setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With'); // Ajout d'en-têtes communs
}

/**
 * Fournit la liste des catégories au front-end (main.js).
 */
function doGet(e) {
  // L'origine n'est plus utilisée directement par createJsonResponse
  const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null; 

  try {
    const action = e.parameter.action;

    // Gérer l'invalidation du cache
    if (action === 'invalidateCache') {
      const properties = PropertiesService.getScriptProperties();
      const newVersion = new Date().getTime().toString();
      properties.setProperty('cacheVersion', newVersion);
      // Invalider le cache de données
      CacheService.getScriptCache().remove('publicCatalogData');
      return createJsonResponse({ success: true, message: `Cache invalidé. Nouvelle version: ${newVersion}` });
    }

    // Point d'entrée léger pour juste vérifier la version du cache
    if (action === 'getCacheVersion') {
      const cacheVersion = PropertiesService.getScriptProperties().getProperty('cacheVersion') || '0';
      return createJsonResponse({ success: true, cacheVersion: cacheVersion });
    }

    // Point d'entrée unique pour le front-end public (main.js)
    if (action === 'getPublicCatalog') {
      const catalog = getPublicCatalog();
      const cacheVersion = PropertiesService.getScriptProperties().getProperty('cacheVersion');
      return createJsonResponse({ success: true, data: catalog, cacheVersion: cacheVersion });
    }

    // Comportement par défaut
    return createJsonResponse({ success: true, message: "API Centrale Junior-Senior Gaps Killer - Active" });

  } catch (error) {
    Logger.log(`Erreur dans doGet: ${error.message}`);
    return createJsonResponse({ success: false, error: error.message });
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
 * Récupère le catalogue public complet (catégories et tous les produits) en utilisant le cache.
 */
function getPublicCatalog() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get('publicCatalogData');

  if (cachedData) {
    Logger.log('Catalogue récupéré à partir du cache.');
    return JSON.parse(cachedData);
  }

  const categories = getCategories();
  // Filtrer les catégories actives qui ont une URL de script valide
  const activeCategories = categories.filter(c => c.ScriptURL && !c.ScriptURL.startsWith('REMPLIR_') && c.ScriptURL.trim() !== '');

  if (activeCategories.length === 0) {
    return { categories: categories, products: [] };
  }

  // Utilise UrlFetchApp.fetchAll pour appeler tous les scripts de catégorie en parallèle
  const requests = activeCategories.map(category => ({
    url: `${category.ScriptURL}?action=getProducts`, 
    method: 'get',
    muteHttpExceptions: true // Pour ne pas bloquer si une catégorie échoue
  }));

  const responses = UrlFetchApp.fetchAll(requests);
  let allCourses = [];

  responses.forEach((response, index) => {
    if (response.getResponseCode() === 200) {
      try {
        const result = JSON.parse(response.getContentText());
        if (result.success && Array.isArray(result.data)) {
          // Ajoute la catégorie à chaque cours pour une utilisation facile sur le front-end
          const categoryName = activeCategories[index].NomCategorie;
          const coursesWithCategory = result.data.map(course => ({ 
            ...course, 
            Catégorie: categoryName,
            // S'assurer que chaque cours a un ID de catégorie pour le filtrage
            IDCategorie: activeCategories[index].IDCategorie
          }));
          allCourses = allCourses.concat(coursesWithCategory);
        }
      } catch (e) {
        // En cas d'erreur JSON parsing
        Logger.log(`Erreur de parsing JSON pour la catégorie ${activeCategories[index].NomCategorie}: ${e.message}`);
      }
    } else {
      Logger.log(`Erreur HTTP (${response.getResponseCode()}) pour la catégorie ${activeCategories[index].NomCategorie}.`);
    }
  });

  const catalog = { categories: categories, products: allCourses };
  
  // Stocke le catalogue en cache pour 15 minutes (900 secondes)
  cache.put('publicCatalogData', JSON.stringify(catalog), 900);
  Logger.log('Catalogue agrégé et mis en cache.');
  
  return catalog;
}

// --- UTILITAIRES ---

/**
 * Crée une réponse JSON standard pour l'API.
 * NOTE: Les en-têtes CORS sont gérés par la fonction doOptions et la configuration du déploiement.
 * ContentService.createTextOutput() ne supporte pas setHeader() ni setXFrameOptionsMode().
 * @param {object} data Les données à retourner en JSON.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput avec le contenu JSON.
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // CORRECTION: Suppression de la méthode setXFrameOptionsMode() qui cause l'erreur.
  // La gestion CORS dépend maintenant entièrement de la configuration de déploiement
  // et de la fonction doOptions pour le pré-vol.

  return output;
}

/**
 * Utilitaire pour convertir une feuille en JSON. (Conservé pour référence)
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
