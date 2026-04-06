// WASI static data and knowledge bases

export const GOVERNMENT_ADVISORY_KNOWLEDGE = `
EXPERTISE GOUVERNEMENTALE & MACROÉCONOMIQUE — AFRIQUE DE L'OUEST (WASI v3.0)

━━ PROFILS MACROÉCONOMIQUES PAYS (2025–2026 estimations) ━━
NIGERIA (NG):  PIB ~450Mrd USD | Croissance 3.2% | Inflation ~33% | Chômage ~5% officiel
               Dette pub/PIB ~38% | Service dette/recettes ~30% (problème CRITIQUE)
               Pétrole = 85% exports, 55% recettes fiscales fédérales | Diversification urgente
               Notation S&P: B- (stable) | Moody's: Caa1

CÔTE D'IVOIRE (CI): PIB ~78Mrd USD | Croissance 6.5% | Inflation ~3.5% | 1ère économie UEMOA
               Cacao 40% production mondiale | Dette pub/PIB ~60% | Notation Fitch: B+
               Eurobonds actifs (2024: 2,6Mrd USD émis) | Hub régional port/finance

GHANA (GH):    PIB ~72Mrd USD | Croissance 5.7% | Inflation ~22% | Programme FMI ECF
               Post-défaut 2022: restructuration dettes ext./int. | Dette pub/PIB ~85%
               Notation Fitch: B- (positive) | Stabilisation en cours | Or = 1er export

SÉNÉGAL (SN):  PIB ~34Mrd USD | Croissance 8.5% (boost pétrole/gaz Sangomar 2024)
               Inflation ~4% | Dette pub/PIB ~75% | Notation Fitch: B+
               Pétrole offshore: 100 000 bpj Sangomar phase 1 | GNL Grande Tortue 2025

MALI (ML):     PIB ~20Mrd USD | Croissance 4.5% | Inflation ~3% | Sanctions levées 2024
               or = 1er export | accès marchés int'l limité | AES (Alliance États Sahel) risque

BURKINA FASO (BF): PIB ~19Mrd USD | Croissance 3.0% | Inflation ~4%
               Or = 1er export | Crise sécuritaire: 40% territoire sous insécurité
               Budget défense ~5% PIB (hausse drastique) | Aide int'l réduite

GUINÉE (GN):   PIB ~22Mrd USD | Croissance 5.5% | Simandou fer 2025–2027: +15% PIB attendu
               Bauxite 1er producteur mondial (25% offre globale) | Alumine en développement

BÉNIN (BJ):    PIB ~20Mrd USD | Croissance 6.0% | Inflation ~2% | Hub transit (Niger, BF)
               Obligations sukuk émises | Meilleure performance fiscale zone UEMOA

TOGO (TG):     PIB ~11Mrd USD | Croissance 6.5% | Hub logistique Lomé | Phosphate = export clé
NIGER (NE):    PIB ~15Mrd USD | Uranium + pétrole | Sanctions post-coup 2023 (partiellement levées)
MAURITANIE (MR): PIB ~10Mrd USD | Gaz GTA (Total/BP) offshore | Pêche + fer SNIM
SIERRA LEONE (SL): PIB ~4.5Mrd USD | Fer, diamants, rutile | Reconstruction post-Ebola
LIBÉRIA (LR):  PIB ~4.2Mrd USD | Fer Arcelor Mittal, caoutchouc Firestone | USD comme monnaie
CAP-VERT (CV): PIB ~2.4Mrd USD | Tourisme 25% PIB | Note investment grade (Moody: B2)
GAMBIE (GM):   PIB ~2.3Mrd USD | Tourisme + remittances | Petite économie très ouverte
GUINÉE-BISSAU (GW): PIB ~1.8Mrd USD | Noix de cajou 90% exports | Très fragile

━━ CRITÈRES DE CONVERGENCE UEMOA (Pacte de Stabilité et de Croissance) ━━
Critères PRIMAIRES (obligatoires):
• Déficit budgétaire global ≤ 3% PIB (norme fondamentale)
• Taux d'inflation annuel moyen ≤ 3%
• Arriérés de paiement intérieurs et extérieurs = 0

Critères SECONDAIRES (recommandés):
• Masse salariale / recettes fiscales ≤ 35%
• Investissements publics financés localement / recettes fiscales ≥ 20%
• Déficit extérieur courant hors dons ≤ 5% PIB
• Recettes fiscales / PIB ≥ 20%

Performance 2025 estimée (conformité):
CI: conforme critères primaires | SN: conforme (revenus pétroliers)
BF: déficit >3% (dépenses sécurité) | ML: déficit >3% (accès limité)
NE: hors critères (sanctions) | BJ: parmi les mieux notés UEMOA

━━ PROGRAMMES FMI / BANQUE MONDIALE ACTIFS ━━
Ghana (GH): ECF Programme $3Mrd (2023–2026) — stabilisation macroéco, restructuration dette
  Conditions: Réformes fiscales, réduction masse salariale, privatisation SOEs
Niger (NE): Programme suspendu post-coup 2023 — négociations reprises partiel 2025
Burkina Faso (BF): Accès FMI limité — financement déficit via émissions UEMOA
Sénégal (SN): Article IV positif — pétrole booste projections
Nigeria (NG): Pas de programme — réformes CBN (unification taux change, suppression subsides fuel)
Guinée (GN): Article IV — Simandou project monitoring special

━━ NOTATIONS SOUVERAINES & ACCÈS MARCHÉ DETTE (2025) ━━
CI:  B+/B+  (Fitch/S&P, stable)  — eurobonds réguliers, yield ~9–10%
SN:  B+/B+  (stable)             — yield eurobond ~9.5–11%
GH:  B-/B-  (positive, recovery) — yield ~12–14% post-restructuration
NG:  B-/Caa1(stable)             — yield Eurobond ~9.5–11%
BF:  NR     (non-noté post-coup) — BCEAO marché régional uniquement
ML:  NR     (non-noté)           — BCEAO marché régional uniquement
NE:  NR     (non-noté)           — accès très limité
GN:  B-     (Moody's 2024)       — yield ~14–16%
CV:  B2/B+  (stable)             — meilleure notation zone Atlantique

━━ POLITIQUE FISCALE — CONSEILS GOUVERNEMENTAUX ━━
Mobilisation recettes (Tax/GDP UEMOA = 14% vs norme 20% cible):
• Automatisation douanes (SYDONIA World, ASYCUDA++) → réduire fraude 30–40%
• Élargissement assiette TVA: secteur informel représente 40–60% économies
• Fiscalité foncière: sous-exploitée, potentiel recettes +2–3% PIB
• Taxe sur ressources naturelles: revoir partage production (mining, pétrole)
• Réduction exemptions fiscales non-stratégiques: coût ~3–5% PIB

Gestion dépenses publiques (PFM):
• Contrainte masse salariale: NG (50% recettes), GH (42%), BF (38%) — critique
• Privilégier dépenses capital (infrastructures) vs dépenses courantes
• Systèmes IFMIS (Integrated Financial Mgmt) → transparence budget
• Passation marchés publics: PPTE standards, e-procurement anti-corruption
• Allègement PPTE pour pays éligibles → libérer ressources investissement

Gestion dette publique:
• Allonger maturités: éviter refinancement massif (risque rollover)
• Diversifier base investisseurs: pension funds locaux sous-exploités
• Obligations vertes (Green/Blue bonds): CI, SN en avance — financement climat
• Swap dette contre nature: opportunité Sierra Leone, Libéria (forêts)
• Réduire dépendance T-bills court terme (taux variables, risque rollover)

━━ POLITIQUE MONÉTAIRE (BCEAO + BANQUES CENTRALES NATIONALES) ━━
BCEAO (Zone UEMOA — XOF):
• TIAO (taux directeur): 4.50% | Réserves obligatoires: 3% (dépôts à vue)
• Objectif: stabilité prix (inflation <3%) + soutien croissance
• Instruments: refinancement banques, OMO, facilité de prêt marginal
• Réforme fintech: BCEAO mobile money framework (Orange Money, MTN MoMo)
• Initiatives: Digitalisation paiements gouvernementaux via SWIFT UEMOA

CBN Nigeria: MPR 27.5% — politique restrictive anti-inflation
  • Unification taux change 2023 → amélioration transparence forex
  • Réformes: subsides carburant supprimés 2023 (économie ~5Mrd USD/an)
  • Digital Naira (eNaira) — CBDC en déploiement

Bank of Ghana: 28% — programme IMF impose rigueur
  • Domestic Debt Exchange (DDEP 2023): restructuration 15Mrd USD dette intérieure
  • Ghana Cedi stabilisation via réserves + soutien FMI

━━ STRATÉGIES SECTORIELLES — CONSEILS GOUVERNEMENTS ━━
Agriculture:
• Côte d'Ivoire: transformation cacao (objectif 50% locale vs 35% actuel), labellisation
• Burkina Faso: coton — intégration filière textile locale, valeur ajoutée
• Sénégal: pêche artisanale + industrielle — accords EU à renégocier
• Nigeria: diversification agriculture post-pétrole — cassava, rice, soy

Ressources naturelles:
• Guinée: Simandou (fer, 2Mrd tonnes réserves) — royalties minières, contenu local 30%
• Mali/BF: Or — révision codes miniers, augmenter part État
• Sénégal: Sangomar pétrole — fonds de stabilisation obligatoire
• Nigeria: réforme NNPCL (privatisation partielle) + local content act

Infrastructure:
• Corridor Abidjan–Lagos (1000km): autoroute sous financement AfDB, PPP
• Dakar–Bamako rail: réhabilitation SITARAIL-style | financement Chine/UE
• Port Lomé deepwater extension | Port Tema Terminal 3 (Bolloré)
• WAPP (West African Power Pool): interconnexions électriques régionales
• Fibre optique sous-marine: ACE, SAT3 → connectivité data centres

AfCFTA (Zone de Libre-Échange Continentale Africaine):
• Tarifs 90% marchandises éliminés progressivement → 2035
• Règles d'origine: minimum 30–40% valeur ajoutée locale
• Nigeria = plus grand marché: PIB $450Mrd → opportunité production pour exportation
• Zone industrielle spéciale: Abidjan (VITIB), Lagos (Lekki FTZ), Accra (Tema EPZ)
• Impact estimé: +$450Mrd commerce intra-africain additionnel d'ici 2035

━━ CONSEIL GOUVERNEMENTAL — CADRE D'ANALYSE ━━
Pour tout conseil à un membre du gouvernement, structurer ainsi:
1. DIAGNOSTIC — Situation actuelle (données WASI + macro + fiscale)
2. PROBLÉMATIQUE — Contraintes spécifiques (politique, institutionnel, financier)
3. OPTIONS POLITIQUES — 2–3 scénarios avec avantages/risques
4. RECOMMANDATION — Priorité actionnable à court terme (<12 mois) et moyen terme
5. INDICATEURS DE SUCCÈS — KPIs mesurables (ratios fiscal, indices WASI, notation)
6. RISQUES — Politique, macroéco, sécurité, acceptabilité sociale
`;

// ── Country Tax & Fiscal Data — Loi de Finances / Finance Acts ───────────────
// Source: DGI CI, FIRS Nigeria, GRA Ghana, DGID Sénégal — knowledge base Aug 2025
export const COUNTRY_TAX_DATA = {
  CI: {
    year: "2025",
    source: "Loi de Finances CI 2025 — DGI (Direction Générale des Impôts)",
    currency: "XOF — Franc CFA (parité fixe 655.957 XOF/EUR)",
    changes_2025: [
      "Télédéclaration obligatoire pour toutes les entreprises",
      "Nouvelle taxe sur l'économie numérique (e-commerce, plateformes)",
      "Renforcement des règles de prix de transfert (documentation obligatoire)",
      "Réforme du régime fiscal des PME (seuil CA revu à 200M FCFA)",
      "Digitalisation du guichet douanier SYDAM World (Port Abidjan)",
    ],
    corporate: [
      { label: "BIC grandes entreprises",        rate: 25,  note: "Impôt sur les Bénéfices Industriels et Commerciaux" },
      { label: "BIC PME (CA < 200M FCFA)",        rate: 20,  note: "Régime simplifié" },
      { label: "IMF (minimum forfaitaire)",        rate: "0,5% CA", note: "Min 3M — Max 35M FCFA/an" },
      { label: "Retenue dividendes",              rate: 15,  note: "Sur distributions aux actionnaires" },
      { label: "Retenue intérêts",                rate: 18,  note: "Sur paiements d'intérêts" },
      { label: "Retenue royalties (non-résidents)", rate: 20, note: "Services et droits versés à l'étranger" },
      { label: "TAF — Taxe Activités Financières", rate: 10, note: "Sur commissions et services bancaires" },
    ],
    vat: [
      { label: "TVA standard",           rate: 18, note: "Taux général (biens et services)" },
      { label: "TVA réduite",            rate: 9,  note: "Biens de 1ère nécessité désignés" },
      { label: "TVA export",             rate: 0,  note: "Exportations — taux zéro" },
    ],
    vat_exempt: ["Produits alimentaires de base", "Intrants agricoles", "Médicaments", "Éducation", "Transports publics"],
    irpp: [
      { bracket: "0 – 600 000 FCFA/an",         rate: 0  },
      { bracket: "600 001 – 1 200 000 FCFA/an",  rate: 5  },
      { bracket: "1 200 001 – 2 500 000 FCFA/an", rate: 15 },
      { bracket: "2 500 001 – 7 500 000 FCFA/an", rate: 25 },
      { bracket: "> 7 500 000 FCFA/an",           rate: 36 },
    ],
    customs: [
      { cat: "Cat. 0", rate: 0,  label: "Biens sociaux essentiels (médicaments, livres)" },
      { cat: "Cat. 1", rate: 5,  label: "Matières premières & biens de capital" },
      { cat: "Cat. 2", rate: 10, label: "Intrants intermédiaires" },
      { cat: "Cat. 3", rate: 20, label: "Biens de consommation courante" },
      { cat: "Cat. 4", rate: 35, label: "Biens sensibles (protection économique)" },
    ],
    customs_levies: [
      { label: "Prélèvement communautaire CEDEAO",  rate: 0.5 },
      { label: "Prélèvement communautaire UEMOA",   rate: 1.0 },
      { label: "Redevance statistique",             rate: 1.0 },
    ],
    sector: [
      { label: "Droits export cacao (DUS + CGA)", rate: "~22% FOB", note: "1ère source recettes douanières CI" },
      { label: "Redevance minière",               rate: "3–6%",    note: "Sur valeur production" },
      { label: "Part État secteur minier",        rate: "10%",     note: "Free carry — sans apport de fonds" },
      { label: "PPT pétrole & gaz",               rate: "Variable", note: "Contrats de partage de production" },
    ],
  },
  NG: {
    year: "2024",
    source: "Finance Act Nigeria 2024 — FIRS (Federal Inland Revenue Service)",
    currency: "NGN — Naira Nigérian",
    changes_2025: [
      "Réduction CIT grandes entreprises de 30% maintenue",
      "Taxe sur l'économie numérique (non-résidents) : 6%",
      "Excise duty sur boissons sucrées renforcée",
      "Exemption CIT PME (CA < 25M NGN) confirmée",
    ],
    corporate: [
      { label: "CIT grandes entreprises (CA > 100M NGN)", rate: 30, note: "Corporate Income Tax" },
      { label: "CIT moyennes entreprises (25–100M NGN)", rate: 20, note: "" },
      { label: "CIT petites entreprises (< 25M NGN)",    rate: 0,  note: "Exonérées" },
      { label: "WHT dividendes",                         rate: 10, note: "Withholding Tax" },
      { label: "WHT intérêts",                           rate: 10, note: "" },
      { label: "Taxe économie numérique",                rate: 6,  note: "Non-résidents fournissant services digitaux" },
    ],
    vat: [
      { label: "VAT standard", rate: 7.5, note: "Taux faible vs région" },
    ],
    sector: [
      { label: "PPT pétrole (champs classiques)", rate: 85, note: "Petroleum Profits Tax — production principale" },
      { label: "PPT pétrole (eaux profondes)",    rate: 50, note: "Deep offshore" },
      { label: "Gas flaring penalty",             rate: "$2/Mscf", note: "Pénalité brûlage gaz" },
    ],
  },
  GH: {
    year: "2025",
    source: "Ghana Revenue Authority — Finance Act 2023 / Budget 2025",
    currency: "GHS — Cedi Ghanéen",
    changes_2025: [
      "E-Levy maintenu à 1% sur mobile money",
      "Prélèvement supplémentaire secteur minier reconduit",
      "COVID-19 Health Recovery Levy (1%) prolongé",
      "Droits d'accise sur boissons alcoolisées relevés",
    ],
    corporate: [
      { label: "CIT standard",                  rate: 25, note: "Corporate Income Tax" },
      { label: "CIT secteur minier",             rate: 35, note: "Or, bauxite, manganèse" },
      { label: "CIT pétrole & gaz",              rate: 35, note: "" },
      { label: "WHT dividendes (résidents)",     rate: 8,  note: "" },
      { label: "WHT dividendes (non-résidents)", rate: 8,  note: "" },
    ],
    vat: [
      { label: "VAT standard",               rate: 15,  note: "" },
      { label: "NHIL (santé)",               rate: 2.5, note: "National Health Insurance Levy" },
      { label: "GETFUND (éducation)",        rate: 2.5, note: "" },
      { label: "COVID-19 Recovery Levy",     rate: 1,   note: "" },
      { label: "TVA totale effective",       rate: 21,  note: "Cumul sur la plupart des transactions" },
    ],
    sector: [
      { label: "E-Levy mobile money",             rate: 1,    note: "Sur transactions > 100 GHS" },
      { label: "Royalty minière (or)",            rate: "5%", note: "Sur valeur production" },
      { label: "Prélèvement additionnel mines",   rate: 10,   note: "Sur bénéfices > 35% de rendement" },
    ],
  },
  SN: {
    year: "2025",
    source: "Code Général des Impôts Sénégal — DGID / Loi de Finances 2025",
    currency: "XOF — Franc CFA UEMOA",
    changes_2025: [
      "Nouveau régime fiscal pétrole & gaz (production démarrée 2024)",
      "Incitations fiscales zones économiques spéciales",
      "Renforcement taxe sur les transactions immobilières",
      "Extension TVA aux services numériques transfrontaliers",
    ],
    corporate: [
      { label: "IS — Impôt sur les Sociétés",       rate: 30, note: "Taux standard" },
      { label: "IS secteur pétrolier",              rate: 33, note: "Contrats post-2024" },
      { label: "Retenue dividendes",                rate: 10, note: "" },
      { label: "Retenue services (non-résidents)",  rate: 20, note: "" },
    ],
    vat: [
      { label: "TVA standard", rate: 18, note: "Alignée UEMOA" },
    ],
    sector: [
      { label: "Royalty pétrole (Sangomar)",  rate: "Variable", note: "Contrat de partage — Woodside/Petrosen" },
      { label: "Royalty GNL (GTA)",           rate: "Variable", note: "Greater Tortue Ahmeyim — BP/Kosmos" },
    ],
  },
};

// ── Banking Sector Knowledge Base — 16 ECOWAS Countries ──────────────────────
// Static knowledge injected into AI agent system prompt.
// Sources: BCEAO rapports annuels, CBN, Bank of Ghana, banques centrales nationales (2025-2026).
export const BANKING_KNOWLEDGE = `
SECTEUR BANCAIRE — AFRIQUE DE L'OUEST (Base de connaissance WASI v3.0)

━━ ZONE BCEAO / UEMOA (XOF — Franc CFA, parité fixe 655.957 XOF/EUR) ━━
Pays: CI, SN, BF, ML, TG, BJ, NE, GW
Régulateur: BCEAO (Banque Centrale des États de l'Afrique de l'Ouest), Dakar
Taux directeur BCEAO (TIAO): 4.50% (2026) | Taux de refinancement: 5.75%
Fourchette prêts corporate: 8–16% | PME/microfinance: 18–28%
Stabilité monétaire: excellente (arrimage EUR) → taux parmi les plus bas d'Afrique sub-saharienne

CÔTE D'IVOIRE (CI) — Banques & taux (meilleures offres en premier):
1. Coris Bank CI — en forte expansion, taux retail très compétitifs 9–13%
2. SIB (Société Ivoirienne de Banque / filiale BNI) — corporate 9–13%
3. SGCI (Société Générale CI) — corporate, trade finance 10–15%
4. Ecobank CI — réseau panafricain, corporate 9–14%
5. Bridge Bank — profil français, 10–15%
6. BNI (Banque Nationale d'Investissement) — projets publics, taux préférentiels
7. NSIA Banque — PME 12–18% | GTBank CI — corporate international 10–15%
Contexte: 1ère économie UEMOA → taux institutionnels les plus bas de la zone.

SÉNÉGAL (SN) — Banques & taux:
1. CBAO Attijari — leader, taux parmi les plus bas 8–13% (corporate prime)
2. BICIS (filiale BNP Paribas) — 9–14%
3. SGBS (Société Générale Sénégal) — 9–14%
4. Ecobank Sénégal — 9–14%
5. BHS (Banque de l'Habitat du Sénégal) — immobilier spécialisé
6. UBA Sénégal 10–14% | Orabank Sénégal 11–16%
Contexte: Meilleure note de crédit souverain UEMOA → taux infrastructure les plus bas.

BURKINA FASO (BF) — Banques & taux:
1. Coris Bank International — plus grand réseau national, taux compétitifs 9–14%
2. BankCom (Banque du Commerce du Burkina) — 10–15%
3. Ecobank Burkina — 10–15%
4. Bank of Africa Burkina (BOA) — 10–16%
5. SBB (Société Burkinabè de Banque) — 10–15%
6. SGBB (Société Générale Burkina Biso) — 11–16%
7. Orabank Burkina 11–16% | UBA Burkina corporate 10–14% | BPSB 12–18%
Contexte: Risque politique élevé (transition militaire 2022) → prime de risque +2/3% vs CI/SN.
Sécurité corridor Ouaga–Tema dégradée → impact sur prêts logistique/transport.

MALI (ML) — Banques & taux:
1. BDM (Banque de Développement du Mali) — institution publique, projets infra
2. BNDA (Banque Nationale de Développement Agricole) — agriculture préférentiel
3. Ecobank Mali 12–18% | Orabank Mali 12–18% | BOA Mali 12–18% | BSIC Mali 13–20%
Contexte: Post-coup (2021), sanctions CEDEAO levées mais accès financier limité. Corridor Dakar–Bamako dégradé.

BÉNIN (BJ) — Banques & taux:
1. Orabank Bénin 10–15% | Ecobank Bénin 10–15% | BOA Bénin 10–15%
2. UBA Bénin 10–14% | BSIC Bénin 11–17%
Contexte: Hub de transit vers Niger → secteur logistique actif, financement portuaire disponible.

TOGO (TG) — Banques & taux:
1. Orabank Togo — taux compétitifs 10–15%
2. Ecobank Togo 10–14% | SGBT (Société Générale Banque Togo) 10–15%
3. BOA Togo 10–15% | BSIC Togo 11–17%
Contexte: Port de Lomé = hub régional conteneurs, fort financement trade finance disponible.

NIGER (NE) — Banques & taux:
1. BOA Niger 13–20% | Ecobank Niger 13–20% | BSIC Niger 15–22%
Contexte: Sanctions post-coup 2023 partiellement levées, accès financier très restreint. Taux prohibitifs.

GUINÉE-BISSAU (GW) — BCEAO zone, très petite économie:
1. BSIC GW | Ecobank GW | Orabank GW — taux 12–20%

━━ NIGERIA (NG) — NGN (Naira) ━━
Régulateur: CBN (Central Bank of Nigeria)
Taux directeur MPR: 27.50% (CBN 2026 — lutte contre inflation ~33%)
Fourchette prêts commercial: 25–35% | Prime clients tier-1: 22–28%
1. GTBank (Guaranty Trust Bank) — taux corporate compétitifs ~24–28%, service premium, leader fintech
2. Stanbic IBTC (filiale Standard Bank SA) — meilleur taux pour multinationales ~23–28%
3. Standard Chartered Nigeria — corporate international ~23–27%
4. Zenith Bank — fort corporate banking ~24–30%
5. Access Bank — le plus grand par actifs ~24–30%
6. UBA — présence panafricaine ~24–30%
7. First Bank Nigeria — banque la plus ancienne, ~25–32%
8. Ecobank Nigeria ~25–30% | Fidelity Bank ~25–32% | FCMB ~26–32%
9. Sterling Bank ~26–33% | Wema Bank ~26–33% (retail/digital focus)
Contexte: Naira volatile (-50% vs USD 2023-2024). Projets USD/EUR indexés fortement préférables.
Unification taux de change CBN 2023 → meilleure transparence mais inflation persiste.

━━ GHANA (GH) — GHS (Cedi) ━━
Régulateur: Bank of Ghana (BoG)
Taux directeur BoG: 28.00% (2026)
Fourchette prêts commercial: 30–42%
1. GCB Bank (Government) — taux préférentiels projets publics ~28–35%
2. Absa Ghana (ex-Barclays) — multinationales ~28–35%
3. Standard Chartered Ghana — corporate international ~28–34%
4. Ecobank Ghana ~29–36%
5. Agricultural Development Bank (ADB) — agriculture ~25–33% (le plus bas)
6. CAL Bank ~30–38% | Fidelity Bank Ghana ~32–40% | Societe Generale Ghana ~30–37%
Contexte: Restructuration dette souveraine 2022–2023 (IMF USD 3Mrd). GHS a perdu >60% vs USD.
Stabilisation en cours — taux en baisse progressive. Projets USD indexés recommandés.

━━ GUINÉE (GN) — GNF (Franc Guinéen) ━━
Régulateur: BCRG (Banque Centrale de la République de Guinée)
Taux directeur BCRG: ~13% (2025)
Fourchette prêts commercial: 18–28%
1. Société Générale Guinée — taux corporate les plus compétitifs ~17–22%
2. BICIGUI (filiale BNP Paribas) — corporate ~18–24%
3. Ecobank Guinée ~18–24% | UBA Guinée ~18–24% | GTBank Guinée ~18–24%
4. Orabank Guinée ~20–26% | BSIC Guinée ~20–27%
Contexte: Projet Simandou (minerai de fer) → afflux financement externe 2025–2027.
GNF volatile, financement projets mining en USD conseillé.

━━ MAURITANIE (MR) — MRU (Ouguiya) ━━
Régulateur: BCM (Banque Centrale de Mauritanie)
Taux directeur: ~10% (2025) | Fourchette prêts: 12–20%
1. Banque Mauritanienne pour le Commerce International (BMCI) — 12–18%
2. Générale de Banque de Mauritanie (GBM) — 12–18%
3. Chinguitty Bank 12–17% | Orabank Mauritanie 13–19%
Contexte: Gaz naturel offshore GTA (Total Energies) → afflux investissement 2025–2030.

━━ SIERRA LEONE (SL) — SLE (Leone) ━━
Régulateur: BSL (Bank of Sierra Leone) | Taux directeur: ~24%
1. Sierra Leone Commercial Bank (SLCB) 22–30%
2. Rokel Commercial Bank 22–30% | Ecobank SL ~22–28%

━━ LIBÉRIA (LR) — LRD + USD (économie dollarisée) ━━
Prêts USD disponibles: 10–18% (plus attractifs que LRD)
1. Ecobank Liberia (USD) 10–16% | LBDI 10–18% | International Bank Liberia 12–18%

━━ GAMBIE (GM) — GMD (Dalasi) ━━
Régulateur: Central Bank of Gambia | Taux directeur: ~17%
1. Trust Bank Gambia 14–22% | GTBank Gambia 13–20%

━━ CAP-VERT (CV) — CVE (Escudo, ancrage EUR ~110 CVE/EUR) ━━
Régulateur: BCV (Banco de Cabo Verde)
Fourchette prêts: 7–14% (parmi les plus bas — ancrage EUR similaire BCEAO)
1. Banco Comercial do Atlântico (BCA) — 8–14%
2. Caixa Económica de Cabo Verde — 7–13%
Contexte: Économie touristique stable, risque souverain faible.

SYNTHÈSE RÉGIONALE — CLASSEMENT TAUX (plus bas → plus élevé):
1. Cap-Vert (CVE/EUR ancré): 7–14%
2. Zone BCEAO prime (SN, CI): 8–14%
3. Zone BCEAO standard (BF, TG, BJ): 9–16%
4. Zone BCEAO risque élevé (ML, NE): 12–22%
5. Guinée (GNF): 17–28%
6. Mauritanie (MRU): 12–20%
7. Sierra Leone (SLE): 22–30%
8. Ghana (GHS — contexte inflationniste): 28–42%
9. Nigeria (NGN — MPR élevé): 22–35%
`;

export const WEST_AFRICAN_COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", port: "Abidjan", flag: "🇨🇮", tier: "primary",   weight: 0.22 },
  { code: "NG", name: "Nigeria",        port: "Lagos / Apapa", flag: "🇳🇬", tier: "primary",   weight: 0.28 },
  { code: "GH", name: "Ghana",          port: "Tema", flag: "🇬🇭", tier: "primary",   weight: 0.15 },
  { code: "SN", name: "Senegal",        port: "Dakar", flag: "🇸🇳", tier: "primary",   weight: 0.10 },
  { code: "BF", name: "Burkina Faso",   port: "Landlocked / Abidjan corridor", flag: "🇧🇫", tier: "secondary", weight: 0.04 },
  { code: "ML", name: "Mali",           port: "Landlocked / Dakar corridor", flag: "🇲🇱", tier: "secondary", weight: 0.04 },
  { code: "GN", name: "Guinea",         port: "Conakry", flag: "🇬🇳", tier: "secondary", weight: 0.04 },
  { code: "BJ", name: "Benin",          port: "Cotonou", flag: "🇧🇯", tier: "secondary", weight: 0.03 },
  { code: "TG", name: "Togo",           port: "Lomé", flag: "🇹🇬", tier: "secondary", weight: 0.03 },
  { code: "NE", name: "Niger",          port: "Landlocked / Cotonou corridor", flag: "🇳🇪", tier: "tertiary", weight: 0.01 },
  { code: "MR", name: "Mauritania",     port: "Nouakchott", flag: "🇲🇷", tier: "tertiary", weight: 0.01 },
  { code: "GW", name: "Guinea-Bissau",  port: "Bissau", flag: "🇬🇼", tier: "tertiary", weight: 0.01 },
  { code: "SL", name: "Sierra Leone",   port: "Freetown", flag: "🇸🇱", tier: "tertiary", weight: 0.01 },
  { code: "LR", name: "Liberia",        port: "Monrovia", flag: "🇱🇷", tier: "tertiary", weight: 0.01 },
  { code: "GM", name: "Gambia",         port: "Banjul", flag: "🇬🇲", tier: "tertiary", weight: 0.01 },
  { code: "CV", name: "Cape Verde",     port: "Praia / Mindelo", flag: "🇨🇻", tier: "tertiary", weight: 0.01 },
];

// ── Données commerciales & fiches pays (M$ USD, 2023 — mise à jour : fév. 2026) ─
export const COUNTRY_TRADE_DATA = {
  CI: {
    president: "Alassane Dramane Ouattara", presidentSince: "2011 (réélu 2025)",
    capitale: "Yamoussoukro", siegeEconomique: "Abidjan",
    superficie: 322462,
    matieres_premieres: ["Cacao (1er mondial)", "Caoutchouc naturel", "Noix de cajou", "Or", "Pétrole brut", "Gaz naturel", "Huile de palme", "Bois tropical", "Diamants"],
    exports: [
      { cat: "Cacao & Chocolat", val: 3800 }, { cat: "Pétrole brut", val: 1200 },
      { cat: "Caoutchouc naturel", val: 890 }, { cat: "Noix de cajou", val: 760 },
      { cat: "Huile de palme", val: 540 },     { cat: "Bois & dérivés", val: 320 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 1600 }, { cat: "Prod. pétroliers raffinés", val: 1100 },
      { cat: "Riz & céréales", val: 890 },          { cat: "Véhicules & transport", val: 670 },
      { cat: "Prod. pharmaceutiques", val: 340 },   { cat: "Acier & métaux", val: 290 },
    ],
    totalExports: 7510, totalImports: 4890,
    partners: ["Union Européenne 38%", "Chine 15%", "États-Unis 9%", "Inde 8%"],
    opportunities: ["Transformation locale cacao", "Hub logistique CEDEAO", "Zone franche Abidjan"],
    risks: ["Volatilité prix cacao", "Dépendance marché UE", "Infrastructures routières limitées"],
    gdpGrowth: 6.8, currency: "XOF",
  },
  NG: {
    president: "Bola Ahmed Tinubu", presidentSince: "2023",
    capitale: "Abuja", siegeEconomique: "Lagos",
    superficie: 923768,
    matieres_premieres: ["Pétrole brut (1er africain)", "Gaz naturel", "Étain", "Charbon", "Minerai de fer", "Or", "Calcaire", "Coltan", "Terres rares"],
    exports: [
      { cat: "Pétrole brut", val: 35000 },       { cat: "Gaz naturel liquéfié", val: 8000 },
      { cat: "Cacao brut", val: 1500 },           { cat: "Sésame & oléagineux", val: 620 },
      { cat: "Caoutchouc naturel", val: 580 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 6200 }, { cat: "Prod. pétroliers raffinés", val: 5100 },
      { cat: "Véhicules", val: 3200 },              { cat: "Riz importé", val: 2100 },
      { cat: "Prod. pharmaceutiques", val: 1500 },
    ],
    totalExports: 46000, totalImports: 18000,
    partners: ["Inde 25%", "Espagne 9%", "Chine 8%", "Pays-Bas 7%"],
    opportunities: ["Raffinage pétrolier local", "Agriculture mécanisée", "Tech & fintech Lagos"],
    risks: ["Dépendance pétrole >75%", "Instabilité naira", "Conflits Delta du Niger"],
    gdpGrowth: 3.3, currency: "NGN",
  },
  GH: {
    president: "John Dramani Mahama", presidentSince: "janv. 2025 (3e mandat)",
    capitale: "Accra", siegeEconomique: "Accra",
    superficie: 238533,
    matieres_premieres: ["Or (2e africain)", "Pétrole brut", "Gaz naturel", "Bauxite", "Manganèse", "Diamants", "Cacao", "Bois tropical", "Sel"],
    exports: [
      { cat: "Or & métaux précieux", val: 8200 }, { cat: "Pétrole brut", val: 3100 },
      { cat: "Cacao brut", val: 2100 },           { cat: "Bois & dérivés", val: 820 },
      { cat: "Thon & poissons", val: 410 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 3100 }, { cat: "Prod. pétroliers raffinés", val: 2200 },
      { cat: "Véhicules", val: 1100 },              { cat: "Riz & blé", val: 920 },
      { cat: "Plastiques & caoutchouc", val: 580 },
    ],
    totalExports: 14000, totalImports: 11000,
    partners: ["Suisse 25%", "Inde 15%", "Chine 12%", "Union Européenne 18%"],
    opportunities: ["Raffinage or local", "Agro-industrie cacao", "Corridor Tema-Burkina"],
    risks: ["Volatilité cours de l'or", "Dette publique élevée", "Dépréciation cédi"],
    gdpGrowth: 3.8, currency: "GHS",
  },
  SN: {
    president: "Bassirou Diomaye Faye", presidentSince: "avril 2024",
    capitale: "Dakar", siegeEconomique: "Dakar",
    superficie: 196722,
    matieres_premieres: ["Phosphates", "Or", "Poissons & fruits de mer", "Pétrole offshore (Sangomar)", "Gaz naturel (GTA)", "Arachides", "Sel", "Zircon", "Titanite"],
    exports: [
      { cat: "Or & phosphates", val: 2100 },    { cat: "Poissons & prod. marins", val: 520 },
      { cat: "Arachides & huiles", val: 310 },  { cat: "Engrais chimiques", val: 280 },
      { cat: "Pétrole (émergent)", val: 180 },
    ],
    imports: [
      { cat: "Prod. pétroliers raffinés", val: 1500 }, { cat: "Riz & céréales", val: 720 },
      { cat: "Machines & équipements", val: 640 },     { cat: "Véhicules", val: 380 },
      { cat: "Médicaments", val: 260 },
    ],
    totalExports: 3400, totalImports: 4200,
    partners: ["Mali 18%", "Suisse 14%", "Chine 11%", "Inde 10%"],
    opportunities: ["Hydrocarbures offshore (Sangomar)", "Hub financier UEMOA", "Pêche industrielle durable"],
    risks: ["Déficit commercial structurel", "Dépendance réexportations", "Sécheresse sahélienne"],
    gdpGrowth: 8.3, currency: "XOF",
  },
  BF: {
    president: "Ibrahim Traoré (Capitaine)", presidentSince: "sept. 2022 (MPSR II)",
    capitale: "Ouagadougou", siegeEconomique: "Ouagadougou",
    superficie: 274200,
    matieres_premieres: ["Or", "Zinc", "Cuivre", "Manganèse", "Phosphate", "Calcaire", "Coton", "Bauxite", "Charbon", "Nickel"],
    exports: [
      { cat: "Or", val: 2800 },       { cat: "Coton brut", val: 290 },
      { cat: "Noix de cajou", val: 180 }, { cat: "Sésame", val: 120 },
      { cat: "Zinc & minerais", val: 90 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 800 }, { cat: "Machines", val: 620 },
      { cat: "Riz & blé", val: 450 },        { cat: "Électricité importée", val: 200 },
      { cat: "Médicaments", val: 180 },
    ],
    totalExports: 3200, totalImports: 2800,
    partners: ["Suisse 60%", "Côte d'Ivoire 12%", "Inde 8%", "Chine 6%"],
    opportunities: ["Corridor Abidjan-Ouaga", "Transformation coton", "Énergie solaire Sahel"],
    risks: ["Enclavement géographique total", "Instabilité sécuritaire", "Concentration export sur l'or"],
    gdpGrowth: 5.9, currency: "XOF",
  },
  ML: {
    president: "Assimi Goïta (Colonel)", presidentSince: "2021 (mandat renouvelé 2025–2030)",
    capitale: "Bamako", siegeEconomique: "Bamako",
    superficie: 1250000,
    matieres_premieres: ["Or (3e africain)", "Sel", "Coton", "Uranium", "Diamants", "Cuivre", "Minerai de fer", "Bauxite", "Phosphate", "Calcaire"],
    exports: [
      { cat: "Or", val: 2400 },       { cat: "Coton brut", val: 220 },
      { cat: "Sésame", val: 100 },    { cat: "Bétail vif", val: 80 },
      { cat: "Karité", val: 45 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 700 }, { cat: "Machines", val: 580 },
      { cat: "Riz & denrées", val: 420 },    { cat: "Médicaments", val: 160 },
      { cat: "Ciment & matériaux", val: 140 },
    ],
    totalExports: 2800, totalImports: 2600,
    partners: ["Suisse 45%", "Côte d'Ivoire 14%", "Chine 10%", "Sénégal 8%"],
    opportunities: ["Transformation or locale", "Agro-industrie coton", "Élevage bovin export"],
    risks: ["Enclavement total", "Instabilité politique persistante", "Tensions avec CEDEAO"],
    gdpGrowth: 3.1, currency: "XOF",
  },
  GN: {
    president: "Mamady Doumbouya (Colonel)", presidentSince: "janv. 2026 (élu 86,7%)",
    capitale: "Conakry", siegeEconomique: "Conakry",
    superficie: 245857,
    matieres_premieres: ["Bauxite (2e mondial)", "Or", "Diamants", "Minerai de fer (Simandou)", "Aluminium", "Uranium", "Cobalt", "Platine", "Chromite"],
    exports: [
      { cat: "Bauxite", val: 1800 },      { cat: "Or", val: 480 },
      { cat: "Diamants", val: 120 },      { cat: "Fer Simandou (proj.)", val: 80 },
      { cat: "Café & cacao", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 620 }, { cat: "Machines & équipements", val: 580 },
      { cat: "Riz & denrées", val: 480 },    { cat: "Ciment", val: 200 },
      { cat: "Véhicules", val: 180 },
    ],
    totalExports: 2500, totalImports: 2200,
    partners: ["Chine 48%", "Ghana 10%", "Union Européenne 18%", "Inde 9%"],
    opportunities: ["Aluminium Simandou (>20Mrd$)", "Hydro-électricité export", "Agriculture tropicale"],
    risks: ["Hyper-dépendance bauxite-Chine", "Transition politique", "Infrastructures minières insuffisantes"],
    gdpGrowth: 5.6, currency: "GNF",
  },
  BJ: {
    president: "Patrice Talon", presidentSince: "2016 (réélu 2021)",
    capitale: "Porto-Novo", siegeEconomique: "Cotonou",
    superficie: 112622,
    matieres_premieres: ["Coton", "Or", "Huile de palme", "Calcaire", "Marbre", "Phosphate", "Cacao", "Café", "Noix de cajou", "Karité"],
    exports: [
      { cat: "Coton brut", val: 620 }, { cat: "Noix de cajou", val: 280 },
      { cat: "Or", val: 180 },         { cat: "Ananas & fruits", val: 90 },
      { cat: "Sésame", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 680 }, { cat: "Machines", val: 480 },
      { cat: "Riz & blé", val: 360 },        { cat: "Véhicules", val: 240 },
      { cat: "Médicaments", val: 120 },
    ],
    totalExports: 1400, totalImports: 2000,
    partners: ["Inde 28%", "Bangladesh 18%", "Chine 12%", "Ghana 8%"],
    opportunities: ["Port de Cotonou hub régional", "Transit Nigeria-Niger-Mali", "Agro-industrie coton"],
    risks: ["Déficit commercial chronique", "Concurrence port de Lomé", "Dépendance réexport Nigeria"],
    gdpGrowth: 5.7, currency: "XOF",
  },
  TG: {
    president: "Faure Gnassingbé", presidentSince: "2005 (réélu 2020)",
    capitale: "Lomé", siegeEconomique: "Lomé",
    superficie: 56785,
    matieres_premieres: ["Phosphate (4e réserves mondial)", "Calcaire", "Minerai de fer", "Bauxite", "Uranium", "Chromite", "Or", "Diamants", "Rutile"],
    exports: [
      { cat: "Or & ré-exports", val: 580 }, { cat: "Phosphates", val: 340 },
      { cat: "Coton brut", val: 160 },      { cat: "Clinker ciment", val: 80 },
      { cat: "Café & cacao", val: 50 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 720 }, { cat: "Machines", val: 540 },
      { cat: "Riz & céréales", val: 380 },   { cat: "Véhicules", val: 220 },
      { cat: "Acier", val: 180 },
    ],
    totalExports: 1300, totalImports: 2100,
    partners: ["Bénin 14%", "Burkina Faso 12%", "Ghana 10%", "Inde 9%"],
    opportunities: ["Hub port de Lomé (eau profonde)", "Phosphates valeur ajoutée", "Zone franche Lomé"],
    risks: ["Déficit commercial structurel", "Dépendance activité de transit", "Fragilité cours phosphates"],
    gdpGrowth: 5.5, currency: "XOF",
  },
  NE: {
    president: "Abdourahamane Tchiani (Général)", presidentSince: "mars 2025 (mandat 5 ans)",
    capitale: "Niamey", siegeEconomique: "Niamey",
    superficie: 1270000,
    matieres_premieres: ["Uranium (4e mondial)", "Pétrole brut (Agadem)", "Or", "Charbon", "Sel", "Gypse", "Phosphate", "Étain", "Fer"],
    exports: [
      { cat: "Uranium", val: 610 },       { cat: "Or", val: 280 },
      { cat: "Pétrole brut", val: 220 },  { cat: "Oignons & légumes", val: 80 },
      { cat: "Bétail vif", val: 70 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 480 }, { cat: "Machines", val: 380 },
      { cat: "Riz & denrées", val: 340 },    { cat: "Électricité importée", val: 120 },
      { cat: "Médicaments", val: 100 },
    ],
    totalExports: 1100, totalImports: 1500,
    partners: ["France 45%", "Chine 20%", "Nigeria 8%", "Union Européenne 12%"],
    opportunities: ["Uranium (énergie nucléaire mondiale)", "Pipeline pétrole-Cotonou", "Agriculture irriguée Niger"],
    risks: ["Double enclavement géographique", "Instabilité sécuritaire Sahel", "Volatilité cours uranium"],
    gdpGrowth: 7.0, currency: "XOF",
  },
  MR: {
    president: "Mohamed Ould Ghazouani", presidentSince: "2019 (réélu juil. 2024)",
    capitale: "Nouakchott", siegeEconomique: "Nouakchott",
    superficie: 1030700,
    matieres_premieres: ["Minerai de fer (46% exports)", "Or", "Poissons & fruits de mer", "Cuivre", "Gypse", "Phosphate", "Gaz naturel (GTA offshore)", "Sel", "Uranium"],
    exports: [
      { cat: "Minerai de fer", val: 1200 },     { cat: "Or", val: 380 },
      { cat: "Poissons & fruits de mer", val: 310 }, { cat: "Cuivre", val: 80 },
      { cat: "Gaz naturel (émergent)", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 520 }, { cat: "Machines", val: 420 },
      { cat: "Riz & blé", val: 380 },        { cat: "Ciment & matériaux", val: 160 },
      { cat: "Médicaments", val: 120 },
    ],
    totalExports: 1900, totalImports: 1600,
    partners: ["Chine 32%", "Suisse 18%", "Union Européenne 22%", "Japon 8%"],
    opportunities: ["Gaz offshore Grand Tortue Ahmeyim", "Pêche durable certifiée MSC", "Énergie éolienne côtière"],
    risks: ["Désertification avancée", "Concentration export fer-or", "Faible diversification industrielle"],
    gdpGrowth: 5.4, currency: "MRU",
  },
  GW: {
    president: "Transition militaire en cours", presidentSince: "Élections prévues déc. 2026",
    capitale: "Bissau", siegeEconomique: "Bissau",
    superficie: 36125,
    matieres_premieres: ["Noix de cajou (93% exports)", "Poissons & crustacés", "Arachides", "Bois tropical", "Kaolin", "Phosphate", "Bauxite (non exploitée)", "Pétrole (offshore non développé)"],
    exports: [
      { cat: "Noix de cajou", val: 150 }, { cat: "Poissons", val: 22 },
      { cat: "Bois tropical", val: 8 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 90 }, { cat: "Riz & denrées", val: 80 },
      { cat: "Machines", val: 60 },         { cat: "Médicaments", val: 30 },
    ],
    totalExports: 180, totalImports: 280,
    partners: ["Inde 80%", "Chine 8%", "Sénégal 5%", "Portugal 3%"],
    opportunities: ["Diversification du cajou (transformation locale)", "Pêche industrielle certifiée", "Tourisme balnéaire"],
    risks: ["Mono-dépendance noix de cajou (>80%)", "Instabilité politique chronique", "Absence d'infrastructures"],
    gdpGrowth: 4.2, currency: "XOF",
  },
  SL: {
    president: "Julius Maada Bio", presidentSince: "2018 (réélu 2023)",
    capitale: "Freetown", siegeEconomique: "Freetown",
    superficie: 71740,
    matieres_premieres: ["Diamants", "Rutile (1er mondial naturel)", "Bauxite", "Minerai de fer", "Or", "Tantale", "Coltan", "Chromite", "Platine", "Ilménite"],
    exports: [
      { cat: "Rutile & ilménite", val: 460 }, { cat: "Or", val: 240 },
      { cat: "Diamants", val: 130 },          { cat: "Cacao", val: 50 },
      { cat: "Café", val: 20 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 400 }, { cat: "Riz & céréales", val: 280 },
      { cat: "Machines", val: 240 },         { cat: "Médicaments", val: 130 },
      { cat: "Ciment", val: 80 },
    ],
    totalExports: 900, totalImports: 1200,
    partners: ["Chine 28%", "Belgique 18%", "Inde 12%", "Union Européenne 15%"],
    opportunities: ["Minéraux stratégiques VE (rutile)", "Port de Freetown modernisé", "Cacao premium niche"],
    risks: ["Déficit commercial persistant", "Dépendance aide internationale", "Fragilité institutionnelle"],
    gdpGrowth: 4.8, currency: "SLL",
  },
  LR: {
    president: "Joseph Nyuma Boakai", presidentSince: "janv. 2024",
    capitale: "Monrovia", siegeEconomique: "Monrovia",
    superficie: 99067,
    matieres_premieres: ["Caoutchouc naturel (Firestone)", "Minerai de fer", "Or", "Diamants", "Bois tropical", "Bauxite", "Graphite", "Kyanite", "Tantale"],
    exports: [
      { cat: "Caoutchouc naturel", val: 320 }, { cat: "Minerai de fer", val: 240 },
      { cat: "Or", val: 80 },                  { cat: "Bois tropical", val: 50 },
      { cat: "Cacao", val: 30 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 420 }, { cat: "Riz & céréales", val: 280 },
      { cat: "Machines", val: 220 },         { cat: "Véhicules", val: 120 },
      { cat: "Médicaments", val: 80 },
    ],
    totalExports: 700, totalImports: 1100,
    partners: ["Suisse 22%", "Chine 18%", "Union Européenne 20%", "Inde 12%"],
    opportunities: ["Caoutchouc valeur ajoutée (Firestone)", "Registre maritime (2ème mondial)", "Fer ArcelorMittal"],
    risks: ["Déficit commercial chronique", "Fragilité post-conflit", "Dépendance caoutchouc/fer"],
    gdpGrowth: 4.5, currency: "LRD",
  },
  GM: {
    president: "Adama Barrow", presidentSince: "2017 (réélu 2021)",
    capitale: "Banjul", siegeEconomique: "Banjul",
    superficie: 11295,
    matieres_premieres: ["Arachides (70% exports)", "Poissons & crustacés", "Noix de cajou", "Sésame", "Coton", "Sel", "Argile", "Titanite (offshore potentiel)"],
    exports: [
      { cat: "Arachides & huiles", val: 100 }, { cat: "Poissons", val: 80 },
      { cat: "Noix de cajou", val: 45 },       { cat: "Coton", val: 20 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 150 }, { cat: "Riz & blé", val: 120 },
      { cat: "Machines", val: 80 },          { cat: "Médicaments", val: 50 },
      { cat: "Véhicules", val: 30 },
    ],
    totalExports: 250, totalImports: 430,
    partners: ["Chine 28%", "Inde 22%", "Sénégal 18%", "Union Européenne 12%"],
    opportunities: ["Tourisme (côte Atlantique)", "Pêche durable certifiée", "Hub logistique sous-régional"],
    risks: ["Déficit commercial structurel", "Enclavement dans le Sénégal", "Faible industrialisation"],
    gdpGrowth: 5.0, currency: "GMD",
  },
  CV: {
    president: "José Maria Pereira Neves", presidentSince: "2021",
    capitale: "Praia", siegeEconomique: "Praia",
    superficie: 4033,
    matieres_premieres: ["Poissons & crustacés", "Sel marin", "Pouzzolane (roche volcanique)", "Calcaire", "Kaolin", "Argile", "Basalte", "Gypse"],
    exports: [
      { cat: "Poissons & crustacés", val: 90 }, { cat: "Chaussures & textiles", val: 50 },
      { cat: "Sel marin", val: 20 },             { cat: "Boissons & alcools", val: 15 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 280 },      { cat: "Riz & denrées alimentaires", val: 200 },
      { cat: "Machines & équipements", val: 180 }, { cat: "Véhicules", val: 100 },
      { cat: "Matériaux construction", val: 80 },
    ],
    totalExports: 180, totalImports: 850,
    partners: ["Portugal 45%", "Espagne 18%", "Union Européenne 25%", "Brésil 4%"],
    opportunities: ["Tourisme haut de gamme insulaire", "Énergie renouvelable (solaire/éolien)", "Hub maritime Atlantique"],
    risks: ["Déficit commercial très élevé (>78%)", "Dépendance import alimentaire totale", "Isolement insulaire structurel"],
    gdpGrowth: 4.6, currency: "CVE",
  },
};
// ─────────────────────────────────────────────────────────────────────────────


export const AGENT_CAPABILITIES = [
  "📊 Analyse en temps réel de l'indice composite WASI",
  "🌍 Indice maritime pays pour les 16 nations CEDEAO",
  "🚢 Suivi activité portuaire : Abidjan, Lagos, Tema, Dakar, Lomé+",
  "📈 Intelligence sectorielle : Agriculture, BTP, Commerce, PME",
  "💹 Génération de signaux ETF pour produits financiers liés au WASI",
  "🔗 Corridors commerciaux & flux transfrontaliers multimodaux",
  "🚂 Module Transport v2 : maritime, aérien, ferroviaire, routier",
  "📰 Signaux d'actualité en direct : RSS africain, événements 72h/7j/14j",
  "🏦 Dossier crédit bancaire : notation COBOL, advisory prêts",
  "🛢️ Prix matières premières temps réel : cacao, pétrole, or, coton (WB Pink Sheet)",
  "📉 Indicateurs macro FMI : PIB, dette/PIB, inflation, compte courant (WEO)",
  "⚡ Accès API institutionnel — données en temps réel, sans abonnement",
];

export const SUGGESTED_QUERIES = [
  "Quel est l'indice composite WASI actuel et quel pays tire la croissance ?",
  "Comment le prix du cacao affecte-t-il les indices de CI et Ghana actuellement ?",
  "Comparer la dette publique/PIB et l'inflation du Nigeria vs Côte d'Ivoire selon le FMI",
  "Quel est le signal ETF WASI basé sur la dynamique commerciale régionale actuelle ?",
  "Quels pays enclavés dépendent le plus de l'accès au port d'Abidjan ?",
  "Analysez les indicateurs de stress commercial dans la zone UEMOA",
  "Quel impact le projet Simandou en Guinée aura-t-il sur les prix du minerai de fer ?",
  "Quels secteurs cibler pour un investisseur étranger au Ghana selon les flux commerciaux ?",
];
