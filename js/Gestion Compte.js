/**
 * @file Gestion Compte - API pour abmcymarket.vercel.app
 * @description Gère l'authentification des clients,
 * la journalisation des événements et la récupération des données spécifiques au client.
 *
 * @version 3.1.1 (Correction TypeError addHeader/setHeader)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---

// Noms des feuilles de calcul utilisées
const SHEET_NAMES = {
    USERS: "Utilisateurs",
    LOGS: "Logs",
    CONFIG: "Config"
};

// --- POINTS D'ENTRÉE DE L'API WEB (doGet, doPost, doOptions) ---

/**
 * Gère les requêtes HTTP GET.
 * Utilisé principalement pour récupérer des données publiques ou des journaux.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doGet(e) {
    const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
    const action = e && e.parameter ? e.parameter.action : null;

    if (action === 'getAppLogs') {
        // Retourne la réponse JSON directement
        return getAppLogs(e.parameter, origin);
    }

    // Réponse par défaut pour un simple test de l'API
    return createJsonResponse({
      success: true,
      message: 'API Gestion Compte - Active'
    }, origin);
}

/**
 * Gère les requêtes HTTP POST.
 * Point d'entrée principal pour les actions (connexion, inscription, etc.).
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doPost(e) {
    const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
    try {
        if (!e || !e.postData ||  !e.postData.contents) {
            throw new Error("Requête POST invalide ou vide.");
        }

        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        if (!action) {
            return createJsonResponse({ success: false, error: 'Action non spécifiée.' }, origin);
        }

        // Routeur pour les actions POST
        switch (action) {
            case 'creerCompteClient':
                return creerCompteClient(data, origin);
            case 'connecterClient':
                return connecterClient(data, origin);
            case 'updateProfile': // NOUVEAU
                return updateProfile(data, origin);
            case 'logClientEvent':
                return logClientEvent(data, origin);
            default:
                logAction('doPost', { error: 'Action non reconnue', action: action });
                return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }, origin);
        }

    } catch (error) {
        logError(e.postData ? e.postData.contents : 'No postData', error);
        return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }, origin);
    }
}

/**
 * Gère les requêtes HTTP OPTIONS pour la pré-vérification CORS.
 * NOTE: C'est le seul endroit où setHeader/addHeader fonctionne correctement pour CORS.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse vide.
 */
function doOptions(e) {
    const ALLOWED_ORIGINS = ["https://junior-senior-gaps-killer.vercel.app", "http://127.0.0.1:5500", "http://127.0.0.1:5501"];
    const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || null;
    const headers = ContentService.createTextOutput(null)
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers.addHeader('Access-Control-Allow-Origin', origin);
    }
    return headers;
}


// --- LOGIQUE MÉTIER (ACTIONS DE L'API) ---

/**
 * Crée un nouveau compte client.
 * @param {object} data - Données du client (nom, email, motDePasse).
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function creerCompteClient(data, origin) {
    const { nom, email, motDePasse, role = 'Client' } = data; // Déstructuration et valeur par défaut
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        // AMÉLIORATION: Recherche d'email plus robuste
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const emailIndex = headers.indexOf("Email");
        if (emailIndex === -1) throw new Error("La colonne 'Email' est introuvable.");
        const emailColumnValues = sheet.getRange(2, emailIndex + 1, sheet.getLastRow()).getValues().flat();
        const emailExists = emailColumnValues.some(existingEmail => existingEmail.toLowerCase() === email.toLowerCase());

        if (emailExists) {
            return createJsonResponse({ success: false, error: 'Un compte avec cet email existe déjà.' }, origin);
        }

        const idClient = "CLT-" + new Date().getTime();
        const { passwordHash, salt } = hashPassword(motDePasse);

        sheet.appendRow([
            idClient, nom, email, passwordHash, salt, data.telephone || '', data.adresse || '',
            new Date(), "Actif", role, "" // Laisser ImageURL vide au début
        ]);

        logAction('creerCompteClient', { email: email, id: idClient, role: role });
        return createJsonResponse({ success: true, id: idClient }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'creerCompteClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * Gère la connexion d'un client.
 * @param {object} data - Données de connexion (email, motDePasse).
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les infos utilisateur si succès.
 */
function connecterClient(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getDataRange().getValues();
        const headers = usersData.shift();
        const emailIndex = headers.indexOf("Email");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const userRow = usersData.find(row => row[emailIndex] === data.email);

        if (!userRow) {
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        const storedHash = userRow[hashIndex];
        const salt = userRow[saltIndex];
        const { passwordHash: providedPasswordHash } = hashPassword(data.motDePasse, salt);

        if (providedPasswordHash !== storedHash) {
            logAction('connecterClient', { email: data.email, success: false });
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        // Connexion réussie, on retourne les informations de l'utilisateur
        const userObject = headers.reduce((obj, header, index) => {
            // Exclure les informations sensibles
            if (header !== 'PasswordHash' && header !== 'Salt') {
                obj[header] = userRow[index];
            }
            return obj;
        }, {});

        logAction('connecterClient', { email: data.email, success: true, id: userObject.IDClient });
        return createJsonResponse({ success: true, user: userObject }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'connecterClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Met à jour le profil d'un utilisateur.
 */
function updateProfile(data, origin) {
    try {
        if (!data || !data.userId) {
            throw new Error("ID utilisateur manquant pour la mise à jour.");
        }
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift();

        const idIndex = headers.indexOf("IDClient");
        const rowIndex = allUsers.findIndex(row => row[idIndex] === data.userId);

        if (rowIndex === -1) {
            throw new Error("Utilisateur non trouvé.");
        }

        // Mettre à jour les colonnes spécifiques
        const rowToUpdate = rowIndex + 2; // +1 pour l'index 0, +1 pour la ligne d'en-tête
        if (data.bio) {
            const bioIndex = headers.indexOf("Bio"); // Assurez-vous que cette colonne existe
            if (bioIndex !== -1) sheet.getRange(rowToUpdate, bioIndex + 1).setValue(data.bio);
        }
        if (data.titre) {
            const titreIndex = headers.indexOf("Titre"); // Assurez-vous que cette colonne existe
            if (titreIndex !== -1) sheet.getRange(rowToUpdate, titreIndex + 1).setValue(data.titre);
        }
        if (data.imageUrl) {
            const imageUrlIndex = headers.indexOf("ImageURL");
            if (imageUrlIndex !== -1) sheet.getRange(rowToUpdate, imageUrlIndex + 1).setValue(data.imageUrl);
        }

        return createJsonResponse({ success: true, message: "Profil mis à jour." }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'updateProfile', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * Enregistre un événement envoyé par le client dans la feuille de logs.
 * @param {object} data - L'objet log envoyé par le client.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function logClientEvent(data, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const details = {
            message: data.message,
            url: data.url,
            error: data.error,
            payload: data.payload,
        };
        logSheet.appendRow([new Date(data.timestamp), 'FRONT-END', data.type, JSON.stringify(details)]);
        return createJsonResponse({ success: true }, origin);
    } catch (e) {
        return createJsonResponse({ success: false, error: e.message }, origin);
    }
}

/**
 * Récupère les 100 derniers journaux pour la page log.html.
 * @param {object} params - Paramètres de la requête GET.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function getAppLogs(params, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const lastRow = logSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 99);
        const numRows = lastRow > 1 ? lastRow - startRow + 1 : 0;
        const logs = (numRows > 0) ? logSheet.getRange(startRow, 1, numRows, 4).getValues() : [];
        return createJsonResponse({ success: true, logs: logs.reverse() }, origin);
    } catch (error) {
        logError('getAppLogs', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

// --- FONCTIONS UTILITAIRES ---

/**
 * Crée une réponse JSON standardisée avec le MimeType.
 * @param {object} data - L'objet à convertir en JSON.
 * @param {string} origin - L'origine de la requête pour les en-têtes CORS.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput.
 */
function createJsonResponse(data, origin) {
  const ALLOWED_ORIGINS = ["https://junior-senior-gaps-killer.vercel.app", "http://127.0.0.1:5500", "http://127.0.0.1:5501"];
  const output = ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    output.addHeader('Access-Control-Allow-Origin', origin);
  }
  return output;
}

/**
 * Hache un mot de passe avec un sel (salt).
 * @param {string} password - Le mot de passe en clair.
 * @param {string} [salt] - Le sel à utiliser. Si non fourni, un nouveau sera généré.
 * @returns {{passwordHash: string, salt: string}} Le mot de passe haché et le sel utilisé.
 */
function hashPassword(password, salt) {
    const saltValue = salt || Utilities.getUuid();
    // On combine le mot de passe et le sel avant de hacher.
    const toHash = password + saltValue;
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
    const passwordHash = Utilities.base64Encode(digest);
    return { passwordHash, salt: saltValue };
}

/**
 * Journalise une action réussie dans la feuille "Logs".
 * @param {string} action - Le nom de l'action.
 * @param {object} details - Les détails de l'action.
 */
function logAction(action, details) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END (COMPTE)", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

/**
 * Journalise une erreur dans la feuille "Logs".
 * @param {string} context - Le contexte où l'erreur s'est produite.
 * @param {Error} error - L'objet erreur.
 */
function logError(context, error) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const errorDetails = {
            context: context,
            message: error.message,
            stack: error.stack
        };
        logSheet.appendRow([new Date(), "BACK-END (COMPTE)", "ERROR", JSON.stringify(errorDetails)]);
    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Configuration Module')
      .addItem('🚀 Initialiser le projet', 'setupProject')
      .addToUi();
}

/**
 * Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // NOUVEAU: Assurer que les colonnes Titre et Bio sont incluses
  const sheetsToCreate = {
    [SHEET_NAMES.USERS]: ["IDClient", "Nom", "Email", "PasswordHash", "Salt", "Telephone", "Adresse", "Date d'inscription", "Statut", "Role", "ImageURL", "Titre", "Bio"],
    [SHEET_NAMES.LOGS]: ["Timestamp", "Source", "Action", "Détails"]
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    // Vider la feuille et réécrire les en-têtes pour garantir la conformité
    sheet.clear();
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  });

  ui.alert("Projet 'Gestion Compte' initialisé avec succès ! Les onglets 'Utilisateurs', 'Logs' et 'Config' sont prêts.");
}

/**
 * DÉPRÉCIÉ ET SUPPRIMÉ: La fonction addCorsHeaders n'est pas nécessaire et causait le TypeError.
 * La suppression du corps de la fonction est la correction.
 */
// function addCorsHeaders(output) {
//     output.addHeader('Access-Control-Allow-Origin', 'https://junior-senior-gaps-killer.vercel.app');
//     output.addHeader('Access-Control-Allow-Credentials', 'true');
//     return output;
// }


/**
 * Construit un objet d'en-têtes CORS basé sur la configuration.
 * (Conservée, bien que non utilisée directement pour setHeader.)
 * @param {string} origin - L'origine de la requête.
 * @returns {object} Un objet contenant les en-têtes CORS.
 */
function getCorsHeaders(origin) {
    const config = getConfig();
    const headers = {};

    if (origin && config.allowed_origins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = config.allowed_methods;
        headers['Access-Control-Allow-Headers'] = config.allowed_headers;
        if (config.allow_credentials) {
            headers['Access-Control-Allow-Credentials'] = 'true';
        }
    } else {
        // Pour les requêtes GET simples sans origine (ex: test direct), on reste permissif.
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return headers;
}
