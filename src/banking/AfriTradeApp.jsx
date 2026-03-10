import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bell,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Info,
  Lock,
  Phone,
  PieChart,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Upload,
  User,
  X,
} from "lucide-react";
import { ManagerAuditPanel } from "./ManagerAuditPanel";
import { ManagerApprovalPanel } from "./ManagerApprovalPanel";
import { TellerApprovalPanel } from "./TellerApprovalPanel";

const STORAGE_KEYS = {
  activeTab: "afritrade_active_tab",
  showBalance: "afritrade_show_balance",
};

const DEFAULT_PROFILE = {
  name: "Kouadio Adama",
  email: "k.adama@email.com",
  phone: "+226 70 12 34 56",
  accountNumber: "AFT2024001234",
  branchLocation: "Ouagadougou Centre",
  creditScore: "A+",
  memberSince: "2023",
};

const PORTFOLIO = {
  totalValue: 2485000,
  dayChange: 125000,
  dayChangePercent: 5.3,
  availableCash: 450000,
  portfolioReturn: 18.5,
  weekChange: 8.2,
  monthChange: 12.7,
  yearChange: 25.3,
};

const POSITIONS = [
  { symbol: "SOGC", company: "Societe Generale CI", shares: 50, price: 8500, change: 2.1, value: 425000, type: "BRVM" },
  { symbol: "ETIT", company: "Ecobank Transnational", shares: 100, price: 12000, change: -1.3, value: 1200000, type: "BRVM" },
  { symbol: "AAPL", company: "Apple Inc", shares: 5, price: 95000, change: 1.8, value: 475000, type: "US" },
  { symbol: "BTC", company: "Bitcoin", shares: 0.02, price: 19250000, change: 3.5, value: 385000, type: "CRYPTO" },
];

const WATCHLIST = [
  { symbol: "SLBC", company: "SOLIBRA", price: 65000, change: 0.8, type: "BRVM" },
  { symbol: "CABC", company: "Coris Bank", price: 8200, change: -0.5, type: "BRVM" },
  { symbol: "TSLA", company: "Tesla", price: 125000, change: 2.1, type: "US" },
];

const LOAN_DATA = {
  loanBalance: 850000,
  nextPayment: "15 Oct 2025",
  paymentAmount: 45000,
  loanTerm: 24,
  monthsRemaining: 18,
  availableCredit: 650000,
  interestRate: 8.5,
};

const TXS = [
  { id: 1, type: "buy", symbol: "SOGC", amount: 85000, date: "24 Sep", status: "completed" },
  { id: 2, type: "sell", symbol: "BTC", amount: 192500, date: "24 Sep", status: "completed" },
  { id: 3, type: "deposit", amount: 150000, date: "23 Sep", status: "completed" },
  { id: 4, type: "loan_payment", amount: 45000, date: "23 Sep", status: "completed" },
  { id: 5, type: "transfer", amount: 75000, date: "22 Sep", status: "completed" },
  { id: 6, type: "dividend", symbol: "ETIT", amount: 12000, date: "20 Sep", status: "completed" },
];

const GOALS = [
  { id: 1, name: "Voyage en France", target: 750000, current: 315000, progress: 42 },
  { id: 2, name: "Nouvelle Moto", target: 1200000, current: 312000, progress: 26 },
];

const BASE_NOTIFS = [
  { id: 1, title: "SOGC +2.1%", message: "Votre action performe bien", time: "2h", unread: true },
  { id: 2, title: "Pret a echeance", message: "Paiement dans 5 jours", time: "1j", unread: true },
  { id: 3, title: "Objectif atteint", message: "Epargne voyage 40%", time: "2j", unread: false },
  { id: 4, title: "Dividende recu", message: "ETIT: 12,000 FCFA", time: "3j", unread: false },
];

const formatCFA = (amount) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);

const Modal = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
    <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" type="button">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

export default function AfriTradeApp({
  onOpenWasiTerminal,
  onOpenDex,
  onOpenAfriTax,
  onOpenOhadaCompta,
  onExitAfriTrade,
  initialScreen = "onboarding",
  profileOverride,
  authUser = null,
  onLogout,
  userApprovals = [],
  userApprovalStatus = "PENDING",
  onUserApprovalStatusChange,
  userApprovalsLoading = false,
  userApprovalsError = "",
  onRefreshUserApprovals,
  managerApprovals = [],
  managerApprovalStatus = "PENDING",
  onManagerApprovalStatusChange,
  managerApprovalsLoading = false,
  managerApprovalsError = "",
  managerActionApprovalId = null,
  onRefreshManagerApprovals,
  onApproveManagerApproval,
  onRejectManagerApproval,
  managerAuditEntries = [],
  managerAuditLoading = false,
  managerAuditError = "",
  onRefreshManagerAudit,
}) {
  const [currentScreen, setCurrentScreen] = useState(initialScreen);
  const [onboardingSlide, setOnboardingSlide] = useState(0);
  const [activeTab, setActiveTab] = useState(
    () => window.localStorage.getItem(STORAGE_KEYS.activeTab) || "portfolio"
  );
  const [showAccountBalance, setShowAccountBalance] = useState(() => {
    const raw = window.localStorage.getItem(STORAGE_KEYS.showBalance);
    return raw === null ? true : raw === "1";
  });

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeType, setTradeType] = useState("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [watchSearch, setWatchSearch] = useState("");

  const [calcInvestment, setCalcInvestment] = useState("");
  const [calcRate, setCalcRate] = useState("");
  const [calcYears, setCalcYears] = useState("");

  const [notifications, setNotifications] = useState(BASE_NOTIFS);
  const [toasts, setToasts] = useState([]);

  const userProfile = { ...DEFAULT_PROFILE, ...(profileOverride || {}) };
  const displayName = authUser?.displayName || authUser?.username || userProfile.name;
  const displayFirstName =
    displayName.split(" ").filter(Boolean).at(-1) || displayName;
  const isManager = authUser?.role === "MANAGER";
  const isTeller = authUser?.role === "TELLER";
  const tabs = [
    { id: "portfolio", label: "Portefeuille", icon: PieChart },
    { id: "trade", label: "Marches", icon: BarChart3 },
    { id: "microfinance", label: "Prets", icon: CreditCard },
    { id: "activity", label: "Activite", icon: Clock },
    ...((isManager || isTeller)
      ? [{ id: "approvals", label: isManager ? "Approvals" : "Suivi", icon: Shield }]
      : []),
    ...(isManager ? [{ id: "audit", label: "Audit", icon: FileText }] : []),
    { id: "account", label: "Compte", icon: User },
  ];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activeTab, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.showBalance, showAccountBalance ? "1" : "0");
  }, [showAccountBalance]);

  const notify = (message, tone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };

  const openWasi = () => {
    if (typeof onOpenWasiTerminal === "function") {
      onOpenWasiTerminal();
      return;
    }
    notify("WASI terminal indisponible.", "warn");
  };

  const openDex = () => {
    if (typeof onOpenDex === "function") {
      onOpenDex();
      return;
    }
    window.location.href = "?app=dex";
  };

  const openAfriTax = () => {
    if (typeof onOpenAfriTax === "function") {
      onOpenAfriTax();
      return;
    }
    window.location.href = "?app=afritax";
  };

  const openOhadaCompta = () => {
    if (typeof onOpenOhadaCompta === "function") {
      onOpenOhadaCompta();
      return;
    }
    window.location.href = "?app=compta";
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredWatchlist = useMemo(() => {
    const q = watchSearch.trim().toLowerCase();
    if (!q) return WATCHLIST;
    return WATCHLIST.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
    );
  }, [watchSearch]);

  const tradeStock = selectedStock || POSITIONS[0];
  const tradeQty = Number(tradeAmount || "0");
  const tradeTotal = tradeQty > 0 ? tradeQty * (tradeStock?.price || 0) : 0;

  const futureValue = (() => {
    if (!calcInvestment || !calcRate || !calcYears) return null;
    const p = Number(calcInvestment);
    const r = Number(calcRate) / 100;
    const t = Number(calcYears);
    if (!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(t)) return null;
    return p * Math.pow(1 + r, t);
  })();

  const NotificationsModal = () => (
    <Modal title="Notifications" onClose={() => setShowNotificationsModal(false)}>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))}
          className="w-full p-2 border rounded-lg font-medium"
        >
          Marquer tout comme lu
        </button>
        {notifications.map((n) => (
          <div key={n.id} className={`p-4 rounded-xl border-2 ${n.unread ? "border-green-200 bg-green-50" : "border-gray-100"}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{n.title}</h3>
                <p className="text-sm text-gray-600">{n.message}</p>
              </div>
              <span className="text-xs text-gray-500">{n.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );

  const SettingsModal = () => (
    <Modal title="Parametres" onClose={() => setShowSettingsModal(false)}>
      <div className="space-y-4">
        {[
          { icon: User, label: "Profil", desc: "Modifier vos informations" },
          { icon: Shield, label: "Securite", desc: "PIN, biometrie, 2FA" },
          { icon: Bell, label: "Notifications", desc: "Gerer les alertes" },
          { icon: FileText, label: "Documents", desc: "Releves et rapports" },
          { icon: Phone, label: "Support", desc: "Contacter l'assistance" },
        ].map((item) => (
          <button key={item.label} type="button" className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100">
            <item.icon className="w-5 h-5 text-green-600 mr-4" />
            <div className="text-left flex-1">
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}
        <button
          type="button"
          className="w-full p-4 text-red-600 font-medium rounded-xl border-2 border-red-200 hover:bg-red-50"
          onClick={() => {
            setShowSettingsModal(false);
            setCurrentScreen("login");
            notify("Session fermee.", "ok");
            if (typeof onLogout === "function") {
              onLogout();
            }
            if (typeof onExitAfriTrade === "function") {
              onExitAfriTrade();
            }
          }}
        >
          Se deconnecter
        </button>
      </div>
    </Modal>
  );

  const CalculatorModal = () => (
    <Modal title="Calculateur d'investissement" onClose={() => setShowCalculatorModal(false)}>
      <div className="space-y-3">
        <input
          type="number"
          value={calcInvestment}
          onChange={(e) => setCalcInvestment(e.target.value)}
          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
          placeholder="Montant initial FCFA"
        />
        <input
          type="number"
          value={calcRate}
          onChange={(e) => setCalcRate(e.target.value)}
          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
          placeholder="Taux annuel %"
        />
        <input
          type="number"
          value={calcYears}
          onChange={(e) => setCalcYears(e.target.value)}
          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
          placeholder="Duree (annees)"
        />
        {futureValue ? (
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl">
            <p className="text-sm opacity-80 mb-1">Valeur future estimee</p>
            <p className="text-2xl font-bold">{formatCFA(Math.round(futureValue))}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );

  const TradeModal = () => (
    <Modal
      title={`${tradeType === "buy" ? "Acheter" : "Vendre"} ${tradeStock?.symbol || ""}`}
      onClose={() => {
        setShowTradeModal(false);
        setSelectedStock(null);
      }}
    >
      <div className="space-y-4">
        <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
          <button type="button" onClick={() => setTradeType("buy")} className={`flex-1 py-3 font-bold ${tradeType === "buy" ? "bg-green-600 text-white" : "bg-gray-50"}`}>
            Acheter
          </button>
          <button type="button" onClick={() => setTradeType("sell")} className={`flex-1 py-3 font-bold ${tradeType === "sell" ? "bg-red-600 text-white" : "bg-gray-50"}`}>
            Vendre
          </button>
        </div>
        <input
          type="number"
          value={tradeAmount}
          onChange={(e) => setTradeAmount(e.target.value)}
          className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-xl font-bold text-center"
          placeholder="Quantite"
        />
        <div className="bg-blue-50 p-4 rounded-xl">
          <div className="flex justify-between">
            <span className="text-gray-600">Total estime</span>
            <span className="font-bold text-xl">{formatCFA(tradeTotal)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Frais: 0.5%</p>
        </div>
        <button
          type="button"
          className={`w-full py-4 rounded-xl font-bold text-white ${tradeType === "buy" ? "bg-green-600" : "bg-red-600"}`}
          onClick={() => {
            if (!Number.isFinite(tradeQty) || tradeQty <= 0) {
              notify("Quantite invalide.", "warn");
              return;
            }
            notify(`Ordre ${tradeType === "buy" ? "achat" : "vente"} confirme.`, "ok");
            setShowTradeModal(false);
            setTradeAmount("");
          }}
        >
          Confirmer
        </button>
      </div>
    </Modal>
  );

  const TransferModal = () => (
    <Modal title="Transferer" onClose={() => setShowTransferModal(false)}>
      <div className="space-y-4">
        <input type="text" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none" placeholder="Numero du beneficiaire" />
        <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none" placeholder="Montant FCFA" />
        <div className="bg-yellow-50 p-4 rounded-xl flex items-start"><Info className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" /><p className="text-sm text-yellow-800">Frais de transfert: 1% (min. 500 FCFA)</p></div>
        <button type="button" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold" onClick={() => { notify("Transfert effectue.", "ok"); setShowTransferModal(false); }}>Confirmer le transfert</button>
      </div>
    </Modal>
  );

  const DepositModal = () => (
    <Modal title="Deposer des fonds" onClose={() => setShowDepositModal(false)}>
      <div className="space-y-4">
        <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-xl font-bold text-center" placeholder="Montant FCFA" />
        <button type="button" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold" onClick={() => { notify("Depot initie.", "ok"); setShowDepositModal(false); }}>Deposer</button>
      </div>
    </Modal>
  );

  const LoanModal = () => (
    <Modal title="Demande de pret" onClose={() => setShowLoanModal(false)}>
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4 rounded-xl"><p className="text-sm opacity-80">Credit disponible</p><p className="text-2xl font-bold">{formatCFA(LOAN_DATA.availableCredit)}</p></div>
        <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none" placeholder="Montant souhaite FCFA" />
        <div className="grid grid-cols-3 gap-2">{[6, 12, 24].map((m) => (<button key={m} type="button" className="p-3 border-2 border-gray-200 rounded-xl hover:border-green-500">{m} mois</button>))}</div>
        <button type="button" className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold" onClick={() => { notify("Demande de pret soumise.", "ok"); setShowLoanModal(false); }}>Soumettre la demande</button>
      </div>
    </Modal>
  );

  const KycModal = () => (
    <Modal title="Verification d'identite" onClose={() => setShowKycModal(false)}>
      <div className="space-y-3">
        <input className="w-full p-3 border-2 border-gray-200 rounded-xl" placeholder="Nom complet" />
        <input className="w-full p-3 border-2 border-gray-200 rounded-xl" placeholder="Date de naissance" type="date" />
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center"><Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">Telecharger CNI ou passeport</p></div>
        <button type="button" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold" onClick={() => { notify("KYC soumis.", "ok"); setShowKycModal(false); }}>Terminer</button>
      </div>
    </Modal>
  );

  const PortfolioTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-md"><p className="text-blue-100 text-sm mb-1">Liquidites</p><p className="font-bold text-xl">{formatCFA(PORTFOLIO.availableCash)}</p></div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-xl shadow-md"><p className="text-green-100 text-sm mb-1">Performance</p><p className="font-bold text-xl">+{PORTFOLIO.portfolioReturn}%</p></div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Vos Positions</h2>
        <div className="space-y-3">
          {POSITIONS.map((stock) => (
            <button key={stock.symbol} type="button" onClick={() => { setSelectedStock(stock); setShowTradeModal(true); }} className="w-full text-left bg-gray-50 rounded-xl p-4 hover:shadow-md transition-all">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="flex items-center space-x-2"><h3 className="font-bold">{stock.symbol}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">{stock.type}</span></div>
                  <p className="text-gray-600 text-sm">{stock.company}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCFA(stock.price)}</p>
                  <p className={`text-sm font-medium ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}>{stock.change > 0 ? "+" : ""}{stock.change}%</p>
                </div>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t"><span className="text-gray-600">{stock.shares} units</span><span className="font-medium">{formatCFA(stock.value)}</span></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const TradeTab = () => (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm"><h2 className="font-bold mb-3">Apercu des Marches</h2><div className="grid grid-cols-3 gap-4"><div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-sm text-gray-600 mb-1">BRVM</p><p className="font-bold text-green-600">+2.1%</p></div><div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-sm text-gray-600 mb-1">S&P 500</p><p className="font-bold text-green-600">+0.8%</p></div><div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-sm text-gray-600 mb-1">Bitcoin</p><p className="font-bold text-red-600">-1.2%</p></div></div></div>
      <div className="bg-white p-4 rounded-xl shadow-sm"><div className="relative"><input value={watchSearch} onChange={(e) => setWatchSearch(e.target.value)} type="text" placeholder="Rechercher un titre..." className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none" /><Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" /></div></div>
      <div className="space-y-3">{filteredWatchlist.map((stock) => (<button key={stock.symbol} type="button" onClick={() => { setSelectedStock(stock); setShowTradeModal(true); }} className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"><div className="flex justify-between items-center"><div><div className="flex items-center space-x-2"><h3 className="font-bold">{stock.symbol}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{stock.type}</span></div><p className="text-sm text-gray-600">{stock.company}</p></div><div className="text-right"><p className="font-bold">{formatCFA(stock.price)}</p><p className={`text-sm font-medium ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}>{stock.change > 0 ? "+" : ""}{stock.change}%</p></div></div></button>))}</div>
    </div>
  );

  const MicrofinanceTab = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg"><h2 className="font-bold mb-4 text-lg">Tableau de Bord Financier</h2><div className="grid grid-cols-2 gap-4"><div><p className="text-sm opacity-80">Score Credit</p><p className="text-3xl font-bold">{userProfile.creditScore}</p></div><div><p className="text-sm opacity-80">Credit Disponible</p><p className="text-2xl font-bold">{formatCFA(LOAN_DATA.availableCredit)}</p></div></div><button type="button" onClick={() => setShowLoanModal(true)} className="w-full mt-4 bg-white text-purple-600 py-3 rounded-lg font-bold">Demander un Pret</button></div>
      <div className="bg-white p-4 rounded-xl shadow-sm"><div className="flex justify-between"><span className="text-gray-600">Solde restant</span><span className="font-bold text-red-600">{formatCFA(LOAN_DATA.loanBalance)}</span></div><div className="flex justify-between"><span className="text-gray-600">Prochaine echeance</span><span className="font-medium">{LOAN_DATA.nextPayment}</span></div><div className="w-full bg-gray-200 rounded-full h-2 mt-3"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${((LOAN_DATA.loanTerm - LOAN_DATA.monthsRemaining) / LOAN_DATA.loanTerm) * 100}%` }} /></div></div>
      <div className="bg-white p-4 rounded-xl shadow-sm"><h2 className="font-bold mb-3">Objectifs d'epargne</h2><div className="space-y-3">{GOALS.map((goal) => (<div key={goal.id} className="p-3 bg-gray-50 rounded-lg"><div className="flex justify-between"><span className="font-medium">{goal.name}</span><span className="text-sm font-bold text-green-600">{goal.progress}%</span></div><div className="w-full bg-gray-200 rounded-full h-2 my-2"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${goal.progress}%` }} /></div><div className="flex justify-between text-sm text-gray-600"><span>{formatCFA(goal.current)}</span><span>{formatCFA(goal.target)}</span></div></div>))}</div></div>
    </div>
  );

  const ActivityTab = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-4"><h2 className="font-bold">Transactions Recentes</h2><button type="button" className="flex items-center text-green-600 text-sm font-medium"><Filter className="w-4 h-4 mr-1" /> Filtrer</button></div>
      <div className="space-y-3">{TXS.map((tx) => (<div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium capitalize">{tx.type.replace("_", " ")} {tx.symbol || ""}</p><p className="text-sm text-gray-500">{tx.date}</p></div><div className="text-right"><p className={`font-bold ${tx.type === "sell" || tx.type === "loan_payment" || tx.type === "transfer" ? "text-red-600" : "text-green-600"}`}>{tx.type === "sell" || tx.type === "loan_payment" || tx.type === "transfer" ? "-" : "+"}{formatCFA(tx.amount)}</p></div></div>))}</div>
    </div>
  );

  const AccountTab = () => (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-xl shadow-sm text-center"><div className="w-20 h-20 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl text-white font-bold">{displayName.split(" ").map((n) => n[0]).join("")}</span></div><h2 className="text-xl font-bold">{displayName}</h2><p className="text-gray-600">{authUser?.email || userProfile.email}</p><p className="text-sm text-gray-500 mt-2">Membre depuis {userProfile.memberSince}</p></div>
      <div className="bg-white p-4 rounded-xl shadow-sm space-y-3"><div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Numero de compte</span><span className="font-medium">{userProfile.accountNumber}</span></div><div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Telephone</span><span className="font-medium">{userProfile.phone}</span></div><div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Agence</span><span className="font-medium">{userProfile.branchLocation}</span></div><div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Role</span><span className="font-medium">{authUser?.role || "CLIENT"}</span></div><div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Username</span><span className="font-medium">{authUser?.username || "local_user"}</span></div><button type="button" onClick={() => setShowKycModal(true)} className="w-full p-3 bg-green-50 text-green-700 rounded-lg font-medium">Documents KYC</button></div>
    </div>
  );

  const OnboardingScreen = () => {
    const slides = [
      { title: "Bienvenue sur AfriTrade", description: "Investissez, epargnez et empruntez en toute simplicite", color: "from-green-600 to-green-800" },
      { title: "Investissement simplifie", description: "Accedez a BRVM, actions US et crypto", color: "from-blue-600 to-blue-800" },
      { title: "Microfinance integree", description: "Prets flexibles et epargne intelligente", color: "from-purple-600 to-purple-800" },
      { title: "Transferts multi-pays", description: "Orange Money, MTN Mobile et agences", color: "from-orange-600 to-orange-800" },
    ];
    const current = slides[onboardingSlide];
    return (
      <div className={`min-h-screen bg-gradient-to-b ${current.color} text-white flex flex-col p-6`}>
        <div className="flex-1 flex flex-col justify-center items-center">
          <h1 className="text-3xl font-bold mb-4 text-center">{current.title}</h1>
          <p className="text-center text-white/80 mb-12 px-4 text-lg max-w-md">{current.description}</p>
          <div className="flex space-x-2 mb-12">{slides.map((_, i) => (<button key={i} type="button" onClick={() => setOnboardingSlide(i)} className={`w-3 h-3 rounded-full transition-all ${i === onboardingSlide ? "bg-white w-8" : "bg-white/40"}`} />))}</div>
          <div className="w-full space-y-4 max-w-sm">
            {onboardingSlide === slides.length - 1 ? (<><button type="button" onClick={() => setCurrentScreen("login")} className="w-full bg-white text-green-600 py-4 rounded-xl font-bold shadow-lg">Se connecter</button><button type="button" className="w-full border-2 border-white py-4 rounded-xl font-bold">Creer un compte</button></>) : (<button type="button" onClick={() => setOnboardingSlide((v) => v + 1)} className="w-full bg-white text-green-600 py-4 rounded-xl font-bold shadow-lg">Suivant</button>)}
          </div>
        </div>
      </div>
    );
  };

  const LoginScreen = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 pb-16 rounded-b-3xl">
        <button type="button" onClick={() => setCurrentScreen("onboarding")} className="mb-4"><ArrowLeft className="w-6 h-6 text-white" /></button>
        <h1 className="text-2xl font-bold text-white mb-2">Bon retour</h1>
        <p className="text-green-100">Connectez-vous pour continuer</p>
      </div>
      <div className="p-6 -mt-8"><div className="bg-white rounded-2xl shadow-xl p-6 space-y-4"><div><label className="block text-sm font-medium mb-2 text-gray-700">Numero de telephone</label><div className="relative"><input type="text" placeholder="+226 70 12 34 56" className="w-full p-4 border-2 border-gray-200 rounded-xl pl-12 focus:border-green-500 focus:outline-none" /><Phone className="w-5 h-5 text-gray-400 absolute left-4 top-4" /></div></div><div><label className="block text-sm font-medium mb-2 text-gray-700">Code PIN</label><div className="relative"><input type="password" placeholder="******" maxLength={6} className="w-full p-4 border-2 border-gray-200 rounded-xl pl-12 focus:border-green-500 focus:outline-none" /><Lock className="w-5 h-5 text-gray-400 absolute left-4 top-4" /></div></div><button type="button" onClick={() => setCurrentScreen("main")} className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold shadow-lg">Se connecter</button></div></div>
    </div>
  );

  if (currentScreen === "onboarding") return <OnboardingScreen />;
  if (currentScreen === "login") return <LoginScreen />;

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">AfriTrade</h1>
            <p className="text-green-100 text-sm">Bonjour, {displayFirstName}</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" onClick={() => setShowNotificationsModal(true)} className="p-2 bg-green-500/30 rounded-full hover:bg-green-500/50 relative"><Bell className="w-5 h-5" />{unreadCount > 0 ? <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 rounded-full px-1">{unreadCount}</span> : null}</button>
            <button type="button" onClick={() => setShowCalculatorModal(true)} className="p-2 bg-green-500/30 rounded-full hover:bg-green-500/50"><BarChart3 className="w-5 h-5" /></button>
            <button type="button" onClick={() => setShowSettingsModal(true)} className="p-2 bg-green-500/30 rounded-full hover:bg-green-500/50"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="text-center"><p className="text-green-100 text-sm mb-1">Valeur totale du portefeuille</p><div className="flex items-center justify-center space-x-2"><p className="text-4xl font-bold">{showAccountBalance ? formatCFA(PORTFOLIO.totalValue) : "••••••"}</p><button type="button" onClick={() => setShowAccountBalance((v) => !v)}>{showAccountBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}</button></div><div className={`flex items-center justify-center mt-2 ${PORTFOLIO.dayChange >= 0 ? "text-green-200" : "text-red-200"}`}>{PORTFOLIO.dayChange >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}<span className="font-medium">{formatCFA(PORTFOLIO.dayChange)} ({PORTFOLIO.dayChangePercent > 0 ? "+" : ""}{PORTFOLIO.dayChangePercent}%)</span></div></div>
        {authUser?.role ? <div className="mt-4 flex justify-center"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white">{authUser.role}</span></div> : null}
      </div>

      <div className="p-4 -mt-6">
        {isManager ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            Controle interne actif: les operations a risque eleve doivent etre approuvees par un manager avant execution.
          </div>
        ) : null}
        {isTeller ? (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
            Les operations sensibles que vous initiez sont visibles dans l'onglet Suivi jusqu'a la decision manager.
          </div>
        ) : null}
        <div className="bg-white rounded-xl shadow-md p-4 mb-4">
          <div className="font-bold text-sm text-gray-700 mb-2">WASI Investment Hub</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={openWasi} className="py-2 rounded-lg bg-green-600 text-white font-semibold">Open WASI</button>
            <button type="button" onClick={openDex} className="py-2 rounded-lg bg-amber-500 text-black font-semibold">Open ETF DEX</button>
            <button type="button" onClick={openOhadaCompta} className="py-2 rounded-lg bg-slate-700 text-white font-semibold">Open OHADA-Compta</button>
            <button type="button" onClick={openAfriTax} className="py-2 rounded-lg bg-blue-600 text-white font-semibold">Open AfriTax</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3"><button type="button" onClick={openWasi} className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg flex flex-col items-center space-y-2"><div className="p-3 bg-green-100 rounded-full"><Plus className="w-5 h-5 text-green-600" /></div><span className="font-medium text-sm">Investir</span></button><button type="button" onClick={() => setShowTransferModal(true)} className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg flex flex-col items-center space-y-2"><div className="p-3 bg-blue-100 rounded-full"><Send className="w-5 h-5 text-blue-600" /></div><span className="font-medium text-sm">Transferer</span></button><button type="button" onClick={() => setShowDepositModal(true)} className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg flex flex-col items-center space-y-2"><div className="p-3 bg-purple-100 rounded-full"><Banknote className="w-5 h-5 text-purple-600" /></div><span className="font-medium text-sm">Deposer</span></button></div>
      </div>

      <div className="flex justify-around p-4 bg-white shadow-sm sticky top-0 z-10">{tabs.map((tab) => (<button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center p-2 rounded-lg transition-all ${activeTab === tab.id ? "bg-green-100 text-green-700" : "text-gray-500"}`}><tab.icon className="w-5 h-5 mb-1" /><span className="text-xs font-medium">{tab.label}</span></button>))}</div>

      <div className="p-4">
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "trade" && <TradeTab />}
        {activeTab === "microfinance" && <MicrofinanceTab />}
        {activeTab === "activity" && <ActivityTab />}
        {activeTab === "approvals" && isManager && <ManagerApprovalPanel approvals={managerApprovals} currentStatus={managerApprovalStatus} onStatusChange={onManagerApprovalStatusChange} onRefresh={onRefreshManagerApprovals} onApprove={onApproveManagerApproval} onReject={onRejectManagerApproval} loading={managerApprovalsLoading} actionApprovalId={managerActionApprovalId} error={managerApprovalsError} />}
        {activeTab === "approvals" && isTeller && <TellerApprovalPanel approvals={userApprovals} currentStatus={userApprovalStatus} onStatusChange={onUserApprovalStatusChange} onRefresh={onRefreshUserApprovals} loading={userApprovalsLoading} error={userApprovalsError} />}
        {activeTab === "audit" && isManager && <ManagerAuditPanel entries={managerAuditEntries} onRefresh={onRefreshManagerAudit} loading={managerAuditLoading} error={managerAuditError} />}
        {activeTab === "account" && <AccountTab />}
      </div>

      {showNotificationsModal && <NotificationsModal />}
      {showSettingsModal && <SettingsModal />}
      {showCalculatorModal && <CalculatorModal />}
      {showTradeModal && <TradeModal />}
      {showTransferModal && <TransferModal />}
      {showDepositModal && <DepositModal />}
      {showLoanModal && <LoanModal />}
      {showKycModal && <KycModal />}

      <div className="fixed right-3 top-3 z-[100] grid gap-2">{toasts.map((toast) => (<div key={toast.id} className={`px-3 py-2 rounded-lg text-sm shadow-lg ${toast.tone === "warn" ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"}`}>{toast.message}</div>))}</div>
    </div>
  );
}
