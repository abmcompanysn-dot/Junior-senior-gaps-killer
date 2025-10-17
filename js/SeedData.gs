/**
 * Librairie de données de test pour les produits et catégories.
 */

function getSampleProducts() {
  return [
    // nom, categorie, prixActuel, reduction, stock, imageURL, description, tags
    ['Smartphone X-Pro', 'Électronique', 450000, 15, 50, 'https://via.placeholder.com/400x400.png/f0f0f0/333?text=Phone', 'Un smartphone ultra-performant avec un écran OLED.', 'téléphone,mobile,tech'],
    ['Laptop UltraBook Z', 'Électronique', 780000, 10, 30, 'https://via.placeholder.com/400x400.png/f0f0f0/333?text=Laptop', 'Léger, puissant et une autonomie incroyable.', 'ordinateur,laptop,tech'],
    ['Casque Audio Pro', 'Accessoires', 85000, 20, 100, 'https://via.placeholder.com/400x400.png/f0f0f0/333?text=Headphones', 'Réduction de bruit active et son haute-fidélité.', 'audio,casque,musique'],
    ['T-shirt "Code Life"', 'Vêtements', 15000, 0, 200, 'https://via.placeholder.com/400x400.png/f0f0f0/333?text=T-Shirt', 'Le t-shirt parfait pour les développeurs passionnés.', 'vêtement,mode,geek'],
    ['Jean Slim Fit', 'Vêtements', 42000, 5, 150, 'https://via.placeholder.com/400x400.png/f0f0f0/333?text=Jeans', 'Un jean confortable et stylé pour toutes les occasions.', 'vêtement,mode,jean']
  ];
}

function getSampleCategories() {
  return [
    // nom, description, parentCategorie, ordreAffichage
    ['Électronique', 'Tous nos produits high-tech.', '', 1],
    ['Vêtements', 'Dernières tendances de la mode.', '', 2],
    ['Accessoires', 'Complétez votre style.', 'Électronique', 3],
    ['Promotions', 'Toutes nos offres spéciales.', '', 99]
  ];
}