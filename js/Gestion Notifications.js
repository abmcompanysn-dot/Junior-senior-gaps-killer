/**
 * @file Gestion Notifications - API pour abmcymarket.vercel.app
 * @description Service dédié à l'envoi de notifications (email, etc.).
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const ADMIN_EMAIL = "abmcompanysn@gmail.com"; // Email pour recevoir les notifications
const SHEET_NAMES = {
    NOTIFICATIONS: "Notifications",
    CONFIG: "Config"
};
// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    try {
        const { action, userId } = e.parameter;
        if (action === 'getNotifications' && userId) {
            return addCorsHeaders(getNotificationsForUser(userId));
        }
        return addCorsHeaders(createJsonResponse({ success: true, message: 'API Gestion Notifications - Active' }));
    } catch (error) {
        return addCorsHeaders(createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }));
    }
}

function doPost(e) {
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        switch (action) {
            case 'createNotification':
                return addCorsHeaders(createNotification(data));
            case 'markAsRead':
                return addCorsHeaders(markNotificationsAsRead(data));
            default:
                return addCorsHeaders(createJsonResponse({ success: false, error: "Action de notification non reconnue." }));
        }

    } catch (error) {
        return addCorsHeaders(createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }));
    }
}

function doOptions(e) {
  return ContentService.createTextOutput(null)
    .addHeader('Access-Control-Allow-Origin', 'https://junior-senior-gaps-killer.vercel.app')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

// --- LOGIQUE MÉTIER ---

/**
 * Crée une nouvelle notification pour un utilisateur.
 */
function createNotification(data) {
    const { userId, type, message } = data;
    if (!userId || !type || !message) {
        return createJsonResponse({ success: false, error: "Données de notification manquantes." });
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICATIONS);
    const notifId = `NOTIF-${new Date().getTime()}`;
    sheet.appendRow([notifId, userId, type, message, "Non lue", new Date()]);
    return createJsonResponse({ success: true, id: notifId });
}

/**
 * Récupère les notifications pour un utilisateur donné.
 */
function getNotificationsForUser(userId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICATIONS);
    if (!sheet) return createJsonResponse({ success: false, error: "La feuille de notifications est introuvable." });
    const allNotifs = sheet.getDataRange().getValues();
    const headers = allNotifs.shift();
    const userIdIndex = headers.indexOf("ID_Client"); // CORRECTION: Utiliser le bon nom de colonne

    const userNotifsData = allNotifs.filter(row => row[userIdIndex] === userId);

    const userNotifs = userNotifsData.map(row => {
        return headers.reduce((obj, header, index) => {
            obj[header] = row[index];
            return obj;
        }, {});
    }).reverse(); // Les plus récentes en premier

    return createJsonResponse({ success: true, data: userNotifs });
}

/**
 * Marque les notifications d'un utilisateur comme lues.
 */
function markNotificationsAsRead(data) {
    const { userId, notificationIds } = data;
    if (!userId || !notificationIds || !Array.isArray(notificationIds)) {
        return createJsonResponse({ success: false, error: "Données manquantes pour marquer les notifications comme lues." });
    }

    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.NOTIFICATIONS);
        const allNotifs = sheet.getDataRange().getValues();
        const headers = allNotifs[0];
        const idIndex = headers.indexOf("ID Notification");
        const statusIndex = headers.indexOf("Statut");

        // Parcourir toutes les lignes pour trouver et mettre à jour les notifications
        for (let i = 1; i < allNotifs.length; i++) {
            const rowId = allNotifs[i][idIndex];
            if (notificationIds.includes(rowId)) {
                // +1 pour l'index de tableau, +1 pour la ligne d'en-tête
                sheet.getRange(i + 1, statusIndex + 1).setValue("Lue");
            }
        }

        return createJsonResponse({ success: true, message: "Notifications mises à jour." });
    } catch (error) {
        return createJsonResponse({ success: false, error: `Erreur lors de la mise à jour des notifications: ${error.message}` });
    }
}

/**
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config_notifications';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://junior-senior-gaps-killer.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS",
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

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600);
    return finalConfig;
  } catch (e) {
    return defaultConfig;
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
 * NOUVEAU: Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.NOTIFICATIONS]: ["ID Notification", "ID_Client", "Type", "Message", "Statut", "Date"],
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
  configSheet.appendRow(['allowed_origins', 'https://junior-senior-gaps-killer.vercel.app,http://127.0.0.1:5500']);
  configSheet.appendRow(['allowed_methods', 'POST,GET,OPTIONS']);
  configSheet.appendRow(['allowed_headers', 'Content-Type']);
  configSheet.appendRow(['allow_credentials', 'true']);

  ui.alert("Projet 'Gestion Notifications' initialisé avec succès !");
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