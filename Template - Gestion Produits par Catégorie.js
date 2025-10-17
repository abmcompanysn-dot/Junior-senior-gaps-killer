// --- Template - Gestion Produits par Catégorie ---
const CENTRAL_ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbwXJ7nGrftKjKHaG6r_I1i9HCmcFJHmDk8BEvmW1jbNpBnI7-DjnDw7eLEet9HeHRwF/exec"; // URL du script central

// NOUVEAU: Configuration centrale des attributs par catégorie
const CATEGORY_CONFIG = {
  "Chaussures": ["Pointure", "Couleur", "Matière", "Type", "Genre", "Semelle", "Usage"],
  "Vêtements": ["Taille", "Coupe", "Matière", "Couleur", "Genre", "Saison", "Style"],
  "Sacs": ["Volume", "Type", "Matière", "Couleur", "Usage", "Genre"],
  "Montres": ["Type", "Bracelet", "Cadran", "Marque", "Étanchéité", "Genre"],
  "Lunettes": ["Type", "Forme", "Couleur", "Protection UV", "Matière", "Genre"],
  "Bijoux": ["Type", "Métal", "Pierre", "Taille", "Genre", "Finition"],
  "Accessoires": ["Dimensions", "Compatibilité", "Matière", "Usage", "Couleur", "Poids"],
  "Beauté & soins": ["Type de peau", "Ingrédients", "Format", "Parfum", "Volume", "Genre"],
  "Parfums": ["Famille olfactive", "Notes", "Intensité", "Format", "Genre"],
  "Électronique": ["Marque", "Modèle", "Capacité", "Connectivité", "Compatibilité", "Garantie"],
  "Informatique": ["Processeur", "RAM", "Stockage", "Écran", "OS", "Connectivité", "Usage"],
  "Gaming": ["Plateforme", "Genre", "Éditeur", "PEGI", "Multijoueur", "Édition"],
  "Livres": ["Auteur", "Genre", "Langue", "Format", "Pages", "ISBN", "Édition"],
  "Musique": ["Artiste", "Genre", "Format", "Durée", "Label"],
  "Films & séries": ["Titre", "Genre", "Format", "Langue", "Durée", "Réalisateur", "Acteurs"],
  "Jeux & jouets": ["Âge", "Type", "Matière", "Dimensions", "Marque", "Éducatif/créatif"],
  "Sport & fitness": ["Usage", "Taille", "Poids", "Niveau", "Matière", "Pliable", "Intensité"],
  "Meubles": ["Dimensions", "Matière", "Style", "Usage", "Couleur", "Montage"],
  "Décoration": ["Type", "Matière", "Couleur", "Style", "Usage"],
  "Jardin": ["Type", "Usage", "Dimensions", "Matière", "Saison"],
  "Outillage": ["Type", "Puissance", "Usage", "Alimentation", "Marque", "Sécurité"],
  "Automobile": ["Marque", "Modèle", "Année", "Carburant", "Transmission", "Couleur"],
  "Moto & vélo": ["Type", "Taille", "Usage", "Marque", "Vitesse", "Accessoires inclus"],
  "Alimentation": ["Poids", "Ingrédients", "Origine", "Date limite", "Labels", "Type"],
  "Literie": ["Taille", "Matière", "Fermeté", "Épaisseur", "Traitement anti-acariens"],
  "Rideaux & stores": ["Type", "Dimensions", "Matière", "Opacité", "Fixation"],
  "Luminaires": ["Type", "Style", "Puissance", "Source", "Installation"],
  "Vaisselle": ["Type", "Matière", "Nombre de pièces", "Usage", "Compatibilité lave-vaisselle"],
  "Ustensiles de cuisine": ["Type", "Matière", "Usage", "Ergonomie", "Compatibilité"],
  "Rangement": ["Type", "Dimensions", "Matière", "Capacité", "Empilable"],
  "Salle de bain": ["Type", "Matière", "Dimensions", "Installation", "Usage"],
  "Cuisine équipée": ["Type", "Dimensions", "Finition", "Électroménagers inclus"],
  "Climatisation": ["Type", "Puissance", "Surface couverte", "Consommation", "Installation"],
  "Chauffage": ["Type", "Puissance", "Technologie", "Sécurité", "Mobilité"],
  "Instruments de musique": ["Type", "Marque", "Matière", "Niveau", "Accessoires inclus"],
  "Matériel artistique": ["Type", "Format", "Couleur", "Technique", "Usage"],
  "Loisirs créatifs": ["Type", "Niveau", "Matière", "Thème", "Âge"],
  "Couture & tricot": ["Type", "Matière", "Couleur", "Format", "Compatibilité machine"],
  "Modélisme": ["Type", "Échelle", "Matériau", "Niveau", "Motorisation"],
  "Photographie": ["Type", "Résolution", "Format", "Connectivité", "Accessoires"],
  "Scrapbooking": ["Type", "Format", "Thème", "Couleur", "Nombre d’éléments"],
  "Calligraphie": ["Type", "Pointe", "Encre", "Format", "Usage"],
  "Fournitures scolaires": ["Type", "Format", "Niveau", "Matière", "Compatibilité"],
  "Jeux éducatifs": ["Âge", "Matière", "Thème", "Niveau", "Nombre de joueurs"],
  "Livres jeunesse": ["Âge", "Genre", "Format", "Langue", "Illustration"],
  "Mobilier enfant": ["Type", "Dimensions", "Sécurité", "Matière", "Évolutif"],
  "Vêtements bébé": ["Taille", "Matière", "Sécurité", "Saison", "Genre"],
  "Puériculture": ["Type", "Sécurité", "Âge", "Format", "Compatibilité"],
  "Yoga & méditation": ["Type", "Matière", "Niveau", "Usage", "Format"],
  "Compléments alimentaires": ["Type", "Ingrédients", "Posologie", "Certification", "Format"],
  "Huiles essentielles": ["Plante", "Usage", "Format", "Certification", "Origine"],
  "Matériel médical": ["Type", "Usage", "Format", "Précision", "Homologation"],
  "Produits d’hygiène": ["Type", "Format", "Ingrédients", "Usage", "Certification"],
  "Soins capillaires": ["Type", "Format", "Ingrédients", "Usage", "Texture"],
  "Matériaux": ["Type", "Dimensions", "Matière", "Usage", "Certification"],
  "Équipements de chantier": ["Type", "Puissance", "Sécurité", "Mobilité", "Usage"],
  "Électricité": ["Type", "Tension", "Compatibilité", "Installation", "Sécurité"],
  "Plomberie": ["Type", "Diamètre", "Matière", "Installation", "Usage"],
  "Quincaillerie": ["Type", "Dimensions", "Matière", "Usage", "Résistance"],
  "Équipements de protection": ["Type", "Norme", "Taille", "Usage", "Matière"],
  "Bagages": ["Type", "Dimensions", "Matière", "Roues", "Sécurité"],
  "Accessoires de voyage": ["Type", "Usage", "Format", "Compatibilité", "Sécurité"],
  "Guides touristiques": ["Destination", "Langue", "Format", "Édition", "Thématique"],
  "Camping": ["Type", "Dimensions", "Matière", "Usage", "Saison"],
  "Randonnée": ["Type", "Niveau", "Matière", "Poids", "Imperméabilité"],
  "Mobilité urbaine": ["Type", "Autonomie", "Vitesse", "Poids", "Pliable"],
};

// NOUVEAU: Création de la catégorie universelle en regroupant tous les attributs uniques
const allUniqueAttributes = [...new Set(Object.values(CATEGORY_CONFIG).flat())];
CATEGORY_CONFIG["Universel (Tous les attributs)"] = allUniqueAttributes;


const BASE_HEADERS = ["IDProduit", "Nom", "Marque", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif", "Catégorie", "NoteMoyenne", "NombreAvis", "Galerie", "LivraisonGratuite"];

/**
 * NOUVEAU: Récupère les en-têtes pour une catégorie spécifique.
 */
function getCategorySpecificHeaders(categoryName) {
  const specificAttributes = CATEGORY_CONFIG[categoryName] || [];
  return [...BASE_HEADERS, ...specificAttributes];
}

const PERSONAL_DATA = {
  logoUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
  // NOUVEAU: Utilisation de 5 images différentes pour une galerie de test plus réaliste.
  gallery: [
    'https://picsum.photos/id/1015/800/800', // Image de paysage
    'https://picsum.photos/id/1018/800/800', // Image de plage
    'https://picsum.photos/id/1025/800/800', // Image de chien
    'https://picsum.photos/id/1040/800/800', // Image de château
    'https://picsum.photos/id/1060/800/800'  // Image de forêt
  ].join(','),
  getProducts: function(categoryName) {
    const specificAttributes = CATEGORY_CONFIG[categoryName] || [];
    let products = [];
    for (let i = 1; i <= 10; i++) { // MODIFICATION: Génère 10 produits au lieu de 100
        const price = (Math.floor(Math.random() * 20) + 5) * 10000;
        const product = {
            nom: `${categoryName} Produit ${i}`, marque: `Marque ${String.fromCharCode(65 + i)}`, categorie: categoryName,
            prixActuel: price, reduction: i % 3 === 0 ? 10 : 0, stock: Math.floor(Math.random() * 50) + 10,
            noteMoyenne: (Math.random() * 1.0 + 4.0).toFixed(1), nombreAvis: Math.floor(Math.random() * 100),
            imageURL: this.logoUrl, galerie: this.gallery,
            description: `Description détaillée pour le produit ${i} de la catégorie ${categoryName}.`,
            livraisonGratuite: i % 4 === 0, // Un produit sur 4 aura la livraison gratuite pour le test
            tags: `${categoryName.toLowerCase()},nouveau,populaire`
        };

        // NOUVEAU: Ajoute des valeurs de test pour les attributs spécifiques à la catégorie
        specificAttributes.forEach(attr => {
            if (attr.toLowerCase().includes('taille') || attr.toLowerCase().includes('pointure')) {
                product[attr] = "S,M,L,XL"
            } else if (attr.toLowerCase().includes('couleur')) {
                product[attr] = "Rouge,Bleu,Noir";
            } else if (attr.toLowerCase().includes('matière')) {
                product[attr] = "Coton,Soie";
            } else {
                product[attr] = `Valeur ${attr} ${i}`;
            }
        });
        products.push(product);
    }
    return products;
  }
};

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Gestion Catégorie');
  
  // Crée un sous-menu dynamique pour l'initialisation
  const initMenu = ui.createMenu('Initialiser la feuille comme...');
  // NOUVELLE APPROCHE: Utiliser une seule fonction générique
  // On crée un item de menu pour chaque catégorie, mais tous appellent la même fonction `setupSheet`.
  // Malheureusement, les menus ne peuvent pas passer de paramètres directement.
  // La solution est de créer une fonction "wrapper" pour chaque catégorie.
  Object.keys(CATEGORY_CONFIG).sort().forEach(catName => {
    initMenu.addItem(catName, `initSheetFor_${catName.replace(/[^a-zA-Z0-9]/g, '')}`);
  });
  
  menu.addSubMenu(initMenu)
      .addSeparator()
      .addItem('Forcer la mise à jour du cache global', 'invalidateGlobalCache')
      .addSeparator()
      .addItem('Ajouter un produit', 'showProductAddUI')
      .addToUi();
}

// NOUVEAU: Créer dynamiquement les fonctions "wrapper" qui appellent setupSheet
// avec le bon nom de catégorie. C'est la méthode la plus robuste pour Google Apps Script.
Object.keys(CATEGORY_CONFIG).forEach(catName => {
  const functionName = `initSheetFor_${catName.replace(/[^a-zA-Z0-9]/g, '')}`;
  this[functionName] = function() {
    setupSheet(catName);
  };
});

/**
 * NOUVEAU: Se déclenche automatiquement à chaque modification de la feuille.
 */
function onEdit(e) {
  // On ne fait rien si c'est juste une sélection de cellule
  if (!e.range || e.range.getHeight() === 0 || e.range.getWidth() === 0) {
    return;
  }
  // On ignore les modifications sur la première ligne (en-têtes)
  if (e.range.getRow() === 1) {
    return;
  }
  
  Logger.log("Modification détectée. Invalidation du cache global demandée.");
  invalidateGlobalCache();
}

/**
 * Gère les requêtes OPTIONS pour le pré-vol CORS. Essentiel pour les requêtes POST.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Point d'entrée pour les requêtes GET (ex: obtenir le nombre/liste de produits).
 */
function doGet(e) {
  const origin = e.headers ? e.headers.Origin : null;
  try {
    const action = e.parameter.action;
    if (action === 'getProductCount') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheets()[0];
      const productCount = sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 0; // Soustraire la ligne d'en-tête
      return createJsonResponse({ success: true, count: productCount }, origin);
    }
    if (action === 'getProducts') {
      const products = sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]);
      Logger.log("Données des produits à envoyer : " + JSON.stringify(products, null, 2)); // Log pour vérifier les données
      const responseData = { success: true, data: products };
      return createJsonResponse(responseData, origin);
    }
    return createJsonResponse({ success: false, error: "Action GET non reconnue." }, origin);
  } catch (error) {
    Logger.log("ERREUR dans la fonction doGet : " + error.toString()); // Log en cas d'erreur
    return createJsonResponse({ success: false, error: error.message }, origin);
  }
}

/**
 * NOUVEAU: Point d'entrée pour les requêtes POST (modifier, supprimer, etc.).
 */
function doPost(e) {
  const origin = e.headers ? e.headers.Origin : null;
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const data = request.data;

    if (!action) {
      return createJsonResponse({ success: false, error: 'Action non spécifiée.' }, origin);
    }

    switch (action) {
      case 'ajouterProduit':
        return addProduct(data, origin);
      case 'updateProduct':
        return updateProduct(data, origin);
      case 'deleteProduct':
        return deleteProduct(data, origin);
      default:
        return createJsonResponse({ success: false, error: `Action POST non reconnue: ${action}` }, origin);
    }
  } catch (error) {
    Logger.log("ERREUR dans la fonction doPost : " + error.toString());
    return createJsonResponse({ success: false, error: error.message }, origin);
  }
}


/**
 * Logique partagée pour ajouter un produit à la feuille de calcul.
 */
function addProduct(productData, origin) { // La fonction addProduct existe déjà, on s'assure qu'elle a le paramètre 'origin'
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newProductId = "PROD-" + Utilities.getUuid().substring(0, 6).toUpperCase();

  if (sheet.getLastRow() === 0) {
    // Ne devrait pas arriver si setupSheet est utilisé
    return createJsonResponse({ success: false, error: "Feuille non initialisée." }, origin);
  }

  const newRow = headers.map(header => {
      // CORRECTION: Standardisation de la casse pour correspondre aux en-têtes.
      switch(header) {
        case "IDProduit": return newProductId;
        case "Nom": return productData.nom || '';
        case "Marque": return productData.marque || '';
        case "PrixActuel": return productData.prixActuel || 0;
        case "PrixAncien": 
          // NOUVEAU: Calculer le prix ancien s'il y a une réduction
          return (productData.reduction > 0) ? Math.round(productData.prixActuel / (1 - (productData.reduction / 100))) : productData.prixActuel;
        case "Réduction%": return productData.reduction || 0;
        case "Stock": return productData.stock || 0;
        case "ImageURL": return productData.imageURL || '';
        case "Description": return productData.description || '';
        case "Tags": return productData.tags || '';
        case "Actif": return true; // Actif par défaut
        case "Catégorie": return productData.categorie || '';
        case "NoteMoyenne": return productData.noteMoyenne || 0;
        case "NombreAvis": return productData.nombreAvis || 0;
        case "Galerie": return productData.galerie || '';
        case "LivraisonGratuite": return productData.livraisonGratuite || false;
        default: return productData[header] || ''; // Pour les attributs spécifiques
      }
  });
  
  sheet.appendRow(newRow);
  
  // NOUVEAU: Invalider le cache global après l'ajout d'un produit
  invalidateGlobalCache();
  return createJsonResponse({ success: true, id: newProductId }, origin);
}

/**
 * NOUVEAU: Met à jour un produit existant dans la feuille.
 */
function updateProduct(productData, origin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumn = headers.indexOf("IDProduit") + 1;

  if (idColumn === 0) {
    return createJsonResponse({ success: false, error: "Colonne 'IDProduit' introuvable." }, origin);
  }

  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[idColumn - 1] === productData.IDProduit);

  if (rowIndex === -1) {
    return createJsonResponse({ success: false, error: `Produit avec ID ${productData.IDProduit} non trouvé.` }, origin);
  }

  // Mettre à jour les valeurs dans la ligne trouvée
  headers.forEach((header, colIndex) => {
    if (productData.hasOwnProperty(header)) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(productData[header]);
    }
  });

  invalidateGlobalCache();
  return createJsonResponse({ success: true, id: productData.IDProduit }, origin);
}

/**
 * NOUVEAU: Supprime un produit de la feuille.
 */
function deleteProduct(productData, origin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumn = headers.indexOf("IDProduit") + 1;

  if (idColumn === 0) {
    return createJsonResponse({ success: false, error: "Colonne 'IDProduit' introuvable." }, origin);
  }

  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[idColumn - 1] === productData.IDProduit);

  if (rowIndex === -1) {
    return createJsonResponse({ success: false, error: `Produit avec ID ${productData.IDProduit} non trouvé.` }, origin);
  }

  // La première ligne de données est à l'index 1, mais dans la feuille c'est la ligne 2.
  sheet.deleteRow(rowIndex + 1);

  invalidateGlobalCache();
  return createJsonResponse({ success: true, id: productData.IDProduit }, origin);
}

/**
 * Fonction appelée par l'interface HTML dédiée à cette catégorie (via google.script.run).
 */
function addProductFromUI(productData) {
  try {
    const response = addProduct(productData);
    // google.script.run attend un objet simple, pas une réponse ContentService
    return JSON.parse(response.getContent());
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Affiche l'interface d'ajout de produit dans une barre latérale.
 */
function showProductAddUI() {
  const html = HtmlService.createHtmlOutputFromFile('ProductAddInterface').setTitle('Ajouter un Produit');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Prépare la feuille de calcul avec les en-têtes corrects pour une catégorie donnée.
 */
function setupSheet(categoryName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const headers = getCategorySpecificHeaders(categoryName);
  sheet.clear();
  
  // NOUVEAU: Nettoyer le nom de la catégorie pour qu'il soit valide comme nom de feuille.
  const safeSheetName = categoryName.replace(/&/g, 'et').replace(/[\\/*?:"<>|]/g, ''); // Remplace '&' et supprime les caractères invalides.
  sheet.setName(safeSheetName);

  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  
  seedDefaultProducts(categoryName); // NOUVEAU: Ajoute les produits de test automatiquement
  SpreadsheetApp.getUi().alert(`Feuille initialisée comme "${categoryName}" et remplie avec 10 produits de test.`);
}

/**
 * Renvoie le nom de la feuille active pour l'afficher dans l'UI.
 */
function getCategoryName() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName();
}

/**
 * NOUVEAU: Utilitaire pour invalider le cache global
 */
function invalidateGlobalCache() {
  // Appelle le script central pour lui dire de mettre à jour la version du cache.
  UrlFetchApp.fetch(CENTRAL_ADMIN_API_URL + "?action=invalidateCache", {
    method: 'get', muteHttpExceptions: true
  });
  Logger.log("Demande d'invalidation du cache global envoyée.");
}

/**
 * Remplit la feuille avec 100 produits de test pour la catégorie donnée.
 */
function seedDefaultProducts(categoryName) {
  const products = PERSONAL_DATA.getProducts(categoryName);

  products.forEach(productData => {
    addProduct(productData);
  });
}

/**
 * Crée une réponse JSON standard.
 */
function createJsonResponse(data, origin) { // Ajout de 'origin' pour la cohérence
  // CORRECTION : La réponse DOIT inclure l'en-tête CORS pour être acceptée par le navigateur.
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  // Autorise toutes les origines. La fonction doOptions gère la requête de pré-vol.
  output.addHeader('Access-Control-Allow-Origin', '*');
  return output;
}

/**
 * Utilitaire pour convertir une feuille en JSON.
 */
function sheetToJSON(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  // CORRECTION: Utiliser getRange avec getLastColumn pour s'assurer que toutes les colonnes sont lues.
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