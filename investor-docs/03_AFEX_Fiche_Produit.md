# AFEX -- Africa Export Index Family

## Fiche Produit Investisseur

**Emetteur :** West Africa Structured Index Ltd (WASI)
**Classe d'actifs :** Indices de matieres premieres souveraines
**Univers :** 54 Etats africains souverains
**Devise de reference continentale :** USD
**Statut :** En cours de structuration

---

## 1. Presentation Generale

L'AFEX (Africa Export Index Family) est une famille d'indices de matieres premieres couvrant l'ensemble du continent africain. Chaque indice national reflete la composition reelle des exportations d'un Etat souverain, ponderee par la part moyenne de chaque poste dans la valeur exportee sur une periode glissante de 10 ans.

L'AFEX permet aux investisseurs, gestionnaires d'actifs et institutions de disposer d'un outil de reference transparent, replicable et comparable en USD a l'echelle continentale.

**Base de ponderation -- valeur, et non tonnage.** La ponderation par tonnage exporte reste la cible methodologique, mais elle n'est pas calculable a ce jour : les Nations Unies (UN Comtrade) ne recoivent **aucun poids net declare** de la majorite des Etats africains (Burkina Faso 2022 : 0 ligne douaniere sur 86 comporte un tonnage). Les ponderations publiees sont donc calculees sur la **valeur exportee en USD**, integralement declaree et verifiable, et chaque profil pays porte explicitement cette mention. Le passage au tonnage se fera pays par pays, a mesure que les instituts nationaux de statistique fourniront des series exploitables.

**Etat d'avancement.** 47 pays disposent de profils calcules a partir des statistiques douanieres officielles, dont **43 profils detailles** (au moins 5 annees de donnees et 3 postes d'exportation). Les 11 pays restants conservent un profil de depart : 4 par insuffisance d'historique (Algerie, Libye, Guinee, Djibouti) et 7 parce qu'ils ne declarent pas leurs exportations a Comtrade (Soudan, Tchad, Guinee equatoriale, Erythree, Ethiopie, Somalie, Soudan du Sud).

---

## 2. Architecture de l'AFEX

### 2.1 Sous-familles regionales

| Code | Region | Pays couverts | Nombre de pays |
|------|--------|---------------|----------------|
| NAEX | Afrique du Nord | Maroc, Algerie, Tunisie, Libye, Egypte, Mauritanie | 6 |
| WAEX | Afrique de l'Ouest | Senegal, Mali, Burkina Faso, Cote d'Ivoire, Ghana, Nigeria, etc. | 16 |
| CAEX | Afrique Centrale | Cameroun, Gabon, Congo, RDC, Tchad, etc. | 8 |
| EAEX | Afrique de l'Est | Kenya, Tanzanie, Ethiopie, Ouganda, Rwanda, etc. | 11 |
| SAEX | Afrique Australe | Afrique du Sud, Mozambique, Zambie, Zimbabwe, etc. | 13 |
| **AFEX** | **Continent** | **Total** | **54** |

### 2.2 Donnees cles

| Parametre | Valeur |
|-----------|--------|
| Matieres premieres distinctes suivies | 82 |
| Devises couvertes | 42 |
| Methodologie de ponderation | Moyenne glissante 10 ans de la part dans la valeur exportee (source : UN Comtrade) |
| Cible methodologique | Tonnage exporte, sous reserve de disponibilite des statistiques nationales |
| Profils detailles publies | 43 sur 54 |
| Metriques de concentration | HHI, part du premier poste, part des 5 premiers |
| Reconstitution | Annuelle |
| Reequilibrage | Trimestriel |
| Comparaison continentale | En USD |

### 2.3 Modeles methodologiques

Trois modeles distincts sont appliques selon la geographie du pays :

| Modele | Type de pays | Logique de calcul |
|--------|-------------|-------------------|
| **Coastal** | Pays cotiers avec acces portuaire | Modele port-led : prix FOB port de reference |
| **Landlocked** | Pays enclaves | Modele corridor : prix ajuste des couts de transit terrestre |
| **Island** | Etats insulaires | Modele maritime/aerien : logistique mixte mer-air |

---

## 3. Prototypes Detailles

Les ponderations ci-dessous sont **calculees**, non illustratives : part moyenne de chaque chapitre douanier (HS2) dans la valeur exportee, 2014-2023, source UN Comtrade, renormalisee sur les postes retenus. Elles sont reproductibles a partir des donnees publiees dans la plateforme.

### 3.1 CIREX -- Cote d'Ivoire (XOF)

| Rang | Poste d'exportation | Ponderation |
|------|--------------------|-------------|
| 1 | Cacao et preparations de cacao | 43,03% |
| 2 | Combustibles mineraux, petrole et gaz | 16,67% |
| 3 | Pierres et metaux precieux | 10,04% |
| 4 | Fruits et fruits a coque comestibles (dont cajou) | 9,72% |
| 5 | Caoutchouc | 8,52% |
| 6 | Navires et bateaux | 3,66% |
| 7 | Coton | 2,67% |
| 8 | Graisses et huiles vegetales (dont palme) | 2,28% |

- **Concentration :** HHI 1 900 -- concentre ; premier poste 37,99% du panier
- **Exportations annuelles :** 18,4 Mds USD (2023) -- 10 annees de donnees
- **Devise locale :** XOF (Franc CFA BCEAO) | **Modele :** Coastal (port-led)
- **Regulateur :** CREPMF (Conseil Regional de l'Epargne Publique et des Marches Financiers)

### 3.2 BUREX -- Burkina Faso (XOF)

| Rang | Poste d'exportation | Ponderation |
|------|--------------------|-------------|
| 1 | Pierres et metaux precieux (or) | 71,69% |
| 2 | Coton | 11,79% |
| 3 | Graines oleagineuses (dont sesame) | 5,12% |
| 4 | Fruits et fruits a coque comestibles (cajou) | 4,28% |
| 5 | Zinc | 2,65% |
| 6 | Combustibles mineraux | 1,14% |

- **Concentration :** HHI 4 945 -- tres concentre ; premier poste 69,02% du panier
- **Exportations annuelles :** 4,5 Mds USD (2023) -- 10 annees de donnees
- **Devise locale :** XOF (Franc CFA BCEAO)
- **Modele :** Landlocked (corridor) -- pays enclave, transit via les ports d'Abidjan, Lome et Tema
- **Regulateur :** CREPMF

### 3.3 GHAEX -- Ghana (GHS)

| Rang | Poste d'exportation | Ponderation |
|------|--------------------|-------------|
| 1 | Pierres et metaux precieux (or) | 40,80% |
| 2 | Combustibles mineraux, petrole et gaz | 28,33% |
| 3 | Cacao et preparations de cacao | 18,69% |
| 4 | Fruits et fruits a coque comestibles | 3,85% |
| 5 | Matieres plastiques | 1,83% |
| 6 | Bois d'oeuvre | 1,67% |
| 7 | Minerais, scories et cendres (dont manganese) | 1,59% |

- **Concentration :** HHI 2 372 -- concentre ; premier poste 37,24% du panier
- **Exportations annuelles :** 16,9 Mds USD (2023) -- 9 annees de donnees
- **Devise locale :** GHS (Cedi ghanaen) | **Modele :** Coastal (port-led)
- **Regulateur :** SEC Ghana (Securities and Exchange Commission)

### 3.4 NGAEX -- Nigeria (NGN)

| Rang | Poste d'exportation | Ponderation |
|------|--------------------|-------------|
| 1 | Combustibles mineraux, petrole et gaz | 93,27% |
| 2 | Navires et bateaux | 2,85% |
| 3 | Cacao et preparations de cacao | 0,96% |
| 4 | Engrais (dont uree) | 0,87% |
| 5 | Graines oleagineuses (dont sesame) | 0,70% |

- **Concentration :** HHI 8 338 -- tres concentre ; premier poste 91,26% du panier. **Avertissement : mono-exportateur.** L'indice NGAEX est de fait un indice petrole-gaz.
- **Exportations annuelles :** 65,1 Mds USD (2023) -- 10 annees de donnees
- **Devise locale :** NGN (Naira nigerian) | **Modele :** Coastal (port-led)
- **Regulateur :** SEC Nigeria / NGX (Nigerian Exchange Group)
- **Cadre reglementaire :** Petroleum Industry Act (PIA) 2021

> Note de lecture : les postes suivent la nomenclature douaniere harmonisee au niveau chapitre (HS2). L'or et les diamants relevent du meme chapitre « Pierres et metaux precieux », le petrole et le gaz du meme chapitre « Combustibles mineraux ». Une decomposition par produit (HS6) est possible pays par pays sur demande.

---

## 4. Modele de Revenus

| Source de revenus | Description |
|-------------------|-------------|
| Licences de donnees | Acces aux donnees d'indices pour institutions financieres, gestionnaires d'actifs et chercheurs |
| Frais de gestion | 0,50% a 0,65% appliques aux produits structures replicant les indices AFEX |
| Acces API | Flux de donnees en temps reel et historiques via interface programmatique |

---

## 5. Infrastructure Technologique

| Capacite | Statut |
|----------|--------|
| Pipeline de donnees automatise | **En production** -- statistiques douanieres UN Comtrade, indicateurs Banque mondiale, veille legislative quotidienne |
| Publication des profils d'indices | **En production** -- 54 profils publies (JSON, Markdown, API fichier), 43 detailles |
| Acces API programmatique | **A construire** -- les donnees sont aujourd'hui publiees en fichiers statiques versionnes |
| Tokenisation | **A l'etude** -- non implemente ; aucune emission de token adossee aux indices a ce stade |
| Integration CBDC (eCedi, eNaira) | **A l'etude** -- non implemente ; depend du calendrier des banques centrales concernees |
| Couche de micropaiement (x402) | **A l'etude** -- non implemente |

---

## 6. Synthese

| Critere | AFEX |
|---------|------|
| Couverture | 54 Etats souverains africains |
| Sous-familles | 5 (NAEX, WAEX, CAEX, EAEX, SAEX) |
| Modeles | 3 (Coastal, Landlocked, Island) |
| Matieres premieres | 82 |
| Devises | 42 |
| Ponderation | Part dans la valeur exportee, moyenne glissante 10 ans (UN Comtrade) |
| Profils detailles | 43 sur 54 |
| Reconstitution / Reequilibrage | Annuel / Trimestriel |
| Frais de gestion | 0,50% -- 0,65% |
| Technologie en production | Pipelines de donnees automatises, publication versionnee des profils |
| Technologie a l'etude | API programmatique, tokenisation, CBDC, x402 |

---

*Document a usage des investisseurs. Ne constitue pas une offre de souscription. WASI -- West Africa Structured Index Ltd.*
