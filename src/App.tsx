/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Search, 
  FileText, 
  CheckCircle2, 
  Edit3, 
  PlusCircle, 
  Info,
  Clock,
  Database,
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
  Moon,
  Sun,
  ArrowLeft,
  Calendar,
  LayoutDashboard,
  BarChart3,
  Lock
} from 'lucide-react';
import { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  LabelList
} from 'recharts';

// ============================================================
// CONFIGURATION GOOGLE SHEETS
// ============================================================
const SHEET_ID = '1qMgsmIERDsUTfiYhyaDr3YPuXN7eJV0tlwHK1WhTIYI';
const URL_FLOTTE = () => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Feuille 1&t=${Date.now()}`;
const URL_HISTORY = () => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Historique&t=${Date.now()}`;

// Apps Script URL pour l'écriture — remplace par ton URL après déploiement Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydTwPMBn-AuykxZl7fY2w1v-62bMwvonZobY3bMnbyVux2IU-DIKmKLNPU86kz9gYw/exec';
// ============================================================

interface SheetData {
  designation: string;
  numEngin: string;
  zone: string;
  etat: string;
  observation: string;
  statusType: 'active' | 'warning' | 'error';
  rowIndex?: number;
}

interface HistoryItem {
  timestamp: string;
  designation: string;
  numEngin: string;
  zone: string;
  etat: string;
  observation: string;
}

// Parse la réponse gviz/tq de Google Sheets
const parseGviz = (text: string): string[][] => {
  try {
    const json = JSON.parse(text.substring(47, text.length - 2));
    return (json.table.rows || []).map((row: any) =>
      (row.c || []).map((cell: any) => {
        if (cell === null || cell === undefined) return '';
        return cell.v !== null && cell.v !== undefined ? cell.v.toString() : '';
      })
    );
  } catch (e) {
    console.error('parseGviz error:', e);
    return [];
  }
};

export default function App() {
  const [data, setData] = useState<SheetData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'flotte' | 'historique' | 'dashboard' | 'stats'>('flotte');
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [selectedHistoryNum, setSelectedHistoryNum] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [userRole, setUserRole] = useState<'admin' | 'viewer'>('viewer');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const suggestions = useMemo(() => {
    const unique = new Set(data.map(item => item.designation.toUpperCase()));
    return Array.from(unique).sort();
  }, [data]);

  const handleRoleSwitch = (role: 'admin' | 'viewer') => {
    if (role === 'viewer') {
      setUserRole('viewer');
      setEditingRow(null);
    } else {
      setShowPasswordModal(true);
      setPasswordError(false);
      setPasswordInput('');
    }
  };

  const verifyPassword = () => {
    if (passwordInput === 'IRATIB') {
      setUserRole('admin');
      setShowPasswordModal(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const [form, setForm] = useState({
    designation: '',
    numEngin: '',
    zone: 'PISTE',
    etat: 'OK',
    observation: ''
  });

  const getStatusType = (status: string): 'active' | 'warning' | 'error' => {
    const s = status?.toUpperCase() || '';
    if (s === 'OK' || s.includes('ACTIF')) return 'active';
    if (s === 'HS' || s.includes('ARRÊTÉ')) return 'error';
    return 'warning';
  };

  // ============================================================
  // FETCH FLOTTE depuis Feuil1
  // ============================================================
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(URL_FLOTTE());
      if (!response.ok) throw new Error('Failed to fetch');
      const text = await response.text();
      const rows = parseGviz(text);

      const mappedData: SheetData[] = rows.map((row, idx) => ({
        designation: row[0] || 'Sans nom',
        numEngin:    row[1] || 'N/A',
        zone:        row[2] || 'INCONNU',
        etat:        row[3] || 'INCONNU',
        observation: row[4] || '',
        statusType:  getStatusType(row[3]),
        rowIndex:    idx + 2
      }));

      setData(mappedData);
      setCurrentTime(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      setError("Impossible de se connecter au Google Sheet. Vérifiez votre configuration API ou l'URL publique.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH HISTORIQUE
  // ============================================================
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(URL_HISTORY());
      if (!response.ok) throw new Error('Failed to fetch history');
      const text = await response.text();
      const rows = parseGviz(text);

      const mappedHistory: HistoryItem[] = rows.map((row) => ({
        timestamp:   row[0] || '',
        designation: row[1] || 'Sans nom',
        numEngin:    row[2] || 'N/A',
        zone:        row[3] || 'INCONNU',
        etat:        row[4] || 'INCONNU',
        observation: row[5] || ''
      })).reverse();

      setHistoryData(mappedHistory);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  // ============================================================
  // SUBMIT (écriture via Apps Script)
  // ============================================================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.designation || !form.numEngin) return;
    setSubmitting(true);
    try {
      const values = [form.designation, form.numEngin, form.zone, form.etat, form.observation];
      const isEdit = editingRow !== null && editingRow !== -1;

      // Mise à jour ou ajout dans Feuil1
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'Feuil1',
          values,
          rowIndex: isEdit ? editingRow : null
        })
      });

      // Ajout dans Historique
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'Historique',
          values
        })
      });

      setForm({ designation: '', numEngin: '', zone: 'PISTE', etat: 'OK', observation: '' });
      setEditingRow(null);

      // Attendre 1s que le Sheet se mette à jour avant de re-fetch
      setTimeout(() => {
        fetchData();
        fetchHistory();
      }, 1000);

    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: SheetData) => {
    setForm({
      designation: item.designation,
      numEngin:    item.numEngin,
      zone:        item.zone,
      etat:        item.etat,
      observation: item.observation
    });
    setEditingRow(item.rowIndex || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setForm({ designation: '', numEngin: '', zone: 'PISTE', etat: 'OK', observation: '' });
    setEditingRow(null);
  };

  const filteredData = data.filter(item => 
    item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.numEngin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = data.length;
    const ok = data.filter(i => i.etat === 'OK').length;
    const hs = data.filter(i => i.etat === 'HS').length;
    const maintenance = total - ok - hs;
    const okPercentage = total > 0 ? Math.round((ok / total) * 100) : 0;

    const zoneDetails = data.reduce((acc, item) => {
      if (!acc[item.zone]) acc[item.zone] = { total: 0, ok: 0, hs: 0 };
      acc[item.zone].total += 1;
      if (item.etat === 'OK') acc[item.zone].ok += 1;
      if (item.etat === 'HS') acc[item.zone].hs += 1;
      return acc;
    }, {} as Record<string, { total: number, ok: number, hs: number }>);

    const zoneDetailedData = Object.entries(zoneDetails).map(([name, counts]: [string, {total: number, ok: number, hs: number}]) => ({
      name,
      total: counts.total,
      ok:    counts.ok,
      hs:    counts.hs,
      taux:  counts.total > 0 ? Math.round((counts.ok / counts.total) * 100) : 0
    }));

    const zoneData = zoneDetailedData.map(z => ({ name: z.name, value: z.total }));
    const statusData = [
      { name: 'OPÉRATIONNEL', value: ok, color: '#10b981' },
      { name: 'HORS SERVICE',  value: hs, color: '#f43f5e' }
    ].filter(d => d.value > 0);

    return { total, ok, hs, maintenance, okPercentage, zoneData, statusData, zoneDetailedData };
  }, [data]);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 dark:selection:text-blue-100 transition-colors duration-300">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 shadow-sm z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <img 
            src="/images/logo.png" 
            alt="Suivi de Flotte Engins" 
            className="w-10 h-10 rounded-lg shadow-md shadow-blue-500/20 object-contain bg-white/20 p-1"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Suivi de Flotte Engins</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.15em]">
              Interface Aéroportuaire — Google Sheets Sync
            </p>
          </div>
        </div>
 
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-full">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20'}`} />
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
              {loading ? 'Synchronisation...' : 'Live Data Feed'}
            </span>
          </div>
          
          <div className="flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-6">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => handleRoleSwitch('admin')}
                className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${userRole === 'admin' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
              >
                ADMIN
              </button>
              <button 
                onClick={() => handleRoleSwitch('viewer')}
                className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${userRole === 'viewer' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
              >
                LECTURE
              </button>
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title={isDarkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={fetchData}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title="Rafraîchir les données"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Agent GSE</p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Opérations Piste</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 shadow-inner">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-grow grid grid-cols-1 ${editingRow !== null ? 'lg:grid-cols-12' : ''} gap-6 p-6 overflow-hidden transition-all duration-500`}>
        {/* Left Section: Data Table */}
        <section className={`${editingRow !== null ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-4 min-h-[400px] transition-all duration-500`}>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-grow overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-md">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide whitespace-nowrap">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shrink-0 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <h2 className="font-bold text-sm">Dashboard</h2>
                </button>
                <button 
                  onClick={() => setActiveTab('flotte')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shrink-0 ${activeTab === 'flotte' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <Database className="w-4 h-4" />
                  <h2 className="font-bold text-sm">Flotte Active</h2>
                </button>
                <button 
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shrink-0 ${activeTab === 'stats' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <h2 className="font-bold text-sm">Statistiques</h2>
                </button>
                <button 
                  onClick={() => { setActiveTab('historique'); fetchHistory(); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shrink-0 ${activeTab === 'historique' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <Clock className="w-4 h-4" />
                  <h2 className="font-bold text-sm">Historique</h2>
                </button>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0">
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Chercher..." 
                    className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white dark:bg-slate-800 dark:text-white shadow-sm"
                  />
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                {userRole === 'admin' && activeTab === 'flotte' && (
                  <button 
                    onClick={() => {
                      setForm({ designation: '', numEngin: '', zone: 'PISTE', etat: 'OK', observation: '' });
                      setEditingRow(-1);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-xs font-black shadow-md hover:bg-blue-700 transition-all shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    NOUVEAU
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-auto flex-grow h-0 relative">
              {activeTab === 'flotte' ? (
                <>
                  {loading && data.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-[1px] z-20">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Récupération du parc engins...</p>
                    </div>
                  ) : error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-[1px] z-20">
                      <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 mb-4">
                        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400 mb-1">Flux Interrompu</h3>
                        <p className="text-xs text-rose-600 dark:text-rose-500 max-w-sm">{error}</p>
                      </div>
                      <button 
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Réessayer la connexion
                      </button>
                    </div>
                  ) : data.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/50 dark:bg-slate-900/50 z-20">
                      <Database className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-3" />
                      <p className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Aucune donnée sur les engins</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Utilisez le formulaire latéral pour enregistrer un engin.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 shadow-sm">
                        <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                          <th className="px-6 py-3 font-bold">Désignation</th>
                          <th className="px-6 py-3 font-bold">N° Engin</th>
                          <th className="px-6 py-3 font-bold text-center">Zone</th>
                          <th className="px-6 py-3 font-bold text-center">État</th>
                          <th className="px-6 py-3 font-bold">Observations</th>
                          {userRole === 'admin' && <th className="px-6 py-3 font-bold text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="text-sm text-slate-600 dark:text-slate-400 divide-y divide-slate-50 dark:divide-slate-800/50">
                        {filteredData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group/row">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white">{item.designation}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.numEngin}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold">
                                {item.zone}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`
                                px-3 py-1 rounded text-[10px] font-black tracking-wide inline-flex items-center gap-2
                                ${item.statusType === 'active' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shadow-sm shadow-emerald-100 dark:shadow-none' : ''}
                                ${item.statusType === 'warning' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 shadow-sm shadow-amber-100 dark:shadow-none' : ''}
                                ${item.statusType === 'error' ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 shadow-sm shadow-rose-100 dark:shadow-none' : ''}
                              `}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  item.statusType === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                                  item.statusType === 'warning' ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                }`} />
                                {item.etat}
                              </span>
                            </td>
                            <td className="px-6 py-4 italic text-slate-500 dark:text-slate-500 text-xs truncate max-w-[200px]">
                              {item.observation || '-'}
                            </td>
                            {userRole === 'admin' && (
                              <td className="px-6 py-4 text-center">
                                <button 
                                  onClick={() => handleEdit(item)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-white dark:hover:text-white hover:bg-blue-600 dark:hover:bg-blue-500 border border-transparent hover:border-blue-700 dark:hover:border-blue-400 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter transition-all flex items-center gap-1.5 mx-auto"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Editer
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : activeTab === 'historique' ? (
                <>
                  {loadingHistory ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chargement de l'historique...</p>
                    </div>
                  ) : historyData.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/50 dark:bg-slate-900/50 z-20">
                      <Clock className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-3" />
                      <p className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Historique vide</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Les changements apparaîtront ici.</p>
                    </div>
                  ) : selectedHistoryNum ? (
                    <div className="p-6 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setSelectedHistoryNum(null)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-500"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">
                              {historyData.find(h => h.numEngin === selectedHistoryNum)?.designation}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono mt-1">Historique complet des mouvements pour #{selectedHistoryNum}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedHistoryNum(null)}
                          className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest"
                        >
                          Retour aux cartes
                        </button>
                      </div>
                      <div className="flex-grow overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                            <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                              <th className="px-6 py-4">Date & Heure</th>
                              <th className="px-6 py-4 text-center">État</th>
                              <th className="px-6 py-4 text-center">Zone</th>
                              <th className="px-6 py-4">Observations / Détails techniques</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {historyData
                              .filter(h => h.numEngin === selectedHistoryNum)
                              .map((item, idx) => (
                                <tr key={idx} className="hover:bg-white dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                      <Calendar className="w-3 h-3 opacity-40" />
                                      {item.timestamp}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                      item.etat === 'OK' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' 
                                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                                    }`}>
                                      {item.etat}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">
                                    {item.zone}
                                  </td>
                                  <td className="px-6 py-4 text-xs italic text-slate-500 dark:text-slate-400">
                                    {item.observation || "Aucune observation particulière"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {Object.values(historyData.reduce((acc, item) => {
                        const key = item.numEngin;
                        if (!acc[key]) {
                          acc[key] = {
                            designation: item.designation,
                            numEngin: item.numEngin,
                            zone: item.zone,
                            events: 0,
                            okCount: 0,
                            hsCount: 0,
                            lastUpdate: item.timestamp,
                            currentStatus: item.etat
                          };
                        }
                        const s = acc[key];
                        s.events += 1;
                        if (item.etat === 'OK') s.okCount += 1;
                        if (item.etat === 'HS') s.hsCount += 1;
                        return acc;
                      }, {} as Record<string, any>))
                        .filter((item: any) => 
                          item.designation.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.numEngin.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((s: any, idx) => (
                        <div key={idx} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col transition-transform hover:scale-[1.02]">
                          <div className="p-4 flex items-start justify-between">
                            <div>
                              <h3 className="text-white font-black text-sm uppercase tracking-tight">{s.designation}</h3>
                              <p className="text-slate-500 text-[10px] font-mono mt-0.5">{s.numEngin} • {s.zone}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${s.currentStatus === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                              • {s.currentStatus}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 border-y border-slate-800 bg-slate-950/50">
                            <div className="p-4 text-center border-r border-slate-800">
                              <div className="text-xl font-black text-blue-400 leading-none">{s.events}</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">Événements</div>
                            </div>
                            <div className="p-4 text-center border-r border-slate-800">
                              <div className="text-xl font-black text-emerald-400 leading-none">{s.okCount}</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">Retours OK</div>
                            </div>
                            <div className="p-4 text-center">
                              <div className="text-xl font-black text-rose-400 leading-none">{s.hsCount}</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">Pannes HS</div>
                            </div>
                          </div>
                          <div className="p-4 bg-slate-900/50 space-y-3">
                            <div className="flex items-center gap-2 text-slate-500 text-[9px] font-bold">
                              <Clock className="w-3 h-3" />
                              <span>{s.lastUpdate}</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs font-black p-2 rounded-lg ${s.currentStatus === 'OK' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {s.currentStatus === 'OK' ? (
                                <><CheckCircle2 className="w-4 h-4" /><span>RETOUR OPÉRATIONNEL</span></>
                              ) : (
                                <><AlertCircle className="w-4 h-4" /><span>HORS SERVICE</span></>
                              )}
                            </div>
                            <button 
                              onClick={() => setSelectedHistoryNum(s.numEngin)}
                              className="w-full py-2.5 mt-2 bg-slate-800 dark:bg-slate-950 text-[10px] font-black text-white hover:bg-slate-700 rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-700"
                            >
                              <FileText className="w-3 h-3" />
                              VOIR TOUT L'HISTORIQUE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'dashboard' ? (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto h-full">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl text-white shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-80">
                      <span className="text-xs font-black uppercase tracking-widest">Total Engins</span>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-4xl font-black mb-1">{stats.total}</div>
                      <p className="text-[10px] font-bold opacity-70 italic">Parc total répertorié</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl text-white shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-80">
                      <span className="text-xs font-black uppercase tracking-widest">Opérationnels</span>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-4xl font-black mb-1">{stats.ok}</div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black">{stats.okPercentage}%</span>
                        <p className="text-[10px] font-bold opacity-70 italic">Disponibilité totale</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-2xl text-white shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-80">
                      <span className="text-xs font-black uppercase tracking-widest">Hors Service</span>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-4xl font-black mb-1">{stats.hs}</div>
                      <p className="text-[10px] font-bold opacity-70 italic">Nécessitent intervention</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-black uppercase tracking-widest">Temps Moyen Synchro</span>
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-slate-800 dark:text-white mb-1">0.4s</div>
                      <p className="text-[10px] font-bold text-slate-400 italic font-mono uppercase">API V4 LATENCY</p>
                    </div>
                  </div>
                  <div className="col-span-full mt-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1">Répartition par Zone</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {stats.zoneData.map((zone, i) => (
                        <div key={i} className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">
                            {zone.value}
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase leading-none">{zone.name}</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">Engins affectés</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'stats' ? (
                <div className="p-8 overflow-y-auto h-full space-y-8 bg-slate-50 dark:bg-slate-900/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL ENGINS</div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white uppercase leading-none">{stats.total}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-b-4 border-b-emerald-500">
                      <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">UNITÉS OK</div>
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 uppercase leading-none">{stats.ok}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-b-4 border-b-rose-500">
                      <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">UNITÉS HS</div>
                      <div className="text-3xl font-black text-rose-600 dark:text-rose-400 uppercase leading-none">{stats.hs}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/10 dark:to-slate-800">
                      <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">TAUX DISPO.</div>
                      <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 uppercase leading-none">{stats.okPercentage}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col h-[400px] shadow-sm">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">OK vs HS</h3>
                      <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none" label={({ name, value }) => `${name}: ${value}`}>
                              {stats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col h-[400px] shadow-sm">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Détail par Zone</h3>
                      <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.zoneDetailedData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                            <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                            <Bar dataKey="ok" name="Opérationnel" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25}>
                              <LabelList dataKey="ok" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#059669' }} />
                            </Bar>
                            <Bar dataKey="hs" name="Hors Service" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={25}>
                              <LabelList dataKey="hs" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#e11d48' }} />
                            </Bar>
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Résumé Détaillé par Zone</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-4">Zone</th>
                            <th className="px-6 py-4 text-center">Total</th>
                            <th className="px-6 py-4 text-center">OK</th>
                            <th className="px-6 py-4 text-center">HS</th>
                            <th className="px-6 py-4 text-right">Taux (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {stats.zoneDetailedData.map((zone, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{zone.name}</td>
                              <td className="px-6 py-4 text-center font-mono text-slate-600 dark:text-slate-400">{zone.total}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded text-xs font-bold">{zone.ok}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded text-xs font-bold">{zone.hs}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                                    <div className="h-full bg-indigo-500" style={{ width: `${zone.taux}%` }} />
                                  </div>
                                  <span className="font-black text-slate-800 dark:text-white text-sm">{zone.taux}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Sidebar */}
        {editingRow !== null && (
          <aside className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-1 animate-in slide-in-from-right duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl border-l-4 border-l-blue-600 space-y-6 relative">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {editingRow === -1 ? <PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-500" /> : <Edit3 className="w-5 h-5 text-amber-600 dark:text-amber-500" />}
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                    {editingRow === -1 ? "Rapport d'État Engin" : "Modification Engin"}
                  </h2>
                </div>
                <button onClick={handleCancelEdit} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-rose-500" title="Fermer">
                  <RefreshCw className="w-4 h-4 rotate-45" />
                </button>
              </div>
              
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    Désignation de l'engin
                    <span className="text-rose-500 opacity-50">*</span>
                  </label>
                  <input 
                    type="text" list="designations"
                    value={form.designation}
                    onChange={e => setForm({...form, designation: e.target.value.toUpperCase()})}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white text-sm shadow-inner font-bold" 
                    placeholder="EX: TRACTEUR AVION" 
                  />
                  <datalist id="designations">
                    {suggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      N° Engin <span className="text-rose-500 opacity-50">*</span>
                    </label>
                    <input 
                      type="text" value={form.numEngin}
                      onChange={e => setForm({...form, numEngin: e.target.value})}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none dark:text-white text-sm font-semibold shadow-inner" 
                      placeholder="Ex: 6692" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">État</label>
                    <select 
                      value={form.etat} onChange={e => setForm({...form, etat: e.target.value})}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none appearance-none cursor-pointer dark:text-white text-sm font-medium shadow-inner"
                    >
                      <option value="OK">FONCTIONNEL (OK)</option>
                      <option value="HS">HORS-SERVICE (HS)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Zone d'Affectation</label>
                  <select 
                    value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none appearance-none cursor-pointer dark:text-white text-sm font-medium shadow-inner"
                  >
                    <option value="PISTE">PISTE</option>
                    <option value="GSE">GSE</option>
                    <option value="ANTENNE PISTE">ANTENNE PISTE</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Observations / Défauts</label>
                  <textarea 
                    rows={3} value={form.observation}
                    onChange={e => setForm({...form, observation: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none resize-none dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner" 
                    placeholder="Précisez le problème technique..."
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={submitting || !form.designation || !form.numEngin}
                  className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl text-sm group relative overflow-hidden active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
                    editingRow && editingRow !== -1
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {editingRow && editingRow !== -1 ? <Edit3 className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                      <span>{editingRow && editingRow !== -1 ? "Mettre à jour l'engin" : "Enregistrer dans le Sheet"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden group border border-slate-800 transition-colors">
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-400/20 shadow-inner">
                  <Info className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm font-black uppercase tracking-wider">Note Opérationnelle</span>
              </div>
              <div className="space-y-3 relative z-10">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ce rapport met à jour la flotte en temps réel sur le document partagé. 
                  Toutes les entrées sont historisées pour la maintenance préventive.
                </p>
                <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold">G1</div>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold">S2</div>
                    <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold">E3</div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Système GSE-HUB V3</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Accès Administration</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entrez votre code (IRATIB)</p>
            </div>
            <div className="space-y-4">
              <input 
                type="password" value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                autoFocus placeholder="••••"
                className={`w-full text-center text-2xl tracking-[1em] font-black px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${passwordError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all`}
              />
              {passwordError && (
                <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest">Code incorrect</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-widest"
              >
                Annuler
              </button>
              <button 
                onClick={verifyPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black shadow-md hover:bg-blue-700 transition-all uppercase tracking-widest"
              >
                Valider
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-10 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center px-8 shrink-0 text-[10px] text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-500">
        <div className="flex items-center justify-between w-full font-bold uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Dernière synchro : {currentTime}</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              <span>Flux de données actif</span>
            </div>
            <span className="font-black text-slate-800 dark:text-slate-300">API GOOGLE V4</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
