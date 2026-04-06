# Rapport d'audit interne et d'evaluation du controle interne

## WASI Platform et applications affiliees

- Date de realisation: 2026-03-09
- Referentiel mobilise: cours d'audit interne 2025-2026, consignes du devoir, logique IFACI/IIA
- Source des constats: analyse documentaire, revue du depot git, lecture du code, verification build/test

## 1. Objet de la mission

L'objectif de cette mission est d'evaluer le niveau de maitrise des operations, des risques et du controle interne de WASI Platform et des applications affiliees visibles dans le depot git audite.

Le travail a ete conduit selon une approche de type IFACI:

- phase de prise de connaissance du perimetre;
- phase d'identification des risques et des controles existants;
- phase de formulation des constats, risques et recommandations;
- phase de proposition d'un plan d'action priorise.

## 2. Perimetre audite

Perimetre fonctionnel observe dans le depot:

| Domaine | Application / composant | Observation de maturite |
| --- | --- | --- |
| Plateforme centrale | WASI Terminal | module principal, connecte a des endpoints proteges |
| Services financiers | Banking Wallet | backend Express + SQLite + RBAC + journal d'audit |
| Marche / trading | ETF DEX | meme backend que Banking, controles transactionnels presents |
| Module commercial | AfriTrade | module d'interface relie a l'ecosysteme |
| Fiscalite | AfriTax | interface principalement statique, peu de controles metier observes |
| Comptabilite | OHADA-Compta | interface principalement statique, peu de controles metier observes |
| Scoring / risque | AfriCredit | moteurs TypeScript testes, non exposes comme application complete |
| Immobilier / donnees | SIBSCI | bibliotheque de calculs avec tests, non exposee comme application complete |

Perimetre technique observe:

- frontend React/Vite;
- backend Express dans `server/index.mjs`;
- persistence locale SQLite;
- scripts de diagnostic et de release gate dans `ops/`;
- historique git du depot.

## 3. Methodologie et limites

Travaux realises:

- lecture des consignes et du referentiel de mission IFACI;
- revue des fichiers applicatifs et des scripts d'exploitation;
- revue des controles d'acces, de la tracabilite et de l'integrite des traitements;
- revue des pratiques de configuration et de changement via git;
- execution des controles automatiques disponibles.

Verifications executees le 2026-03-09:

- `npm test`: 7 suites / 30 tests passes;
- `npm run build`: succes;
- revue des scripts `ops/release_gate.mjs` et `ops/diagnose_all.ps1`.

Limites de mission:

- pas d'entretiens avec les responsables metier ou techniques;
- pas d'acces a l'infrastructure de production ni aux journaux de supervision externes;
- pas de test de penetration ni de revue juridique/compliance complete;
- l'opinion porte donc sur le depot et les controles observables localement.

## 4. Opinion d'audit

Opinion globale: **niveau de maitrise partiel a insuffisant**.

Le dispositif presente plusieurs controles utiles et deja en place, notamment sur la journalisation, l'idempotence, certains controles de role et l'automatisation build/test. En revanche, des faiblesses importantes subsistent sur l'authentification, la segregation des acces entre modules, la gouvernance des changements, la gestion des secrets et la formalisation des applications affiliees.

En l'etat, la plateforme peut etre consideree comme **partiellement maitrisee sur le plan technique**, mais **insuffisamment encadree en controle interne** pour une exploitation sensible ou a fort enjeu financier sans actions correctrices prioritaires.

## 5. Points forts constates

1. **Journal d'audit present et protege contre la modification**
   Controle observe dans `server/index.mjs`: table `audit_log` avec triggers d'immutabilite.

2. **Controles de role sur certaines operations sensibles**
   Les operations de depot, retrait et consultation du journal d'audit sont protegees par authentification et role.

3. **Mecanisme d'idempotence sur les mutations**
   Les operations de depot, retrait, transfert et ordres DEX utilisent des cles d'idempotence et des enregistrements de replay.

4. **Transactions SQLite sur les ecritures critiques**
   Les traitements bancaires et DEX sont encapsules dans des transactions, ce qui reduit le risque d'incoherence de donnees.

5. **Automatisation de verification**
   Des tests unitaires existent et passent. Un script de release gate et un script de diagnostic central existent egalement.

6. **Source unifiee pour certaines donnees de plateforme**
   La documentation fonctionnelle mentionne une source unique pour le snapshot de marche, ce qui va dans le sens de l'integrite de la donnee.

## 6. Constats prioritaires

### Constat 1 - Gestion des secrets et de l'authentification insuffisamment securisee

- Niveau de risque: **Critique**
- Elements probants:
  - `server/index.mjs:45` utilise un secret JWT par defaut connu (`wasi-dev-insecure-secret`);
  - `server/index.mjs:283-307` contient des identifiants de demonstration en clair;
  - `server/index.mjs:775-776` utilise un hash SHA-256 simple pour les mots de passe;
  - `server/index.mjs:779-809` initialise automatiquement des comptes demo;
  - `server/index.mjs:2294-2299` compare directement le hash calcule sans mecanisme fort de protection.

- Risques:
  - usurpation d'identite;
  - forge de tokens JWT si le secret par defaut est conserve;
  - compromission des comptes demo;
  - non-conformite aux bonnes pratiques d'authentification.

- Recommandations:
  - supprimer tout secret JWT par defaut en environnement non local;
  - desactiver et retirer les comptes demo hors environnement de developpement;
  - remplacer SHA-256 par `bcrypt`, `scrypt` ou `argon2`;
  - separer le secret de signature JWT du mecanisme de hash des mots de passe;
  - ajouter limitation de tentatives, verrouillage temporaire et journalisation des echecs.

### Constat 2 - Separation des fonctions insuffisante sur les operations financieres sensibles

- Niveau de risque: **Eleve**
- Elements probants:
  - `server/index.mjs:2665-2758` autorise depot pour `TELLER` ou `MANAGER`;
  - `server/index.mjs:2760-2854` autorise retrait pour `TELLER` ou `MANAGER`;
  - `server/index.mjs:2856-2965` autorise les transferts, avec restriction limitee aux clients sur le compte source;
  - absence observee de double validation, de plafond, de workflow maker-checker ou de justification obligatoire.

- Risques:
  - fraude interne;
  - erreur de saisie a fort impact;
  - mouvements non autorises entre comptes;
  - difficulte a distinguer execution, validation et supervision.

- Recommandations:
  - instaurer un principe maker-checker pour depot, retrait et transfert au-dela d'un seuil;
  - imposer des plafonds par role, par compte et par jour;
  - exiger un motif normalise, une piece justificative et une validation superviseur;
  - mettre en place des rapprochements quotidiens et une revue d'exception.

### Constat 3 - Propagation transversale des sessions entre modules sans cloisonnement suffisant

- Niveau de risque: **Eleve**
- Elements probants:
  - `src/banking/bankingApi.js:3-43` stocke le token dans `localStorage` puis le copie dans `sessionStorage`;
  - `src/dex/dexApi.js:3-21` reutilise le meme token;
  - `src/main.jsx:44-47` propage la session lors de l'ouverture du DEX;
  - `src/compta/OhadaComptaApp.jsx:37-47` se base sur la presence du token pour la "session connectee";
  - `src/afritax/AfriTaxApp.jsx:13-15` reutilise la session bancaire pour d'autres modules.

- Risques:
  - extension non maitrisee des privileges entre applications;
  - exposition accrue en cas de faille XSS ou d'acces navigateur non controle;
  - absence de segregation logique entre modules metier;
  - non-alignement avec un modele de droits par application.

- Recommandations:
  - mettre en place une authentification centralisee avec scopes par module;
  - privilegier des cookies `httpOnly` ou un gestionnaire de session central;
  - imposer une revalidation pour les modules sensibles;
  - tracer les changements d'application et les elevations de privilege.

### Constat 4 - Gouvernance des changements et hygiene git perfectibles

- Niveau de risque: **Eleve**
- Elements probants:
  - `git ls-files` montre que `.env`, `server/data/wasi_banking.sqlite-shm` et `server/data/wasi_banking.sqlite-wal` sont versionnes;
  - `.gitignore` tente pourtant d'exclure les artefacts locaux et bases de donnees;
  - l'historique git contient un commit `db6cc95 always push`, peu compatible avec une discipline de changement robuste.

- Risques:
  - diffusion involontaire de configurations locales et artefacts runtime;
  - brouillage de la piste d'audit des changements;
  - faiblesse de la revue et de l'approbation des evolutions;
  - risque de restaurer un etat non propre de la base.

- Recommandations:
  - retirer des fichiers suivis tous les artefacts locaux non metier;
  - conserver uniquement `.env.example`;
  - interdire le versionnement des WAL/SHM et autres fichiers runtime;
  - imposer revue de code, conventions de commit et protection de branche;
  - formaliser un processus de mise en production et de rollback.

### Constat 5 - Maturite inegale des applications affiliees et exposition par defaut

- Niveau de risque: **Moyen a Eleve**
- Elements probants:
  - `src/platform/featureFlags.js` active par defaut tous les modules;
  - `src/afritax/AfriTaxApp.jsx` et `src/compta/OhadaComptaApp.jsx` montrent surtout des interfaces de navigation et des cartes statiques;
  - l'application donne l'impression d'un ecosysteme complet, alors que plusieurs modules ne disposent pas d'un backend metier ou d'un controle interne formel observe.

- Risques:
  - confusion utilisateur sur le niveau reel de service;
  - utilisation de modules non suffisamment cadres;
  - ecart entre promesse fonctionnelle et maitrise effective;
  - difficultes de responsabilisation des proprietaires metier.

- Recommandations:
  - classer les modules par niveau de maturite: production, pilote, beta, concept;
  - mettre les modules non matures derriere des feature flags a `false` par defaut;
  - afficher un statut fonctionnel explicite dans l'interface;
  - definir un proprietaire, un processus et des controles attendus par application.

### Constat 6 - Exposition d'informations techniques et controles preventifs incomplets

- Niveau de risque: **Moyen**
- Elements probants:
  - `server/index.mjs:819` autorise `cors({ origin: true })`;
  - `server/index.mjs:2217-2230` expose en clair des informations de sante et de configuration, dont le chemin de base locale et l'etat `allowDemoUsers`;
  - aucune preuve visible de limitation de debit ou de verrouillage de compte dans le backend observe.

- Risques:
  - facilitation de la reconnaissance technique;
  - augmentation du risque de brute force;
  - surface d'exposition inutilement large.

- Recommandations:
  - restreindre CORS aux origines approuvees;
  - reduire la reponse `health` au strict necessaire;
  - ajouter du rate limiting sur les endpoints d'authentification et sensibles;
  - activer des alertes sur les acces anormaux.

## 7. Evaluation du controle interne par domaine

| Domaine | Controles observes | Niveau apprecie | Commentaire |
| --- | --- | --- | --- |
| Controle d'acces | JWT, RBAC partiel, comptes platform_users | Moyen-faible | presence de controles, mais secrets faibles et comptes demo |
| Separation des taches | roles client/teller/manager | Faible | absence de double validation sur operations financieres |
| Tracabilite | `audit_log` immutable, traces de succes/echec | Moyen | bon socle, a completer par supervision et revue |
| Integrite des operations | transactions SQLite, idempotence | Moyen | positif, mais architecture locale limitee |
| Gestion des changements | tests, build, release gate, diagnostic | Moyen-faible | bonne base outillage, discipline git insuffisante |
| Continuite d'activite | scripts de verification | Faible | pas de preuve observee de sauvegarde/restauration formelle |
| Conformite / procedures | quelques docs et diagnostic | Faible | manque de procedures formalisees par application |
| Applications affiliees | routage commun et navigation unifiee | Faible a moyen | maturite heterogene, statut reel a clarifier |

## 8. Plan d'action recommande

### Priorite immediate (0 a 30 jours)

1. Supprimer le secret JWT par defaut et imposer une variable d'environnement obligatoire.
2. Desactiver les comptes demo et retirer les mots de passe en clair du code.
3. Sortir `.env` et les fichiers SQLite runtime du versionnement git.
4. Restreindre CORS et reduire l'endpoint `health`.
5. Mettre les modules affilies non matures derriere des feature flags a `false` par defaut.

### Priorite court terme (30 a 60 jours)

1. Implementer un hash robuste des mots de passe.
2. Ajouter rate limiting, journalisation des tentatives et verrouillage temporaire.
3. Mettre en place maker-checker, plafonds et validations sur depot/retrait/transfert.
4. Cloisonner les sessions et definir des scopes par application.
5. Formaliser une procedure de changement avec revue et approbation.

### Priorite moyen terme (60 a 90 jours)

1. Definir un manuel de procedures par application.
2. Mettre en place sauvegarde, restauration et tests de reprise.
3. Construire une cartographie des risques WASI par processus.
4. Etablir des indicateurs de controle: anomalies, rejets, tentatives refusees, ecarts de rapprochement.
5. Organiser un audit de suivi sur la mise en oeuvre des recommandations.

## 9. Conclusion

WASI Platform dispose deja de plusieurs briques techniques interessantes et de bons reflexes d'ingenierie, en particulier sur les tests, l'idempotence et la journalisation. Toutefois, du point de vue de l'audit interne et du controle interne, la maitrise reste inachevee.

Le point cle est le suivant: **la plateforme montre une base technique prometteuse, mais pas encore un dispositif de controle interne suffisamment robuste pour supporter sans reserve des operations sensibles multi-applications**.

L'enjeu principal n'est donc pas seulement de "faire fonctionner" les applications, mais de:

- fiabiliser les acces et les secrets;
- separer execution, validation et supervision;
- formaliser les procedures;
- clarifier le statut reel des applications affiliees;
- renforcer la gouvernance des changements.

Sous reserve de la mise en oeuvre des actions prioritaires ci-dessus, un audit de suivi pourra requalifier le niveau de maitrise a un niveau satisfaisant.
