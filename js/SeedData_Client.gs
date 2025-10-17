/**
 * Librairie de données de test pour les clients et commandes.
 */

function getSampleUsers() {
  return [
    // nom, email, motDePasse, adresse, telephone
    ['Alice Martin', 'alice.martin@example.com', 'password123', '12 Rue de la Paix, 75002 Paris', '0611223344'],
    ['Bob Durand', 'bob.durand@example.com', 'password123', '45 Avenue des Champs-Élysées, 75008 Paris', '0755667788']
  ];
}

function getSampleOrders() {
  return [
    // idClient, produits[], quantites[], adresseLivraison, total, moyenPaiement, notes
    ['CUST-ALICE1', ['PROD-SMART1'], [1], '12 Rue de la Paix, 75002 Paris', 450000, 'Carte de crédit', 'Livraison rapide svp'],
    ['CUST-BOB2', ['PROD-TSHIRT1', 'PROD-JEAN1'], [2, 1], '45 Avenue des Champs-Élysées, 75008 Paris', 72000, 'PayPal', '']
  ];
}