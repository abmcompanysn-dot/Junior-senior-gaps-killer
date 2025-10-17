const CONFIG = {
    // URL de l'API pour la gestion des comptes (authentification, etc.)
    ACCOUNT_API_URL: "https://script.google.com/macros/s/AKfycbwRpCI4watBHo8R6jkvcVpPb8pTVTbtR5Kg2vOvHby1Kdweo7nx4G-LEMfE9HQ5vRnc/exec",
    // NOUVEAU: URL de l'API dédiée à la gestion des commandes
    ORDER_API_URL: "https://script.google.com/macros/s/AKfycbwrLOxtez1UrrXVj2iugSiLtAYOhhaef9x-HlpvvvxmQxsMVYRVQeShy4V56vfhjBxq/exec",

    // NOUVEAU: URL de l'API dédiée à la gestion des livraisons
    DELIVERY_API_URL: "URL_DU_SCRIPT_GESTION_LIVRAISONS",

    // NOUVEAU: URL de l'API dédiée aux notifications
    NOTIFICATION_API_URL: "URL_DU_SCRIPT_GESTION_NOTIFICATIONS",

    // URL du script central pour le catalogue de produits.
    CENTRAL_API_URL: "https://script.google.com/macros/s/AKfycbxh1olxmG44KS1Gq_RA6zviC6M1xQkIUYr_0KeAS4qNILwypNLXYNQHcqFwiP9Rg5tWFw/exec",
    
    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/D0b7ZxQc/Logo-for-Training-Platform-Dynamic-Emblem.png",
};

// Variables globales pour le chargement progressif de la page d'accueil
let categoryDirectory = []; // Stocke la liste des catégories et leurs URLs
let allLoadedProducts = []; // Stocke tous les produits déjà chargés
let renderedCategoriesCount = 0;
const CATEGORIES_PER_LOAD = 3;

let DELIVERY_OPTIONS = {}; // NOUVEAU: Sera chargé depuis l'API

// Attendre que le contenu de la page soit entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser toutes les fonctionnalités du site
    initializeApp();
});

/**
 * Fonction principale ASYNCHRONE qui initialise l'application.
 */
async function initializeApp() {
    // --- ÉTAPE 1: Rendu immédiat de ce qui ne dépend pas des données distantes ---
    updateCartBadges();
    initializeSearch(); // Les formulaires de recherche peuvent être initialisés immédiatement.
    if (document.getElementById('auth-forms')) {
        document.getElementById('login-form').addEventListener('submit', (e) => handleAuthForm(e, 'login'));
        document.getElementById('register-form').addEventListener('submit', (e) => handleAuthForm(e, 'register'));
    }
    if (document.querySelector('main h1.text-3xl')?.textContent.includes("Mon Compte")) {
        initializeAccountPage(); // La page compte gère sa propre logique d'authentification.
    }
    if (document.getElementById('panier-page')) {
        renderCartPage(); // Le panier lit depuis le localStorage, pas besoin d'attendre l'API.
    }
    // NOUVEAU: Initialiser immédiatement le squelette de la page catégorie si on y est.
    if (window.location.pathname.endsWith('categorie.html')) {
        initializeCategoryPage();
    }

    if (document.getElementById('countdown')) {
        startCountdown(); // Le compte à rebours est indépendant.
    }

    // --- ÉTAPE 2: Lancer le chargement des données en arrière-plan ---
    // On ne bloque PAS le reste de l'exécution de la page.
    const catalogPromise = getCatalogAndRefreshInBackground();

    // --- ÉTAPE 3: Remplir les sections qui dépendent des données une fois qu'elles sont prêtes ---
    catalogPromise.then(catalog => {
        if (!catalog || !catalog.success) {
            console.error("Impossible de charger le catalogue. Le site pourrait ne pas fonctionner correctement.");
            return;
        }

        // Remplir les menus et les liens de navigation
        populateCategoryMenu(catalog);
        populateNavLinks(catalog);

        // Remplir le contenu spécifique à la page actuelle
        if (window.location.pathname.endsWith('recherche.html')) displaySearchResults(catalog);
        if (window.location.pathname.endsWith('categorie.html')) fillCategoryProducts(catalog);
        if (window.location.pathname.endsWith('categorie.html')) updateWhatsAppLinkForCategory(catalog); // NOUVEAU
        if (window.location.pathname.endsWith('promotions.html')) displayPromotionProducts(catalog); // Gardé pour la page promo
        if (window.location.pathname.endsWith('produit.html')) loadCoursePage(catalog); // MODIFIÉ
        
        // Remplir les sections de la page d'accueil
        if (document.getElementById('superdeals-products')) {
            renderDailyDealsHomepage(catalog);
            renderAllCategoriesSection(catalog);
            renderHomepageCategorySections(catalog);
        }

        // NOUVEAU: Si on est sur la page panier, on charge aussi les promos
        if (document.getElementById('panier-page')) {
            renderPromoProductsInCart(catalog);
        }
    });
}

/**
 * Gère l'ouverture et la fermeture du menu des catégories (menu hamburger).
 */
function toggleMobileMenu() {
    // Cette fonction est maintenant utilisée pour le menu déroulant sur desktop
    // et pourrait être réutilisée pour un menu mobile si besoin.
    // La logique actuelle de l'index.html gère l'affichage avec :hover,
    // mais une fonction JS peut être utile pour la compatibilité tactile.
    const menu = document.querySelector('.dropdown-menu');
    if (menu) {
        // Pour une gestion par clic, on pourrait faire : menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Remplit dynamiquement le menu des catégories à partir du fichier categories.js.
 */
function populateCategoryMenu(catalog) {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return; // S'assure que l'élément existe
    const boutiquesMenu = document.getElementById('boutiques-menu');
    let menuHTML = ''; // Initialiser la variable ici

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));

        // Ajout d'un titre pour le menu déroulant
        menuHTML = `<div class="p-2 border-b"><h3 class="font-semibold text-sm text-gray-500 px-2">Toutes les catégories</h3></div>`;

        if (categories.length > 0) {
            menuHTML += categories.map(cat => `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${cat.NomCategorie}</a>`).join('');
        }
        // Ajout du lien vers les promotions (toujours visible)
        menuHTML += '<a href="promotion.html" class="block px-4 py-2 text-sm text-red-600 font-semibold hover:bg-gray-100">Promotions</a>';
        
        menu.innerHTML = menuHTML;
        if (boutiquesMenu) boutiquesMenu.innerHTML = menuHTML;
    } catch (error) {
        console.error("Erreur lors du chargement des menus de catégories:", error);
        const errorHTML = '<p class="px-4 py-2 text-sm text-red-500">Erreur de chargement.</p>';
        menu.innerHTML = errorHTML;
        if (boutiquesMenu) boutiquesMenu.innerHTML = errorHTML;
    }
}

/**
 * NOUVEAU: Remplit dynamiquement les liens de navigation principaux et de la bannière.
 */
function populateNavLinks(catalog) {
    const mainLinksContainer = document.getElementById('main-nav-links');
    const bannerLinksContainer = document.getElementById('banner-nav-links');

    // Ne fait rien si le conteneur principal n'existe pas
    if (!mainLinksContainer) return;

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const MANY_CATEGORIES_THRESHOLD = 8;

        let mainNavCategories = [];
        let bannerNavCategories = [];

        // La logique de division s'applique seulement si on est sur la page d'accueil (où bannerLinksContainer existe)
        if (bannerLinksContainer && categories.length > MANY_CATEGORIES_THRESHOLD) {
            // S'il y a beaucoup de catégories, on les divise
            mainNavCategories = categories.slice(0, 4); // Les 4 premières pour le haut
            bannerNavCategories = categories.slice(4, 10); // Les 6 suivantes pour la bannière
        } else {
            // Sinon, on utilise les mêmes pour les deux (jusqu'à 6)
            mainNavCategories = categories.slice(0, 4);
            bannerNavCategories = categories.slice(0, 6);
        }

        // Générer le HTML pour la navigation principale
        let mainNavHTML = '<a href="promotions.html" class="py-3 text-red-600 hover:text-red-800">SuperDeals</a>'; // Lien fixe
        mainNavHTML += mainNavCategories.map(cat => 
            `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="py-3 text-gray-700 hover:text-gold">${cat.NomCategorie}</a>`
        ).join('');
        mainLinksContainer.innerHTML = mainNavHTML;

        // Générer le HTML pour la navigation de la bannière
        if (bannerLinksContainer) {
            bannerLinksContainer.innerHTML = bannerNavCategories.map((cat, index) => {
                // Logique pour cacher des liens sur mobile si nécessaire
                const responsiveClasses = index > 2 ? 'hidden sm:block' : '';
                return `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="px-4 py-1 hover:bg-white/20 rounded-full transition ${responsiveClasses}">${cat.NomCategorie}</a>`;
            }).join('');
        }

    } catch (error) {
        console.error("Erreur lors du remplissage des liens de navigation:", error);
    }
}
// --- LOGIQUE DU PANIER ---

/**
 * Récupère le panier depuis le localStorage.
 * @returns {Array} Le tableau des articles du panier.
 */
function getCart() {
    return JSON.parse(localStorage.getItem('abmcyCart')) || [];
}

/**
 * Sauvegarde le panier dans le localStorage.
 * @param {Array} cart - Le tableau des articles du panier.
 */
function saveCart(cart) {
    localStorage.setItem('abmcyCart', JSON.stringify(cart));
    updateCartBadges();
}

/**
 * Ajoute un produit au panier.
 * @param {Event} event - L'événement du clic pour l'empêcher de suivre le lien.
 * @param {string} productId - L'ID unique du produit.
 * @param {string} name - Le nom du produit.
 * @param {number} price - Le prix du produit.
 * @param {string} imageUrl - L'URL de l'image du produit.
 */
function addToCart(event, productId, name, price, imageUrl) {
    if (event) { // Empêche la navigation si on clique sur un bouton dans un lien <a>
        event.preventDefault();
        event.stopPropagation();
    }

    const cart = getCart();
    const quantityInput = document.getElementById('quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

    // NOUVEAU: Récupérer les variantes sélectionnées (taille, couleur, etc.)
    const locationSelect = document.getElementById('delivery-location');
    const methodSelect = document.getElementById('delivery-method');

    let selectedDelivery = {};
    const product = allLoadedProducts.find(p => p.IDProduit === productId);

    if (product && (product.LivraisonGratuite === true || product.LivraisonGratuite === "TRUE" || product.LivraisonGratuite === "Oui")) {
        selectedDelivery = { location: 'Spéciale', method: 'Gratuite', cost: 0 };
    } else {
        if (locationSelect && !locationSelect.value) {
            showToast("Veuillez sélectionner une localité de livraison.", true);
            return;
        }
        selectedDelivery = {
            location: locationSelect ? locationSelect.value : 'Non spécifié',
            method: methodSelect ? methodSelect.value : 'Standard'
        };
    }

    const selectedVariants = {};
    const variantButtons = document.querySelectorAll('.variant-btn.selected');
    variantButtons.forEach(btn => {
        const group = btn.dataset.group;
        const value = btn.textContent;
        selectedVariants[group] = value;
    });

    // CORRECTION: La recherche de produit existant doit aussi prendre en compte les variantes.
    const existingProductIndex = cart.findIndex(item => item.productId === productId && JSON.stringify(item.variants) === JSON.stringify(selectedVariants));
    if (existingProductIndex > -1) {
        // Le produit existe déjà, on augmente la quantité
        cart[existingProductIndex].quantity += quantity;
    } else {
        // Nouveau produit
        cart.push({ productId, name, price, imageUrl, quantity, variants: selectedVariants, delivery: selectedDelivery });
    }
    
    saveCart(cart);
    showToast(`${name} a été ajouté au panier !`);
}

/**
 * NOUVEAU: Affiche une notification "toast" en bas de l'écran.
 * @param {string} message Le message à afficher.
 * @param {boolean} isError Si true, affiche une notification d'erreur.
 */
function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white shadow-lg transition-all duration-300 transform translate-y-10 opacity-0 ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
    
    toastContainer.appendChild(toast);

    // Animer l'apparition
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animer la disparition
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300); // Supprimer l'élément du DOM après l'animation
    }, 3000); // Le toast reste visible 3 secondes
}

/**
 * Met à jour les badges du panier (nombre d'articles).
 */
function updateCartBadges() {
    const cart = getCart() || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    // CORRECTION: Cible tous les badges par leur classe commune pour une mise à jour fiable.
    const badges = document.querySelectorAll('.cart-badge');

    badges.forEach(badge => {
        if (totalItems > 0) {
            badge.textContent = totalItems;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

/**
 * Affiche les articles sur la page du panier.
 */
function renderCartPage() {
    const cart = getCart() || [];
    const cartContainer = document.getElementById('cart-page-items');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="p-6 text-center text-gray-500">Votre panier est vide.</p>';
        const summary = document.getElementById('cart-summary');
        if (summary) summary.style.display = 'none';
        return;
    }

    // NOUVEAU: Affichage des variantes dans le panier
    const variantHTML = (variants) => {
        if (!variants || Object.keys(variants).length === 0) return '';
        return `<p class="text-xs text-gray-500">${Object.entries(variants).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join(', ')}</p>`;
    };
    const cartHTML = cart.map((item, index) => `
        <div class="flex items-center p-4 border-b">
            <div class="w-16 h-16 bg-gray-200 rounded mr-4 overflow-hidden">
                <img src="${item.imageUrl || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">
            </div>
            <div class="flex-grow">
                <a href="produit.html?id=${item.productId}" class="font-semibold hover:underline">${item.name}</a>
                <!-- NOUVEAU: Ajout du nom du formateur si disponible -->
                ${item.instructor ? `<p class="text-xs text-gray-500">Par ${item.instructor}</p>` : ''}
                <p class="text-sm text-gold">${item.price.toLocaleString('fr-FR')} F CFA</p>
                ${variantHTML(item.variants)}
            </div>
            <div class="flex items-center">
                <input type="number" value="${item.quantity}" min="1" onchange="changeQuantity(${index}, this.value)" class="w-16 text-center border rounded p-1 mx-4">
                <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');

    cartContainer.innerHTML = cartHTML;
    updateCartSummary();
}

/**
 * Met à jour le résumé de la commande sur la page panier.
 */
function updateCartSummary() {
    const cart = getCart() || [];
    if (!document.getElementById('summary-subtotal')) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calcul initial des frais de livraison
    let shippingCost = cart.reduce((sum, item) => {
        const location = item.delivery.location;
        // Si la livraison est gratuite pour cet article, on n'ajoute rien au coût.
        if (item.delivery.cost === 0) {
            return sum;
        }
        const method = item.delivery.method;
        const region = Object.keys(DELIVERY_OPTIONS).find(r => DELIVERY_OPTIONS[r][location]);
        const cost = region ? (DELIVERY_OPTIONS[region][location][method] || DELIVERY_OPTIONS[region][location]['Standard'] || 0) : 0;
        return sum + cost;
    }, 0);

    // NOUVEAU: Appliquer la règle de livraison gratuite pour Dakar
    const dakarLocations = Object.keys(DELIVERY_OPTIONS["Dakar"]);
    const isAllDakar = cart.length > 0 && cart.every(item => dakarLocations.includes(item.delivery.location));

    if (isAllDakar && subtotal > 50000) {
        shippingCost = 0;
    }

    const total = subtotal + shippingCost;

    document.getElementById('summary-subtotal').textContent = `${subtotal.toLocaleString('fr-FR')} F CFA`;
    document.getElementById('summary-shipping').textContent = shippingCost > 0 ? `${shippingCost.toLocaleString('fr-FR')} F CFA` : 'Gratuite';
    document.getElementById('summary-total').textContent = `${total.toLocaleString('fr-FR')} F CFA`;
}

/**
 * Modifie la quantité d'un article dans le panier.
 * @param {number} index - L'index de l'article dans le tableau du panier.
 * @param {string} newQuantity - La nouvelle quantité (depuis l'input).
 */
function changeQuantity(index, newQuantity) {
    const cart = getCart() || [];
    const quantity = parseInt(newQuantity);

    if (quantity > 0) {
        cart[index].quantity = quantity;
    } else {
        // Si la quantité est 0 ou moins, on supprime l'article
        cart.splice(index, 1);
    }

    saveCart(cart);
    renderCartPage(); // Ré-affiche la page du panier avec les nouvelles valeurs
}

/**
 * Supprime un article du panier.
 * @param {number} index - L'index de l'article à supprimer.
 */
function removeFromCart(index) {
    const cart = getCart() || [];
    cart.splice(index, 1); // Supprime l'élément à l'index donné

    saveCart(cart);
    renderCartPage(); // Ré-affiche la page du panier
}

/**
 * NOUVEAU: Vérifie si l'utilisateur est connecté avant de passer au checkout.
 */
function proceedToCheckout() {
    const user = JSON.parse(localStorage.getItem('abmcyUser'));
    const cart = getCart();

    if (cart.length === 0) {
        showToast("Votre panier est vide.", true);
        return;
    }

    if (!user) {
        showToast("Veuillez vous connecter pour valider votre panier.", true);
        // Sauvegarder la page actuelle pour y revenir après connexion
        localStorage.setItem('redirectAfterLogin', 'checkout.html');
        setTimeout(() => {
            window.location.href = 'authentification.html';
        }, 1500);
    } else {
        window.location.href = 'checkout.html';
    }
}

/**
 * NOUVEAU: Affiche une sélection de produits en promotion sur la page du panier.
 * @param {object} catalog L'objet catalogue complet.
 */
function renderPromoProductsInCart(catalog) {
    const container = document.getElementById('promo-products-in-cart');
    if (!container) return;

    // Afficher un squelette de chargement
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    container.innerHTML = Array(4).fill(skeletonCard).join('');

    try {
        const allProducts = catalog.data.products || [];
        const discountedProducts = allProducts.filter(p => p['Réduction%'] && parseFloat(p['Réduction%']) > 0);

        if (discountedProducts.length === 0) {
            container.parentElement.classList.add('hidden'); // Cacher toute la section s'il n'y a pas de promos
            return;
        }

        // Mélanger et prendre les 4 premiers pour un affichage varié
        const shuffled = discountedProducts.sort(() => 0.5 - Math.random());
        const selectedProducts = shuffled.slice(0, 4);

        container.innerHTML = selectedProducts.map(product => renderProductCard(product)).join('');

    } catch (error) {
        console.error("Erreur lors de l'affichage des produits en promotion dans le panier:", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Impossible de charger les offres.</p>';
    }
}

// --- LOGIQUE DE RECHERCHE (MODIFIÉE POUR LE BACKEND) ---

/**
 * Charge les produits depuis le backend et initialise la recherche.
 */
function initializeSearch() {
    const searchForms = document.querySelectorAll('form[id^="search-form"]');
    searchForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = form.querySelector('input[type="search"]');
            const query = searchInput.value.trim();
            if (query) {
                // On passe la recherche en paramètre à la page de recherche
                window.location.href = `recherche.html?q=${encodeURIComponent(query)}`;
            }
        });
    });
}

/**
 * Affiche les résultats sur la page de recherche.
 * La recherche se fait maintenant côté client pour plus de rapidité.
 */
async function displaySearchResults(catalog) {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    const queryDisplay = document.getElementById('search-query-display');
    const resultsContainer = document.getElementById('search-results-container');
    const resultsCount = document.getElementById('search-results-count');
    const searchInput = document.getElementById('search-input-page');

    if (!query || !resultsContainer) return;

    queryDisplay.textContent = query;
    searchInput.value = query;

    let filteredProducts = [];
    try {
        const { data } = catalog;
        const allProducts = data.products || [];

        const lowerCaseQuery = query.toLowerCase();
        filteredProducts = allProducts.filter(product => 
            product.Nom.toLowerCase().includes(lowerCaseQuery) ||
            (product.Marque && product.Marque.toLowerCase().includes(lowerCaseQuery)) ||
            product.Catégorie.toLowerCase().includes(lowerCaseQuery) ||
            (product.Tags && product.Tags.toLowerCase().includes(lowerCaseQuery)) ||
            (product.Description && product.Description.toLowerCase().includes(lowerCaseQuery))
        );
        resultsCount.textContent = `${filteredProducts.length} résultat(s) trouvé(s).`;
    } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        resultsCount.textContent = `Erreur lors de la recherche.`;
    }

    if (filteredProducts.length === 0) {
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit ne correspond à votre recherche.</p>`;
        return;
    }

    const resultsHTML = filteredProducts.map(product => renderProductCard(product)).join('');

    resultsContainer.innerHTML = resultsHTML;
}

/**
 * NOUVEAU: Initialise l'affichage de la page catégorie avec des squelettes.
 * Cette fonction est appelée immédiatement au chargement de la page.
 */
function initializeCategoryPage() {
    const params = new URLSearchParams(window.location.search);
    const categoryName = params.get('name');
    const nameDisplay = document.getElementById('category-name-display');
    const resultsContainer = document.getElementById('category-results-container');

    if (!nameDisplay || !resultsContainer) return;

    // Afficher le nom de la catégorie immédiatement
    nameDisplay.textContent = categoryName || "Catégorie";

    // Afficher le squelette de chargement
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    resultsContainer.innerHTML = Array(8).fill(skeletonCard).join('');
}

/**
 * NOUVEAU: Remplit la page catégorie avec les produits réels une fois les données chargées.
 */
function fillCategoryProducts(catalog) {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const resultsContainer = document.getElementById('category-results-container');
    const resultsCount = document.getElementById('category-results-count');

    if (!categoryId || !resultsContainer) return;

    try {
        const { data } = catalog;
        const allProducts = data.products || [];
        const allCategories = data.categories || [];
        
        // CORRECTION: Le produit n'a pas d'IDCategorie, mais un nom de catégorie.
        // On trouve la catégorie correspondante à l'ID de l'URL pour obtenir son nom.
        const targetCategory = allCategories.find(cat => cat.IDCategorie == categoryId);
        if (!targetCategory) throw new Error("Catégorie introuvable.");
        
        const categoryProducts = allProducts.filter(product => {
            return product.Catégorie === targetCategory.NomCategorie;
        });

        resultsCount.textContent = `${categoryProducts.length} produit(s) dans cette catégorie.`;

        if (categoryProducts.length === 0) {
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit dans cette catégorie pour le moment.</p>`;
            return;
        }

        // NOUVEAU: Logique pour insérer des carrousels
        const otherProducts = allProducts.filter(p => p.Catégorie !== targetCategory.NomCategorie);
        let finalHTML = '';
        const productsPerCarousel = 4;
        const productsPerRow = 6;

        for (let i = 0; i < categoryProducts.length; i += productsPerRow) {
            const productChunk = categoryProducts.slice(i, i + productsPerRow);
            
            // Ajouter la grille de produits
            finalHTML += `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">${productChunk.map(p => renderProductCard(p)).join('')}</div>`;

            // Ajouter un carrousel après la ligne, s'il reste des produits à afficher
            if (i + productsPerRow < categoryProducts.length && otherProducts.length > 0) {
                const carouselId = `category-promo-carousel-${i}`;
                // Sélectionner des produits aléatoires parmi les autres catégories
                const shuffledOtherProducts = otherProducts.sort(() => 0.5 - Math.random());
                const carouselProducts = shuffledOtherProducts.slice(0, productsPerCarousel);

                if (carouselProducts.length > 0) {
                    const dotsHTML = `<div class="carousel-dots absolute left-1/2 -translate-x-1/2 flex space-x-2">${carouselProducts.map((_, idx) => `<div class="carousel-dot" data-index="${idx}"></div>`).join('')}</div>`;
                    finalHTML += `
                        <section class="my-12 relative pb-8">
                            <h3 class="text-3xl font-extrabold text-center text-gray-800 mb-2">Ne manquez pas nos autres trésors</h3>
                            <p class="text-center text-gray-500 mb-6">Explorez et laissez-vous surprendre.</p>
                            <div id="${carouselId}" class="promo-carousel flex overflow-x-auto snap-x-mandatory">
                                ${carouselProducts.map(p => `
                                    <div class="promo-carousel-item flex-shrink-0 w-full bg-white rounded-lg overflow-hidden p-4">
                                        <a href="produit.html?id=${p.IDProduit}" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                            <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <img src="${p.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${p.Nom}" class="max-h-full max-w-full object-contain">
                                            </div>
                                            <div class="text-center md:text-left">
                                                <p class="text-sm text-gray-500">${p.Catégorie}</p>
                                                <h4 class="text-2xl font-bold text-gray-800 my-2">${p.Nom}</h4>
                                                <p class="font-bold text-3xl text-gold">${p.PrixActuel.toLocaleString('fr-FR')} F CFA</p>
                                                ${p.PrixAncien > p.PrixActuel ? `<p class="text-lg text-gray-400 line-through">${p.PrixAncien.toLocaleString('fr-FR')} F CFA</p>` : ''}
                                                <button class="mt-4 bg-black text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-800 transition">
                                                    Découvrir
                                                </button>
                                            </div>
                                        </a>
                                    </div>
                                `).join('')}
                            </div>
                            ${dotsHTML}
                        </section>
                    `;
                }
            }
        }

        resultsContainer.innerHTML = finalHTML;

        // Initialiser tous les nouveaux carrousels
        document.querySelectorAll('.promo-carousel').forEach(carousel => initializePromoCarousel(carousel.id));

    } catch (error) {
        console.error("Erreur lors de l'affichage des produits de la catégorie:", error);
        resultsCount.textContent = `Erreur lors du chargement des produits.`;
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>`;
    }
}

/**
 * NOUVEAU: Affiche les produits en promotion.
 */
function displayPromotionProducts(catalog) {
    const resultsContainer = document.getElementById('promotion-results-container');
    const resultsCount = document.getElementById('promotion-results-count');

    if (!resultsContainer) return;

    try {
        const { data } = catalog;
        const allProducts = data.products || [];
        // Filtrer les produits qui ont une réduction
        const discountedProducts = allProducts.filter(product => product['Réduction%'] && parseFloat(product['Réduction%']) > 0);

        resultsCount.textContent = `${discountedProducts.length} produit(s) en promotion.`;

        if (discountedProducts.length === 0) {
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit en promotion pour le moment.</p>`;
            return;
        }

        const resultsHTML = discountedProducts.map(product => renderProductCard(product)).join('');
        resultsContainer.innerHTML = resultsHTML;

    } catch (error) {
        console.error("Erreur lors de l'affichage des promotions:", error);
        resultsCount.textContent = `Erreur lors du chargement des promotions.`;
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Impossible de charger les promotions.</p>`;
    }
}

// --- LOGIQUE DE LA PAGE PRODUIT ---

/**
 * MODIFIÉ: Charge les données d'un cours spécifique sur la page de détail.
 */
function loadCoursePage(catalog) {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');

    if (!courseId) {
        document.querySelector('main').innerHTML = '<p class="text-center text-red-500">Erreur: ID de cours manquant.</p>';
        return;
    }

    try {
        const { data } = catalog;
        // Les données de cours viennent maintenant de `data.products` qui contient les fiches de cours
        const course = data.products.find(c => c.ID_Cours == courseId);

        if (!course) {
            throw new Error("Cours non trouvé.");
        }

        // --- Remplissage des métadonnées de la page ---
        document.title = `${course.Nom_Cours} - Junior Senior Gaps Killer`;
        document.querySelector('meta[property="og:title"]').setAttribute('content', course.Nom_Cours);
        document.querySelector('meta[property="og:description"]').setAttribute('content', course.Résumé);
        document.querySelector('meta[property="og:image"]').setAttribute('content', course.Image_Couverture || CONFIG.DEFAULT_PRODUCT_IMAGE);
        document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);

        // --- Remplissage de la section principale ---
        document.getElementById('course-title').textContent = course.Nom_Cours;
        document.getElementById('course-summary').textContent = course.Résumé;

        // Tags
        const tagsContainer = document.getElementById('course-tags-container');
        tagsContainer.innerHTML = `
            <span class="flex items-center"><svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${course.Durée_Totale}</span>
            <span class="flex items-center"><svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> ${course.Niveau}</span>
            <span class="flex items-center"><svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg> ${course.Catégorie || 'Général'}</span>
            <span class="flex items-center"><svg class="w-4 h-4 mr-1.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg> ${course.Note_Moyenne} (${course.Avis})</span>
        `;

        // Prix et bouton d'achat
        const priceContainer = document.getElementById('course-price-container');
        priceContainer.innerHTML = `<span class="text-3xl font-bold text-gold">${Number(course.Prix).toLocaleString('fr-FR')} F CFA</span>`;
        const buyButton = document.getElementById('buy-course-button');
        buyButton.textContent = `Acheter ce cours – ${Number(course.Prix).toLocaleString('fr-FR')} F CFA`;
        // NOUVEAU: Ajout de l'action d'ajout au panier et de redirection
        buyButton.onclick = (event) => {
            addToCart(event, course.ID_Cours, course.Nom_Cours, course.Prix, course.Image_Couverture);
            // Redirection immédiate vers le panier
            window.location.href = 'panier.html';
        };

        // Vidéo
        const videoPlayer = document.getElementById('course-video-player');
        if (course.URL_Vidéo_Intro) { // Assumons que la vidéo d'intro est celle du freemium
            document.getElementById('video-skeleton').classList.add('hidden');
            videoPlayer.src = course.URL_Vidéo_Intro;
            videoPlayer.classList.remove('hidden');
            // NOUVEAU: Initialiser le lecteur freemium
            setupFreemiumPlayer(videoPlayer, course);
        } else {
            // Afficher l'image de couverture si pas de vidéo
            document.getElementById('video-preview-container').innerHTML = `<img src="${course.Image_Couverture || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${course.Nom_Cours}" class="w-full h-full object-cover">`;
        }

        // --- Remplissage des détails dans la colonne de gauche ---

        // Objectifs
        const objectivesList = document.getElementById('course-objectives-list');
        objectivesList.innerHTML = (course.Objectifs || "").split(';').map(obj => `<li>${obj.trim()}</li>`).join('');

        // Structure du cours (Modules et Chapitres)
        const structureContainer = document.getElementById('course-structure-container');
        if (course.modules && course.modules.length > 0) { // NOUVELLE LOGIQUE D'AFFICHAGE
            structureContainer.innerHTML = course.modules.map((module, moduleIndex) => {
                // NOUVEAU: Chaque chapitre est maintenant un bloc interactif
                const chaptersHTML = (module.chapitres || []).map((chap, chapIndex) => {
                    const chapterId = `m${moduleIndex}-ch${chapIndex}`;
                    const quizHTML = (chap.quiz || []).map((q, quizIndex) => {
                        const questionId = `${chapterId}-q${quizIndex}`;
                        const options = [q.Réponse_1, q.Réponse_2, q.Réponse_3, q.Réponse_4].filter(Boolean);
                        const correctIndex = options.indexOf(q.Bonne_Réponse);
                        const optionsHTML = options.map((opt, optIndex) => `
                            <div>
                                <div class="quiz-option border rounded-lg p-3 cursor-pointer transition" onclick="checkQuizAnswer(this, ${optIndex === correctIndex}, '${questionId}', '${q.Bonne_Réponse}')">
                                    ${opt}
                                </div>
                                <div class="quiz-feedback border-l-4 p-3 mt-2 text-sm">
                                    <!-- Le feedback sera injecté ici par JS -->
                                </div>
                            </div>
                        `).join('');
                        return `<div class="mt-4 p-4 border-t"><p class="font-semibold mb-3">${q.Question}</p><div id="${questionId}" class="space-y-2">${optionsHTML}</div></div>`;
                    }).join('');

                    return `
                        <li class="p-4">
                            <div class="flex justify-between items-center">
                                <span class="flex items-center font-semibold">
                                    <svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    ${chap.Nom_Chapitre}
                                </span>
                                <span class="text-gray-500 text-sm">${chap.Durée}</span>
                            </div>
                            ${chap.URL_Vidéo_Chapitre ? `<button onclick="document.getElementById('course-video-player').src='${chap.URL_Vidéo_Chapitre}'" class="text-sm text-blue-600 font-semibold mt-2">Lancer la vidéo</button>` : ''}
                            ${quizHTML ? `<div class="bg-blue-50/50 mt-2 rounded-md">${quizHTML}</div>` : ''}
                        </li>
                    `;
                }).join('');

                return `<div class="border rounded-lg overflow-hidden">
                    <h3 class="font-bold text-lg p-4 bg-gray-50 border-b">${module.Ordre_Module}. ${module.Nom_Module}</h3>
                    <ul class="divide-y">
                        ${chaptersHTML}
                    </ul>
                </div>`;
            }).join('');
        }

        // --- Remplissage de la colonne latérale (droite) ---

        // Profil du formateur
        const instructorContainer = document.getElementById('instructor-profile-container');
        instructorContainer.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(course.Formateur_Nom)}&background=D4AF37&color=fff" alt="${course.Formateur_Nom}" class="w-12 h-12 rounded-full">
            <div>
                <p class="font-bold">${course.Formateur_Nom}</p>
                <p class="text-sm text-gray-500">${course.Formateur_Titre}</p>
            </div>
        `;
        document.getElementById('instructor-bio').textContent = course.Formateur_Bio;

        // Avantage Senior
        document.getElementById('senior-advantage-text').textContent = course.Avantage_Senior;

        // Prérequis et Public Cible
        document.getElementById('prerequisites-list').innerHTML = (course.Prérequis || "").split(';').map(req => `<li>${req.trim()}</li>`).join('');
        document.getElementById('target-audience-text').textContent = course.Public_Cible;

        // --- Cours similaires ---
        const similarCoursesContainer = document.getElementById('similar-courses-container');
        renderSimilarProducts(course, data.products, similarCoursesContainer);

    } catch (error) {
        console.error("Erreur de chargement du cours:", error);
        const mainContent = document.querySelector('main');
        if(mainContent) mainContent.innerHTML = `<p class="text-center text-red-500">Impossible de charger les informations du cours. Veuillez réessayer.</p>`;
    }
}

/**
 * NOUVEAU: Gère l'interaction avec les quiz.
 * @param {HTMLElement} selectedOptionEl - L'élément de l'option cliquée.
 * @param {boolean} isCorrect - Si la réponse est correcte.
 * @param {string} questionId - L'ID du conteneur de la question.
 * @param {string} correctAnswerText - Le texte de la bonne réponse.
 */
function checkQuizAnswer(selectedOptionEl, isCorrect, questionId, correctAnswerText) {
    const questionContainer = document.getElementById(questionId);
    const allOptions = questionContainer.querySelectorAll('.quiz-option');

    // Désactiver toutes les options pour cette question pour éviter de recliquer
    allOptions.forEach(opt => {
        opt.classList.add('disabled');
    });

    // Afficher le feedback pour l'option cliquée
    const feedbackEl = selectedOptionEl.nextElementSibling;
    feedbackEl.style.display = 'block';

    if (isCorrect) {
        selectedOptionEl.classList.add('selected', 'correct');
        feedbackEl.innerHTML = `<p><strong class="font-bold">Bonne réponse !</strong> Voici pourquoi : [Explication de la bonne réponse ici]</p>`;
        feedbackEl.classList.add('correct');
    } else {
        selectedOptionEl.classList.add('selected', 'incorrect');
        feedbackEl.innerHTML = `<p><strong class="font-bold">Incorrect.</strong> La bonne réponse est "${correctAnswerText}". Voici pourquoi : [Explication de la mauvaise réponse ici]</p>`;
        feedbackEl.classList.add('incorrect');
    }
}

/**
 * NOUVEAU: Gère la logique du lecteur en mode freemium.
 * @param {HTMLIFrameElement} videoPlayer - L'iframe du lecteur vidéo.
 * @param {object} course - L'objet cours contenant les données.
 */
function setupFreemiumPlayer(videoPlayer, course) {
    const freemiumBanner = document.getElementById('freemium-banner');
    const freemiumOverlay = document.getElementById('freemium-overlay');
    const overlayBuyButton = document.getElementById('overlay-buy-button');
    const mainBuyButton = document.getElementById('buy-course-button');

    // Durée de l'aperçu en secondes (20 minutes)
    const freemiumDuration = 20 * 60; 
    let timerInterval;

    // Copier le texte et l'action du bouton principal
    overlayBuyButton.innerHTML = mainBuyButton.innerHTML;
    overlayBuyButton.onclick = () => mainBuyButton.click();

    videoPlayer.onload = () => {
        // Cette partie nécessite une API de lecteur vidéo (Vimeo, YouTube, etc.)
        // pour écouter les événements de lecture.
        // Pour la démo, nous simulons le début de la lecture.
        console.log("Le lecteur vidéo est prêt. La logique de freemium peut commencer.");

        // Simulation: on imagine que l'utilisateur clique sur "play"
        // Dans un cas réel, vous utiliseriez l'API de votre lecteur vidéo ici.
        let timeWatched = 0;
        freemiumBanner.classList.remove('hidden');

        timerInterval = setInterval(() => {
            timeWatched++;
            const timeLeft = freemiumDuration - timeWatched;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            if (timeLeft > 0) {
                freemiumBanner.textContent = `Mode Aperçu : ${minutes}:${String(seconds).padStart(2, '0')} restant`;
            } else {
                clearInterval(timerInterval);
                freemiumBanner.classList.add('hidden');
                freemiumOverlay.classList.remove('hidden');
                freemiumOverlay.classList.add('flex'); // Pour centrer le contenu
                // Ici, vous utiliseriez l'API du lecteur pour mettre la vidéo en pause.
                // videoPlayer.pause(); 
            }
        }, 1000);
    };
}

/**
 * NOUVEAU: Remplit les sélecteurs de livraison sur la page produit.
 */
function populateDeliverySelectors() {
    // NOUVEAU: Récupérer les options de livraison depuis l'API
    fetch(`${CONFIG.DELIVERY_API_URL}?action=getDeliveryOptions`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                DELIVERY_OPTIONS = result.data;
                fillDeliverySelectors();
            }
        });
}

function fillDeliverySelectors() {
    const locationSelect = document.getElementById('delivery-location');
    const methodSelect = document.getElementById('delivery-method');
    if (!locationSelect || !methodSelect) return;
    let locationHTML = '<option value="">-- Choisir une localité --</option>';
    for (const region in DELIVERY_OPTIONS) {
        locationHTML += `<optgroup label="${region}">`;
        for (const city in DELIVERY_OPTIONS[region]) {
            locationHTML += `<option value="${city}">${city}</option>`;
        }
        locationHTML += `</optgroup>`;
    }
    locationSelect.innerHTML = locationHTML;

    // Au début, on ne remplit les méthodes que si une localité est choisie
    methodSelect.innerHTML = '<option value="">-- D\'abord choisir une localité --</option>';
}

/**
 * NOUVEAU: Met à jour les options de méthode de livraison et le coût estimé.
 */
function updateDeliveryCost() {
    const locationSelect = document.getElementById('delivery-location');
    const methodSelect = document.getElementById('delivery-method');
    const costEstimateEl = document.getElementById('delivery-cost-estimate');
    const methodDetailsEl = document.getElementById('delivery-method-details');

    if (!locationSelect || !methodSelect || !costEstimateEl || !methodDetailsEl) return;

    const selectedLocation = locationSelect.value;
    if (!selectedLocation) {
        methodSelect.innerHTML = '<option value="">-- D\'abord choisir une localité --</option>';
        costEstimateEl.textContent = 'Veuillez sélectionner une option';
        methodDetailsEl.innerHTML = ''; // Vider les détails
        return;
    }

    const region = Object.keys(DELIVERY_OPTIONS).find(r => DELIVERY_OPTIONS[r][selectedLocation]);
    const methods = DELIVERY_OPTIONS[region][selectedLocation];

    methodSelect.innerHTML = Object.keys(methods).map(method => `<option value="${method}">${method}</option>`).join('');
    
    const selectedMethod = methodSelect.value;
    const cost = methods[selectedMethod];

    costEstimateEl.textContent = `${cost.toLocaleString('fr-FR')} F CFA`;

    // NOUVEAU: Afficher les détails pour Yango
    if (selectedMethod === "Livraison par Yango") {
        methodDetailsEl.innerHTML = `
            <p class="font-semibold">Info: Les frais Yango sont à votre charge à la réception.</p>
            <p>Le colis sera déposé à notre point relais de Dakar Marché Tilène.</p>
        `;
    } else {
        methodDetailsEl.innerHTML = ''; // Vider les détails pour les autres méthodes
    }
}

/**
 * NOUVEAU: Change l'image principale du produit.
 * @param {string} newImageUrl L'URL de la nouvelle image à afficher.
 */
function changeMainImage(newImageUrl) {
    document.getElementById('main-product-image').src = newImageUrl;
    // Le zoom est attaché au conteneur, il fonctionnera automatiquement avec la nouvelle image.
}

/**
 * NOUVEAU: Active l'effet de zoom interne sur une image.
 * @param {string} wrapperId L'ID du conteneur qui englobe l'image.
 */
function activateInternalZoom(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const img = wrapper.querySelector('img');
    if (!img) return;

    function handleMouseMove(e) {
        const { left, top, width, height } = wrapper.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    }

    function handleMouseEnter() {
        img.style.transform = 'scale(2)'; // Ou 1.5, 2.5, etc. selon l'intensité de zoom souhaitée
    }

    function handleMouseLeave() {
        img.style.transform = 'scale(1)';
        img.style.transformOrigin = 'center center';
    }

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseenter', handleMouseEnter);
    wrapper.addEventListener('mouseleave', handleMouseLeave);
}

/**
 * NOUVEAU: Aiguille vers la bonne fonction de rendu en fonction de la catégorie.
 * @param {object} product L'objet produit.
 * @param {HTMLElement} variantsContainer Le conteneur pour les options (taille, couleur...).
 * @param {HTMLElement} specsContainer Le conteneur pour les spécifications techniques.
 */
function renderCategorySpecificDetails(product, variantsContainer, specsContainer, catalog) {
    variantsContainer.innerHTML = '';
    specsContainer.innerHTML = '';

    // Récupérer la configuration des attributs depuis le catalogue
    const categoryConfig = catalog.data.categoryConfig || {};
    const categoryAttributes = categoryConfig[product.Catégorie] || [];

    let variantsHTML = '';
    let specsHTML = '<ul>';
    let hasSpecs = false;

    // Parcourir tous les attributs définis pour cette catégorie
    categoryAttributes.forEach(attr => {
        const value = product[attr];
        if (value) {
            // Si la valeur contient une virgule, on la traite comme une variante sélectionnable
            if (String(value).includes(',')) {
                variantsHTML += createVariantSelector(attr, String(value).split(','));
            } else {
                // Sinon, on l'affiche comme une spécification
                specsHTML += `<li class="flex justify-between py-2 border-b"><span>${attr}</span> <span class="font-semibold text-gray-800">${value}</span></li>`;
                hasSpecs = true;
            }
        }
    });

    specsHTML += '</ul>';

    variantsContainer.innerHTML = variantsHTML;
    if (hasSpecs) {
        specsContainer.innerHTML = specsHTML;
    } else {
        specsContainer.innerHTML = '<p class="text-gray-600">Aucune spécification supplémentaire pour ce produit.</p>';
    }
}
/**
 * NOUVEAU: Crée un sélecteur de variante (boutons).
 * @param {string} label Le nom de la variante (ex: "Taille").
 * @param {string[]} options Un tableau d'options (ex: ["S", "M", "L"]).
 * @returns {string} Le code HTML du sélecteur.
 */
function createVariantSelector(label, options) {
    const validOptions = options.filter(opt => opt && opt.trim() !== '');
    if (validOptions.length === 0) return '';

    let buttonsHTML = validOptions.map(option => `<button class="variant-btn border-2 rounded-md px-4 py-1 text-sm font-semibold" data-group="${label}" onclick="selectVariant(this, '${label}')">${option.trim()}</button>`).join('');
    return `
        <div>
            <h3 class="text-sm font-semibold mb-2">${label} :</h3>
            <div class="flex flex-wrap gap-2">
                ${buttonsHTML}
            </div>
        </div>
    `;
}

/**
 * NOUVEAU: Gère la sélection visuelle d'un bouton de variante.
 * @param {HTMLElement} selectedButton Le bouton qui a été cliqué.
 * @param {string} groupName Le nom du groupe de variantes.
 */
function selectVariant(selectedButton, groupName) {
    // Désélectionne tous les autres boutons du même groupe
    document.querySelectorAll(`.variant-btn[data-group="${groupName}"]`).forEach(btn => {
        btn.classList.remove('selected');
    });
    // Sélectionne le bouton cliqué
    selectedButton.classList.add('selected');

}

/**
 * NOUVEAU: Affiche des produits similaires basés sur la même catégorie.
 * @param {object} currentProduct Le produit actuellement affiché.
 * @param {Array} allProducts La liste de tous les produits.
 * @param {HTMLElement} container Le conteneur où afficher les produits similaires.
 */
function renderSimilarProducts(currentProduct, allProducts, container) {
    if (!container) return;

    // Afficher le squelette de chargement
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    container.innerHTML = Array(4).fill(skeletonCard).join('');

    // Filtrer pour trouver des produits de la même catégorie, en excluant le produit actuel
    const similar = allProducts.filter(p => 
        p.Catégorie === currentProduct.Catégorie && 
        p.IDProduit !== currentProduct.IDProduit
    ).slice(0, 4); // Limiter à 4 produits similaires

    if (similar.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucun produit similaire trouvé.</p>';
        return;
    }

    const similarProductsHTML = similar.map(product => renderProductCard(product)).join('');
    container.innerHTML = similarProductsHTML;
}

// --- LOGIQUE DE PAIEMENT (CHECKOUT) ---

/**
 * Traite la commande et l'envoie au backend.
 * @param {Event} event - L'événement du formulaire.
 */
async function processCheckout(event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Traitement en cours...';

    // 1. Récupérer les données du formulaire
    const deliveryData = {
        firstname: form.querySelector('#firstname').value,
        lastname: form.querySelector('#lastname').value,
        address: form.querySelector('#address').value,
        city: form.querySelector('#city').value,
        zip: form.querySelector('#zip').value,
    };

    // 2. Récupérer les données du panier depuis le localStorage
    const cart = getCart();
    if (cart.length === 0) {
        alert("Votre panier est vide.");
        return;
    }

    // 3. Vérifier si l'utilisateur est connecté
    const user = JSON.parse(localStorage.getItem('abmcyUser'));
    let clientId = "INVITÉ-" + new Date().getTime(); // ID unique pour l'invité
    let clientName = deliveryData.firstname + " " + deliveryData.lastname;

    if (user && user.IDClient) {
        clientId = user.IDClient;
        clientName = user.Nom;
    }

    // 3. Préparer l'objet de la commande pour le backend
    const orderPayload = {
        action: 'enregistrerCommande', // Correspond à la fonction du Script 2
        data: {
            idClient: clientId,
            produits: cart.map(item => item.id), // On utilise l'ID du produit
            quantites: cart.map(item => item.quantity),
            adresseLivraison: `${deliveryData.address}, ${deliveryData.zip} ${deliveryData.city}`,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) > 30000 ? 0 : 5000),
            moyenPaiement: "Carte de crédit", // Exemple
            notes: "Client: " + clientName
        }
    };

    // 4. Envoyer la commande à l'API Client (Script 2)
    try {
        const response = await fetch(CONFIG.ORDER_API_URL, { // NOUVEAU: Utilise l'API des commandes
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        const result = await response.json();

        if (result.success) {
            alert(`Commande ${result.id} enregistrée avec succès !`);
            saveCart([]); // Vider le panier après la commande
            window.location.href = 'index.html'; // Rediriger vers la page d'accueil
        } else {
            // NOUVEAU: Envoyer une notification même si la commande réussit
            fetch(CONFIG.NOTIFICATION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sendOrderConfirmation',
                    data: { orderId: result.id, ...orderPayload.data }
                }),
                keepalive: true
            });
            throw new Error(result.error || "Une erreur inconnue est survenue.");
        }
    } catch (error) {
        alert(`Erreur lors de la commande: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = 'Payer';
    }
}

/**
 * NOUVEAU: Affiche les produits dans les sections "SuperDeals" et "Big Save" de la page d'accueil.
 */
function renderDailyDealsHomepage(catalog) {
    const superdealsContainer = document.getElementById('superdeals-products');
    const boutiquesContainer = document.getElementById('boutiques-container');

    if (!superdealsContainer || !boutiquesContainer) return;

    // --- Étape 2: Donner au navigateur le temps de dessiner les squelettes ---
    // On lance le chargement des données. getFullCatalog est déjà optimisé avec un cache.
    try {
        // --- Étape 3: Charger le catalogue complet ---
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const products = data.products || [];

        // --- Étape 4: Remplir la section "Nos Boutiques" dès que les catégories sont prêtes ---
        if (categories.length > 0) {
            boutiquesContainer.innerHTML = categories.slice(0, 6).map(cat => `
            <a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="product-card bg-white rounded-lg shadow-md overflow-hidden block text-center">
                <div class="h-32 bg-gray-100 flex items-center justify-center p-2 group-hover:bg-gold/10">
                    <img src="${cat.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${cat.NomCategorie}" class="max-h-full max-w-full object-contain">
                </div>
                <div class="p-2">
                    <p class="font-semibold text-sm text-gray-800 truncate">${cat.NomCategorie}</p>
                </div>
            </a>
        `).join('');
        } else {
            boutiquesContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucun cours à afficher.</p>';
        }

        // --- Étape 5: Remplir la section "SuperDeals" avec les produits ---
        const superDealsProducts = products
            .filter(p => p['Réduction%'] && parseFloat(p['Réduction%']) > 0)
            .slice(0, 6);

        if (superDealsProducts.length > 0) {
            superdealsContainer.innerHTML = superDealsProducts.map(product => renderProductCard(product)).join('');
        } else {
            superdealsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucune offre spéciale pour le moment.</p>';
        }

    } catch (error) {
        console.error("Erreur lors du chargement des données de la page d'accueil:", error);
        const errorMsg = '<p class="col-span-full text-center text-red-500">Impossible de charger le contenu.</p>';
        superdealsContainer.innerHTML = errorMsg;
        boutiquesContainer.innerHTML = errorMsg;
    }
}

/**
 * NOUVEAU: Gère le compte à rebours pour la section "SuperDeals".
 */
function startCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;

    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    // Définir la date de fin de la promotion. 
    // Pour cet exemple, nous la fixons à 8 heures à partir du moment où la page est chargée.
    // Dans une vraie application, cette date viendrait de votre backend.
    const promotionEndDate = new Date();
    promotionEndDate.setHours(promotionEndDate.getHours() + 8);

    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = promotionEndDate - now;

        // Calculs pour les jours, heures, minutes et secondes
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Afficher le résultat dans les éléments
        // `padStart(2, '0')` assure qu'il y a toujours deux chiffres (ex: 09 au lieu de 9)
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');

        // Si le compte à rebours est terminé, afficher un message
        if (distance < 0) {
            clearInterval(timer);
            countdownElement.innerHTML = '<span class="text-red-500 font-semibold">Offres terminées !</span>';
        }
    }, 1000); // Mettre à jour toutes les secondes
}

/**
 * NOUVEAU: Fonction centrale pour récupérer toutes les données publiques.
 * Met en cache les résultats pour améliorer les performances de navigation.
 */
async function getFullCatalog() {
  // CORRECTION: Cette fonction est maintenant uniquement responsable du chargement depuis le réseau.
  console.log("Cache vide. Chargement initial du catalogue complet depuis le réseau...");
  try {
    const response = await fetch(`${CONFIG.CENTRAL_API_URL}?action=getPublicCatalog`);
    if (!response.ok) {
      throw new Error(`Erreur réseau: ${response.statusText}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "L'API a retourné une erreur.");
    }

    // Stocker le résultat dans le cache de session pour les navigations futures.
    console.log(`Catalogue complet assemblé (${result.data.products.length} produits). Mise en cache pour la session.`);
    sessionStorage.setItem('abmcyFullCatalog', JSON.stringify(result));
    sessionStorage.setItem('abmcyCacheVersion', result.cacheVersion); // Stocker la version du cache
    return result;

  } catch (error) {
    console.error("Échec du chargement du catalogue complet:", error);
    // En cas d'erreur, retourner une structure vide pour ne pas planter le site.
    return { success: false, data: { categories: [], products: [] }, error: error.message };
  }
}

/**
 * NOUVEAU: Met à jour le lien du bouton WhatsApp flottant.
 * @param {string|null} number Le numéro de téléphone à utiliser. Si null, utilise le numéro par défaut.
 */
function updateWhatsAppLink(number) {
    const whatsappButton = document.getElementById('whatsapp-float-btn');
    if (!whatsappButton) return;

    const defaultNumber = "221769047999";
    const targetNumber = number && String(number).trim() ? String(number).trim() : defaultNumber;
    
    // Nettoyer le numéro pour l'URL (supprimer espaces, +, etc.)
    const cleanedNumber = targetNumber.replace(/[\s+()-]/g, '');

    whatsappButton.href = `https://wa.me/${cleanedNumber}`;
}

/**
 * NOUVEAU: Met à jour le lien WhatsApp spécifiquement pour la page catégorie.
 */
function updateWhatsAppLinkForCategory(catalog) {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const category = catalog.data.categories.find(cat => cat.IDCategorie === categoryId);
    updateWhatsAppLink(category ? category.Numero : null);
}

/**
 * NOUVEAU: Stratégie "Stale-While-Revalidate".
 * 1. Retourne immédiatement les données du cache si elles existent.
 * 2. En arrière-plan, vérifie si une mise à jour est nécessaire et la télécharge.
 */
async function getCatalogAndRefreshInBackground() {
    const CACHE_KEY = 'abmcyFullCatalog';
    const VERSION_KEY = 'abmcyCacheVersion';
    const TIMESTAMP_KEY = 'abmcyCacheTimestamp';
    const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes en millisecondes

    const cachedData = sessionStorage.getItem(CACHE_KEY);
    const cacheTimestamp = sessionStorage.getItem(TIMESTAMP_KEY);

    // Fonction pour récupérer les nouvelles données du réseau
    const fetchAndUpdateCache = async () => {
        console.log("Mise à jour du cache en arrière-plan...");
        try {
            const response = await fetch(`${CONFIG.CENTRAL_API_URL}?action=getPublicCatalog`);
            if (!response.ok) return; // Échoue silencieusement
            const result = await response.json();
            if (result.success) {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
                sessionStorage.setItem(VERSION_KEY, result.cacheVersion);
                sessionStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
                console.log("Cache mis à jour avec succès en arrière-plan.");
            }
        } catch (error) {
            console.error("Échec de la mise à jour du cache en arrière-plan:", error);
        }
    };

    if (cachedData) {
        console.log("Utilisation des données du cache pour un affichage instantané.");
        const isCacheStale = !cacheTimestamp || (Date.now() - parseInt(cacheTimestamp) > CACHE_LIFETIME);
        
        if (isCacheStale) {
            // Le cache est "périmé", on lance une mise à jour en arrière-plan sans attendre la réponse.
            fetchAndUpdateCache();
        }
        // On retourne immédiatement les données du cache, qu'elles soient périmées ou non.
        return JSON.parse(cachedData);
    } else {
        // Si pas de cache, on fait un premier chargement bloquant.
        return await getFullCatalog();
    }
}

/**
 * Génère le HTML pour une carte de produit.
 * @param {object} product - L'objet produit.
 * @returns {string} Le HTML de la carte.
 */
function renderProductCard(course) {
    const price = course.Prix || 0;
    const courseId = course.ID_Cours || course.IDProduit; // Compatibilité
    const courseName = course.Nom_Cours || course.Nom; // Compatibilité
    const instructorName = course.Formateur_Nom || '';
    const coverImage = course.Image_Couverture || course.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE;

    return `
    <div class="product-card bg-white rounded-lg shadow overflow-hidden flex flex-col justify-between group">
        <div>
            <a href="produit.html?id=${courseId}" class="block">
                <div class="relative">
                    <div class="h-40 bg-gray-200 flex items-center justify-center">
                        <img src="${coverImage}" alt="${courseName}" class="h-full w-full object-cover" loading="lazy" width="160" height="160" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_PRODUCT_IMAGE}';">
                    </div>
                    
                    <!-- NOUVEAU: Conteneur pour les icônes d'action qui apparaissent au survol -->
                    <div class="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button onclick="addToCart(event, '${courseId}', '${courseName}', ${price}, '${coverImage}')" title="Ajouter au panier" class="bg-white p-2 rounded-full shadow-lg hover:bg-gold hover:text-white">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </button>
                        <button onclick="shareProduct(event, '${courseId}')" title="Partager" class="bg-white p-2 rounded-full shadow-lg hover:bg-gold hover:text-white">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="p-3">
                    <p class="text-sm font-semibold text-gray-800 truncate" title="${courseName}">${courseName}</p>
                    <p class="text-xs text-gray-500 mt-1">Par ${instructorName}</p>
                    <p class="font-bold text-lg mt-1">${price.toLocaleString('fr-FR')} F CFA</p>
                </div>
            </a>
        </div>
        <div class="p-3 pt-0">
            <a href="produit.html?id=${courseId}" class="w-full block text-center bg-gray-100 text-gray-800 py-1.5 rounded-lg font-semibold text-xs hover:bg-gray-200 transition">
                Voir le cours
            </a>
        </div>
    </div>
    `;
}

/**
 * NOUVEAU: Copie le lien du produit dans le presse-papiers et affiche une notification.
 * @param {Event} event 
 * @param {string} productId 
 */
async function shareProduct(event, productId) {
    event.preventDefault();
    event.stopPropagation();
    const productUrl = `${window.location.origin}/produit.html?id=${productId}`;
    const course = (await getCatalogAndRefreshInBackground()).data.products.find(p => (p.ID_Cours || p.IDProduit) === productId);
    const shareData = {
        title: course ? `Découvrez le cours "${course.Nom_Cours || course.Nom}"` : "Un cours à ne pas manquer sur Junior Senior Gaps Killer",
        text: course ? `Wow, regarde ce cours sur "${course.Nom_Cours || course.Nom}" ! Je pense que ça va t'intéresser.` : "J'ai trouvé une super plateforme de cours, jette un oeil !",
        url: productUrl,
    };

    // Utiliser l'API de partage native si elle est disponible
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            console.log('Produit partagé avec succès');
        } catch (err) {
            console.error('Erreur de partage: ', err);
        }
    } else {
        // Sinon, revenir à la copie dans le presse-papiers
        navigator.clipboard.writeText(productUrl);
        showToast('Lien du produit copié !');
    }
}

/**
 * NOUVEAU: Partage le lien du site via l'API native.
 */
async function shareSite() {
    const shareData = {
        title: "Junior Senior Gaps Killer",
        text: "J'ai trouvé une super plateforme pour monter en compétence, jette un oeil !",
        url: window.location.origin,
    };
    try {
        await navigator.share(shareData);
    } catch (err) {
        console.error('Erreur de partage: ', err);
        // Si le partage échoue, on copie le lien
        copySiteLink();
    }
}

/**
 * NOUVEAU: Copie le lien du site dans le presse-papiers.
 */
function copySiteLink() {
    navigator.clipboard.writeText(window.location.origin).then(() => {
        showToast('Lien du site copié !');
    }).catch(err => {
        showToast('Impossible de copier le lien.', true);
    });
}

/**
 * NOUVEAU: Affiche des sections de produits pour chaque catégorie sur la page d'accueil.
 */
function renderHomepageCategorySections(catalog) {
    const mainContainer = document.getElementById('category-products-sections-container');
    if (!mainContainer) return;
    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const products = data.products || [];

        const productsByCategory = products.reduce((acc, product) => {
            const categoryName = product.Catégorie;
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push(product);
            return acc;
        }, {});

        let allSectionsHTML = '';
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const categoryProducts = (productsByCategory[category.NomCategorie] || []).slice(0, 12); // Limite à 12 produits
            if (categoryProducts.length === 0) continue;

            allSectionsHTML += `
                <section data-category-id="${category.IDCategorie}">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-bold text-gray-800">${category.NomCategorie}</h3>
                        <a href="categorie.html?id=${category.IDCategorie}&name=${encodeURIComponent(category.NomCategorie)}" class="text-sm font-semibold text-blue-600 hover:underline">Voir plus</a>
                    </div>
                    <div class="horizontal-scroll-container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        ${categoryProducts.map(p => renderProductCard(p)).join('')}
                    </div>
                </section>
            `;

            // NOUVEAU: Insérer un carrousel après chaque deux catégories
            if ((i + 1) % 2 === 0 && i < categories.length - 1) {
                const nextCategory1 = categories[i + 1];
                const nextCategory2 = categories[i + 2];
                const carouselId = `promo-carousel-${i}`;
                let carouselItems = [];

                // Ajouter les images de pub
                if (nextCategory1 && nextCategory1.AdImageURLs) {
                    nextCategory1.AdImageURLs.split(',').forEach(url => {
                        if(url.trim()) carouselItems.push({ type: 'ad', imageUrl: url.trim(), link: `categorie.html?id=${nextCategory1.IDCategorie}` });
                    });
                }
                if (nextCategory2 && nextCategory2.AdImageURLs) {
                    nextCategory2.AdImageURLs.split(',').forEach(url => {
                        if(url.trim()) carouselItems.push({ type: 'ad', imageUrl: url.trim(), link: `categorie.html?id=${nextCategory2.IDCategorie}` });
                    });
                }

                // Trouver les produits les moins chers
                let cheapestProducts = [];
                if (nextCategory1) cheapestProducts.push(...(productsByCategory[nextCategory1.NomCategorie] || []));
                if (nextCategory2) cheapestProducts.push(...(productsByCategory[nextCategory2.NomCategorie] || []));

                cheapestProducts.sort((a, b) => a.PrixActuel - b.PrixActuel);
                
                cheapestProducts.slice(0, 4).forEach(p => carouselItems.push({ type: 'product', product: p }));

                if (carouselItems.length > 0) {
                    const dotsHTML = `<div class="carousel-dots absolute left-1/2 -translate-x-1/2 flex space-x-2">${carouselItems.map((_, idx) => `<div class="carousel-dot" data-index="${idx}"></div>`).join('')}</div>`;

                    allSectionsHTML += `
                        <section class="my-12 relative pb-8">
                            <h3 class="text-3xl font-extrabold text-center text-gray-800 mb-2">Nos Offres Immanquables</h3>
                            <p class="text-center text-gray-500 mb-6">Saisissez votre chance, les stocks sont limités !</p>
                            <div id="${carouselId}" class="promo-carousel flex overflow-x-auto snap-x-mandatory">
                                ${carouselItems.map(item => {
                                    if (item.type === 'ad') {
                                        return `
                                            <a href="${item.link}" class="promo-carousel-item flex-shrink-0 w-full rounded-lg overflow-hidden relative h-64">
                                                <img src="${item.imageUrl}" class="w-full h-full object-cover" alt="Publicité">
                                                <div class="absolute inset-0 bg-black bg-opacity-30 flex items-end p-6">
                                                    <h4 class="text-white text-2xl font-bold">Découvrez nos Nouveautés</h4>
                                                </div>
                                            </a>
                                        `;
                                    } else { // type 'product'
                                        const p = item.product;
                                        return `
                                            <div class="promo-carousel-item flex-shrink-0 w-full bg-white rounded-lg overflow-hidden p-4">
                                                <a href="produit.html?id=${p.IDProduit}" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                                    <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <img src="${p.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${p.Nom}" class="max-h-full max-w-full object-contain">
                                                    </div>
                                                    <div class="text-center md:text-left">
                                                        <p class="text-sm text-gray-500">${p.Catégorie}</p>
                                                        <h4 class="text-2xl font-bold text-gray-800 my-2">${p.Nom}</h4>
                                                        <p class="font-bold text-3xl text-gold">${p.PrixActuel.toLocaleString('fr-FR')} F CFA</p>
                                                        ${p.PrixAncien > p.PrixActuel ? `<p class="text-lg text-gray-400 line-through">${p.PrixAncien.toLocaleString('fr-FR')} F CFA</p>` : ''}
                                                        <button class="mt-4 bg-black text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-800 transition">
                                                            J'en Profite
                                                        </button>
                                                    </div>
                                                </a>
                                            </div>
                                        `;
                                    }
                                }).join('')}
                            </div>
                            ${dotsHTML}
                        </section>
                    `;
                }
            }
        }

        mainContainer.innerHTML = allSectionsHTML;
        // NOUVEAU: Initialiser tous les carrousels créés
        document.querySelectorAll('.promo-carousel').forEach(carousel => initializePromoCarousel(carousel.id));

    } catch (error) {
        console.error("Erreur lors de l'affichage des sections par catégorie:", error);
        container.innerHTML = '<p class="text-center text-red-500">Impossible de charger les sections de produits.</p>';
    }
}

/**
 * NOUVEAU: Initialise un carrousel promotionnel (auto-scroll et points de navigation).
 * @param {string} carouselId L'ID de l'élément carrousel.
 */
function initializePromoCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const dotsContainer = carousel.nextElementSibling;
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    const items = carousel.querySelectorAll('.promo-carousel-item');
    let currentIndex = 0;
    let intervalId;

    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function scrollToItem(index) {
        carousel.scrollTo({
            left: items[index].offsetLeft,
            behavior: 'smooth'
        });
        currentIndex = index;
        updateDots();
    }

    function startAutoScroll() {
        intervalId = setInterval(() => {
            let nextIndex = (currentIndex + 1) % items.length;
            scrollToItem(nextIndex);
        }, 5000); // Change toutes les 5 secondes
    }

    function resetAutoScroll() {
        clearInterval(intervalId);
        startAutoScroll();
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            scrollToItem(parseInt(dot.dataset.index));
            resetAutoScroll(); // Redémarre le minuteur après une interaction manuelle
        });
    });

    carousel.addEventListener('mouseenter', () => clearInterval(intervalId));
    carousel.addEventListener('mouseleave', resetAutoScroll);

    updateDots();
    startAutoScroll();
}

/**
 * NOUVEAU: Affiche la liste complète de toutes les catégories sur la page d'accueil.
 */
function renderAllCategoriesSection(catalog) {
    const container = document.getElementById('all-categories-container');
    if (!container) return;

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));

        if (categories.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Aucune catégorie à afficher pour le moment.</p>';
            return;
        }

        // Organiser les catégories en colonnes pour une meilleure lisibilité
        const categoriesHTML = categories.map(cat => `
            <a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="block text-gray-700 hover:text-gold hover:underline text-sm py-1">
                ${cat.NomCategorie}
            </a>
        `).join('');

        container.innerHTML = `<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-2">${categoriesHTML}</div>`;

    } catch (error) {
        console.error("Erreur lors de l'affichage de la liste complète des catégories:", error);
        container.innerHTML = '<p class="text-center text-red-500">Impossible de charger la liste des catégories.</p>';
    }
}

// --- NOUVEAU: LOGIQUE DU TABLEAU DE BORD SENIOR ---

/**
 * Remplit le sélecteur de catégories dans la modale de création de cours.
 */
async function populateCourseCategorySelect() {
    const selectEl = document.getElementById('course-category-select');
    if (!selectEl) return;

    try {
        const catalog = await getCatalogAndRefreshInBackground();
        const categories = (catalog.data.categories || []).filter(cat => cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));

        if (categories.length > 0) {
            selectEl.innerHTML = '<option value="">-- Choisissez une catégorie --</option>' + categories.map(cat => 
                `<option value="${cat.IDCategorie}">${cat.NomCategorie}</option>`
            ).join('');
        } else {
            selectEl.innerHTML = '<option value="">Aucune catégorie disponible</option>';
        }
    } catch (error) {
        console.error("Erreur de chargement des catégories:", error);
        selectEl.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

/**
 * Gère la soumission du formulaire de création de cours.
 * @param {Event} event 
 */
async function handleAddCourseSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Création...';

    const categoryId = document.getElementById('course-category-select').value;
    const user = JSON.parse(localStorage.getItem('abmcyUser'));

    if (!categoryId) {
        alert("Veuillez sélectionner une catégorie.");
        submitButton.disabled = false;
        submitButton.textContent = 'Créer le cours';
        return;
    }

    // Trouver l'URL du script de la catégorie sélectionnée
    const catalog = await getCatalogAndRefreshInBackground();
    const targetCategory = catalog.data.categories.find(cat => cat.IDCategorie === categoryId);

    if (!targetCategory || !targetCategory.ScriptURL) {
        alert("Erreur: Impossible de trouver l'URL pour cette catégorie.");
        return;
    }

    const payload = {
        action: 'addCourseFromDashboard',
        data: {
            nom: document.getElementById('course-name-input').value,
            resume: document.getElementById('course-summary-input').value,
            prix: parseFloat(document.getElementById('course-price-input').value),
            formateurNom: user.Nom,
            formateurTitre: user.Titre || 'Formateur Expert' // À compléter depuis le profil
        }
    };

    try {
        const response = await fetch(targetCategory.ScriptURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            alert('Cours créé avec succès !');
            document.getElementById('add-course-modal').classList.add('hidden');
            form.reset();
            // Ici, on pourrait rafraîchir la liste des cours du dashboard
        } else {
            throw new Error(result.error || "Une erreur est survenue.");
        }
    } catch (error) {
        alert(`Erreur lors de la création du cours : ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Créer le cours';
    }
}
// --- LOGIQUE D'AUTHENTIFICATION ---

/**
 * NOUVEAU: Enregistre un événement dans le localStorage pour le débogage sur la page log.html.
 * @param {string} type Le type d'événement (ex: 'FETCH_SUCCESS', 'FETCH_ERROR').
 * @param {object} data Les données associées à l'événement.
 */
function logAppEvent(type, data) {
    const LOG_KEY = 'abmcyAppLogs';
    const MAX_LOGS = 50;
    try {
        let logs = JSON.parse(localStorage.getItem(LOG_KEY)) || [];
        
        const logEntry = {
            type: type,
            timestamp: new Date().toISOString(),
            ...data
        };

        // NOUVEAU: Envoyer le log au serveur de manière asynchrone ("fire and forget")
        // On n'attend pas la réponse pour ne pas ralentir l'interface utilisateur.
        const logPayload = {
            action: 'logClientEvent', // Cette action est dans l'API des comptes
            data: logEntry
        };
        try {
            fetch(CONFIG.ACCOUNT_API_URL, { // CORRECTION: Utiliser l'API des comptes pour la journalisation
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logPayload),
                keepalive: true
            });
        } catch (e) { console.error("Échec de l'envoi du log au serveur:", e); }

        logs.push(logEntry);
        if (logs.length > MAX_LOGS) {
            logs = logs.slice(logs.length - MAX_LOGS);
        }
        localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) { console.error("Impossible d'écrire dans le journal :", e); }
}

/**
 * Gère la soumission des formulaires de connexion et d'inscription.
 * @param {Event} event L'événement de soumission du formulaire.
 * @param {string} type 'login' ou 'register'.
 * @param {string} role 'Client' ou 'Senior'.
 */
async function handleAuthForm(event, type, role = 'Client') {
    event.preventDefault();
    const form = event.target;
    const statusDiv = document.getElementById('auth-status');
    if (statusDiv) statusDiv.className = 'mt-4 text-center font-semibold'; // Reset classes
    statusDiv.textContent = 'Veuillez patienter...';

    let payload;

    if (type === 'register') {
        const password = form.querySelector('#register-password').value;
        const passwordConfirm = form.querySelector('#register-password-confirm').value;
        
        if (passwordConfirm && password !== passwordConfirm) {
            statusDiv.textContent = 'Les mots de passe ne correspondent pas.';
            statusDiv.classList.add('text-red-600');
            return;
        }

        payload = {
            action: 'creerCompteClient',
            data: {
                nom: form.querySelector('#register-nom').value,
                email: form.querySelector('#register-email').value,
                motDePasse: password,
                adresse: '',
                telephone: '',
                role: role // NOUVEAU: Envoyer le rôle
            }
        };
    } else { // type === 'login'
        payload = {
            action: 'connecterClient', // Assurez-vous que cette action existe dans votre API Client
            data: {
                email: form.querySelector('#login-email').value,
                motDePasse: form.querySelector('#login-password').value
            }
        };
    }

    logAppEvent('FETCH_START', {
        message: `Tentative de ${type === 'login' ? 'connexion' : 'création de compte'}`,
        url: CONFIG.ACCOUNT_API_URL,
        payload: payload
    });

    try {
        form.querySelector('button[type="submit"]').disabled = true;
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST', // Le mode 'no-cors' n'est pas nécessaire et cause des problèmes.
            headers: { 'Content-Type': 'application/json' }, // Ajout de cet en-tête essentiel
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            logAppEvent('FETCH_SUCCESS', {
                message: `Action '${payload.action}' réussie.`,
                url: CONFIG.ACCOUNT_API_URL,
                response: result
            });

            if (type === 'register') {
                statusDiv.textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
                statusDiv.classList.add('text-green-600');
                setTimeout(() => switchTab('login'), 1500); // Basculer vers l'onglet de connexion
            } else { // type === 'login'
                statusDiv.textContent = 'Connexion réussie ! Redirection...';
                statusDiv.classList.add('text-green-600');
                localStorage.setItem('abmcyUser', JSON.stringify(result.user));
                // NOUVEAU: Rediriger en fonction du rôle
                if (result.user.Role === 'Senior') {
                    window.location.href = 'senior-dashboard.html';
                } else {
                    window.location.href = 'compte.html';
                }
            }
        } else {
            logAppEvent('API_ERROR', {
                message: `L'API a retourné une erreur pour l'action '${payload.action}'.`,
                url: CONFIG.ACCOUNT_API_URL,
                error: result.error,
                payload: payload
            });
            throw new Error(result.error || 'Une erreur est survenue.');
        }
    } catch (error) {
        logAppEvent('FETCH_ERROR', {
            message: `Échec de la requête pour l'action '${payload.action}'.`,
            url: CONFIG.ACCOUNT_API_URL,
            error: error.message,
            payload: payload
        });
        let errorMessage = `Erreur: ${error.message}`;
        // NOUVEAU: Si l'erreur vient de la connexion, on suggère de s'inscrire.
        if (type === 'login') {
            errorMessage += ` <br><a href="#" onclick="switchTab('register'); return false;" class="text-blue-600 hover:underline">Pas de compte ? Créez-en un.</a>`;
        }
        statusDiv.innerHTML = errorMessage; // Utiliser innerHTML pour que le lien soit cliquable
        statusDiv.classList.add('text-red-600');
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
}

/**
 * Gère le changement d'onglet entre Connexion et Inscription.
 * @param {string} tabName 'login' ou 'register'.
 */
function switchTab(tabName) {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginTab.classList.toggle('border-gold', tabName === 'login');
    loginTab.classList.toggle('text-gray-500', tabName !== 'login');
    registerTab.classList.toggle('border-gold', tabName === 'register');
    registerTab.classList.toggle('text-gray-500', tabName !== 'register');

    loginForm.classList.toggle('hidden', tabName !== 'login');
    registerForm.classList.toggle('hidden', tabName !== 'register');

    document.getElementById('auth-status').textContent = ''; // Clear status messages
}

// --- LOGIQUE DE LA PAGE COMPTE ---

/**
 * Initialise la page "Mon Compte".
 * Vérifie si l'utilisateur est connecté, sinon le redirige.
 * Affiche les informations de l'utilisateur.
 */
function initializeAccountPage() {
    const user = JSON.parse(localStorage.getItem('abmcyUser'));

    // Si l'utilisateur n'est pas connecté, on le renvoie à la page d'authentification
    if (!user) {
        window.location.href = 'authentification.html';
        return;
    }

    // Afficher les informations de l'utilisateur
    document.getElementById('user-name-display').textContent = user.Nom;
    document.getElementById('user-email-display').textContent = user.Email;
    document.getElementById('dashboard-user-name').textContent = user.Nom;
    document.getElementById('dashboard-user-name-link').textContent = user.Nom;

    // Initiales pour l'avatar
    const initials = user.Nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-initials').textContent = initials;

    // Logique de déconnexion
    const logoutLink = document.getElementById('logout-link');
    const logoutNav = document.getElementById('logout-nav-link');
    
    const logoutAction = (e) => {
        e.preventDefault();
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.removeItem('abmcyUser');
            window.location.href = 'authentification.html';
        }
    };

    logoutLink.addEventListener('click', logoutAction);
    logoutNav.addEventListener('click', logoutAction);

    // Charger et afficher les commandes récentes
    loadRecentOrdersForAccount(user.IDClient);
}

/**
 * NOUVEAU: Charge les commandes récentes pour la page de compte.
 */
async function loadRecentOrdersForAccount(clientId) {
    const ordersSection = document.getElementById('recent-orders-section');
    if (!ordersSection) return;
    ordersSection.innerHTML = '<div class="loader mx-auto"></div><p class="text-center text-gray-500 mt-2">Chargement de vos commandes...</p>';

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getOrdersByClientId',
                data: { clientId: clientId }
            })
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Impossible de récupérer les commandes.");
        }

        if (result.data.length === 0) {
            ordersSection.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4><p class="text-gray-500">Vous n\'avez passé aucune commande pour le moment.</p>';
            return;
        }

        const ordersHTML = `
            <h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm text-left">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 font-semibold">Commande</th>
                            <th class="p-3 font-semibold">Date</th>
                            <th class="p-3 font-semibold">Statut</th>
                            <th class="p-3 font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(order => `
                            <tr class="border-b">
                                <td class="p-3 font-medium text-blue-600">#${order.IDCommande.split('-')[1]}</td>
                                <td class="p-3">${new Date(order.Date).toLocaleDateString('fr-FR')}</td>
                                <td class="p-3"><span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800">${order.Statut}</span></td>
                                <td class="p-3 text-right font-semibold">${Number(order.Total).toLocaleString('fr-FR')} F CFA</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        ordersSection.innerHTML = ordersHTML;

    } catch (error) {
        console.error("Erreur lors du chargement des commandes:", error);
        ordersSection.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4><p class="text-red-500">Une erreur est survenue lors du chargement de vos commandes.</p>';
    }
}