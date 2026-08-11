# WASI — Guide Demo Investisseur

## Acces Plateforme

- URL : https://atarawendesidkabore-hash.github.io/wasi-platform/index.html
- Mot de passe : WASI-DEMO-DM01

## Parcours Demo Recommande (10 minutes)

### 1. Intelligence (3 min)

- Cliquer sur "Intelligence" dans le menu
- Selectionner un pays (ex : Cote d'Ivoire, Ghana, Nigeria)
- Observer le score composite et la **decomposition de l'ajustement** : macro Banque mondiale (+/-5), stabilite, veille legislative (+/-2), diversification export (+/-3)
- Point fort a montrer : sous "Veille legislative", les **titres de presse cliquables** qui ont produit l'ajustement du jour — le score est verifiable, pas une boite noire
- Ouvrir "Methodologie" (menu haut) : le bareme complet est public
- Ouvrir le panneau "Secteurs d'activite" d'un pays : score d'adequation 0-100 par secteur, calcule sur les ressources et exports du pays

### 2. DEX — Marches / AFEX (3 min)

- Cliquer sur "DEX — Marches"
- Bandeau du haut : date des cours et bourses en direct (BRVM cours officiels, JSE, EGX, FX, crypto)
- Onglet "Transfert WASI" : simuler 200 EUR vers XOF — bareme par palier, comparaison Wave, parcours KYC en 3 etapes
- Explorer les 17 bourses africaines par onglet (BRVM, NGX, GSE, JSE, EGX...)

### 3. Bourse WASI (2 min)

- Notre **propre** marche : PME africaines cotees par seances de fixing (mercredi 10h WAT)
- Onglets : Marche, annuaire des 29 bourses africaines, Emetteurs, Soumettre une PME
- A distinguer du DEX, qui suit les bourses deja existantes

### 4. Banking (1 min)

- Interface AfriTrade Bank
- Comptes multi-devises, transferts, mobile money

### 5. Comptabilite OHADA (1 min)

- Module SYSCOHADA revise
- Plan comptable 8 classes

## AFEX Explorer

- URL : https://atarawendesidkabore-hash.github.io/wasi-platform/wasi-dex/index.html
- 54 pays, dont **43 profils detailles** : ponderations d'indice calculees sur les statistiques douanieres UN Comtrade, avec HHI et metriques de concentration
- Cliquer sur un fonds (ex : ZMBEX, CIREX, NGAEX) pour voir les ponderations reelles et la source
- Vues : Tableau, Grille, Comparer — filtres par region, modele, profil
- Variante Next.js (application distincte) : https://atarawendesidkabore-hash.github.io/wasi-platform-next/dex

## CLI (pour les techniques)

```
node wasi-cli/wasi.js status
node wasi-cli/wasi.js show CIREX
node wasi-cli/wasi.js compare GHAEX NGAEX
node wasi-cli/wasi.js map
node wasi-cli/wasi.js top 10
```

## Contact

kabore.tara@gmail.com
