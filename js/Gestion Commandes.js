/**
 * @file Gestion Commandes - API pour abmcymarket.vercel.app
 * @description Service dédié à l'enregistrement des nouvelles commandes.
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---

const SHEET_NAMES = {
    ORDERS: "Commandes",
    LOGS: "Logs",
    CONFIG: "Config" // NOUVEAU
};

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    return addCorsHeaders(createJsonResponse({
      success: true,
      message: 'API Gestion Commandes - Active'
    }));
}

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("Requête POST invalide ou vide.");
        }

        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        if (action === 'enregistrerCommande') {
            return addCorsHeaders(enregistrerCommande(data));
        } else {
            logAction('doPost', { error: 'Action non reconnue', action: action });
            return addCorsHeaders(createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }));
        }

    } catch (error) {
        logError(e.postData ? e.postData.contents : 'No postData', error);
        return addCorsHeaders(createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }));
    }
}

function doOptions(e) {
  // Autorise toutes les origines pour les requêtes de pré-vol.
  return ContentService.createTextOutput(null)
    .addHeader('Access-Control-Allow-Origin', 'https://junior-senior-gaps-killer.vercel.app')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- LOGIQUE MÉTIER ---

function enregistrerCommande(data) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        const produitsStr = Array.isArray(data.produits) ? data.produits.join(', ') : data.produits;
        const quantitesStr = Array.isArray(data.quantites) ? data.quantites.join(', ') : data.quantites;

        sheet.appendRow([
            idCommande, data.idClient, produitsStr, quantitesStr,
            data.total, "En attente", new Date(),
            data.adresseLivraison, data.moyenPaiement,
            data.notes || '']);

        logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
        return createJsonResponse({ success: true, id: idCommande });
    } finally {
        lock.releaseLock();
    }
}

// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

function logAction(action, details) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END (CMD)", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

function logError(context, error) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const errorDetails = { context: context, message: error.message, stack: error.stack };
        logSheet.appendRow([new Date(), "BACK-END (CMD)", "ERROR", JSON.stringify(errorDetails)]);
    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}

/**
 * NOUVEAU: Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Configuration Module')
      .addItem('🚀 Initialiser le projet', 'setupProject')
      .addToUi();
}

/**
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config_orders'; // Clé de cache unique pour ce script
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://junior-senior-gaps-killer.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS,DELETE",
    allowed_headers: "Content-Type",
    allow_credentials: "true"
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
      allowed_methods: config.allowed_methods || defaultConfig.allowed_methods,
      allowed_headers: config.allowed_headers || defaultConfig.allowed_headers,
      allow_credentials: config.allow_credentials === 'true'
    };

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600); // Cache pendant 10 minutes
    return finalConfig;
  } catch (e) {
    return defaultConfig;
  }
}

/**
 * NOUVEAU: Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.ORDERS]: ["ID Commande", "ID Client", "Produits", "Quantités", "Montant Total", "Statut", "Date", "Adresse Livraison", "Moyen Paiement", "Notes"],
    [SHEET_NAMES.LOGS]: ["Timestamp", "Source", "Action", "Détails"],
    [SHEET_NAMES.CONFIG]: ["Clé", "Valeur"]
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange("A1:Z1").setFontWeight("bold");
    }
  });

  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  const configData = configSheet.getDataRange().getValues();
  const configMap = new Map(configData.map(row => [row[0], row[1]]));

  const defaultConfigValues = {
    'allowed_origins': 'https://junior-senior-gaps-killer.vercel.app,http://127.0.0.1:5500',
    'allowed_methods': 'POST,GET,OPTIONS,DELETE',
    'allowed_headers': 'Content-Type',
    'allow_credentials': 'true'
  };

  Object.entries(defaultConfigValues).forEach(([key, value]) => {
    if (!configMap.has(key)) {
      configSheet.appendRow([key, value]);
    }
  });

  ui.alert("Projet 'Gestion Commandes' initialisé avec succès ! Les onglets 'Commandes', 'Logs' et 'Config' sont prêts.");
}

/**
 * NOUVEAU: Ajoute l'en-tête CORS à une réponse.
 * @param {GoogleAppsScript.Content.TextOutput} output - L'objet réponse.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse avec l'en-tête.
 */
function addCorsHeaders(output) {
    output.addHeader('Access-Control-Allow-Origin', 'https://junior-senior-gaps-killer.vercel.app');
    output.addHeader('Access-Control-Allow-Credentials', 'true');
    return output;
}