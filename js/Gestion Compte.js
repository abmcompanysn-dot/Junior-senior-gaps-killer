/**
 * @file Gestion Compte - 
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
    // Création de la réponse de base. C'est la réponse qui sera envoyée si l'origine n'est pas autorisée.
    const output = ContentService.createTextOutput(null);
    const logDetails = {
        receivedHeaders: e.headers,
        origin: (e.headers.Origin || e.headers.origin),
        isAllowed: false,
        sentHeaders: {},
        diagnostic: ""
    };

    try {
        const config = getConfig();
        const origin = logDetails.origin;

        // Si l'origine de la requête est dans notre liste, on ajoute les en-têtes CORS.
        if (origin && config.allowed_origins.includes(origin)) {
            logDetails.isAllowed = true;
            logDetails.sentHeaders['Access-Control-Allow-Origin'] = origin;
            logDetails.sentHeaders['Access-Control-Allow-Methods'] = config.allowed_methods || 'GET, POST, OPTIONS';
            logDetails.sentHeaders['Access-Control-Allow-Headers'] = config.allowed_headers || 'Content-Type';

            output.addHeader('Access-Control-Allow-Origin', logDetails.sentHeaders['Access-Control-Allow-Origin']);
            output.addHeader('Access-Control-Allow-Methods', logDetails.sentHeaders['Access-Control-Allow-Methods']);
            output.addHeader('Access-Control-Allow-Headers', logDetails.sentHeaders['Access-Control-Allow-Headers']);

            if (config.allow_credentials) {
                logDetails.sentHeaders['Access-control-allow-credentials'] = 'true';
                output.addHeader('Access-Control-Allow-Credentials', 'true');
            }
            logDetails.diagnostic = "SUCCÈS : L'origine a été trouvée dans la liste autorisée. Les en-têtes CORS ont été envoyés. Si l'erreur persiste, vérifiez que le client envoie bien 'credentials: \"include\"' pour les requêtes authentifiées.";
        } else {
            logDetails.diagnostic = `ÉCHEC : L'origine '${origin}' n'a pas été trouvée dans la liste des origines autorisées par la configuration. Aucun en-tête CORS n'a été envoyé.`;
            logDetails.fix = `SOLUTION : Allez dans votre Google Sheet, dans l'onglet 'Config', et assurez-vous que la clé 'allowed_origins' contient bien la valeur '${origin}'. Si la clé existe, vérifiez qu'il n'y a pas de fautes de frappe. Après modification, attendez 10 minutes (durée du cache) ou redéployez le script pour un effet immédiat.`;
        }
    } catch (err) {
        // En cas d'erreur (ex: getConfig échoue), on ne fait rien, la réponse sans en-têtes sera envoyée,
        // ce qui provoquera un échec CORS propre côté client, comme attendu.
        logDetails.diagnostic = `ERREUR CRITIQUE dans doOptions : ${err.message}. Impossible de lire la configuration. Aucun en-tête CORS n'a été envoyé.`;
        logDetails.fix = "SOLUTION : Vérifiez que la feuille 'Config' existe et est correctement formatée. Vérifiez les journaux d'exécution du script Google pour plus de détails sur l'erreur.";
    }

    // On enregistre le rapport détaillé de ce qui s'est passé.
    logAction('PREFLIGHT_CHECK', logDetails);

    return output;
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
  // Les en-têtes CORS sont gérés exclusivement par doOptions pour éviter les erreurs TypeError.
  // Si doOptions réussit, le navigateur autorisera cette réponse.
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
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
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config_account';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://junior-senior-gaps-killer.vercel.app", "http://127.0.0.1:5500", "http://127.0.0.1:5501"],
    allowed_methods: "POST,GET,OPTIONS",
    allowed_headers: "Content-Type",
    allow_credentials: true
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
      allow_credentials: config.allow_credentials === 'true' || defaultConfig.allow_credentials
    };
    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600); // Cache 10 minutes
    return finalConfig;
  } catch (e) {
    return defaultConfig;
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

  // NOUVEAU: Ajout de données de test
  const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const lastRow = usersSheet.getLastRow();

  // On ajoute les données seulement si la feuille est vide (à part l'en-tête)
  if (lastRow < 2) {
    const testPassword = "password123";

    // Utilisateur Client
    const clientHash = hashPassword(testPassword);
    usersSheet.appendRow([
      "CLT-TEST-001", "Client Test", "client@test.com", clientHash.passwordHash, clientHash.salt,
      "221771112233", "Dakar, Sénégal", new Date(), "Actif", "Client", "", "Apprenant passionné", "Je suis ici pour apprendre !"
    ]);

    // Utilisateur Senior
    const seniorHash = hashPassword(testPassword);
    usersSheet.appendRow([
      "SNR-TEST-002", "Senior Test", "senior@test.com", seniorHash.passwordHash, seniorHash.salt,
      "221774445566", "Dakar, Sénégal", new Date(), "Actif", "Senior", "", "Formateur Expert", "15 ans d'expérience en développement."
    ]);
    ui.alert("Projet initialisé et 2 utilisateurs de test (client@test.com, senior@test.com) ont été ajoutés avec le mot de passe 'password123'.");
  } else {
    ui.alert("Projet 'Gestion Compte' initialisé avec succès ! Les onglets 'Utilisateurs', 'Logs' et 'Config' sont prêts.");
  }
}
