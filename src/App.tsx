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
  Lock,
  Trash2,
  Users,
  LogOut,
  UserPlus,
  ShieldCheck,
  Sunrise,
  Moon as MoonIcon
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { motion } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
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
const URL_FLOTTE   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Feuil1`;
const URL_HISTORY  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Historique`;

// Apps Script URL pour l'écriture — remplace par ton URL après déploiement Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_q2pVSMWyqu02JsbTVvlO8ceLP4XFMN-P5hVlcxeu7V5st9efTHpDMumw0lsiRMO3/exec';
// ============================================================

interface SheetData {
  designation: string;
  numEngin: string;
  zone: string;
  etat: string;
  observation: string;
  statut: string;
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
  action: string;
  editeur: string;
}

// Formate une valeur date gviz (ex: "Date(2026,4,1,1,7,40)") → "01/05/2026 01:07"
// Gère aussi les chaînes déjà formatées venant de l'Apps Script
const formatDate = (value: string): string => {
  const gviz = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+))?/);
  if (gviz) {
    const d  = String(parseInt(gviz[3])).padStart(2, '0');
    const m  = String(parseInt(gviz[2]) + 1).padStart(2, '0'); // 0-indexé
    const y  = gviz[1];
    const hh = String(parseInt(gviz[4] || '0')).padStart(2, '0');
    const mm = String(parseInt(gviz[5] || '0')).padStart(2, '0');
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }
  // Chaîne Apps Script "dd/MM/yyyy HH:mm:ss" → supprimer les secondes
  return value.replace(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}):\d{2}/, '$1');
};

// Zones par type d'engin
const TRACTEUR_DESIGNATIONS = ['TRACTEUR DE PISTE ELEC', 'TRACTEUR GASOIL'];
const BASE_ZONES = ['PISTE', 'GSE', 'ANTENNE PISTE'];
const TRACTEUR_EXTRA_ZONES = ['T1', 'T2', 'T3', 'LIVRAISON', 'CORRESPONDANCE', 'FRET', 'RAVITAILLEMENT'];
const getZonesForDesignation = (designation: string): string[] =>
  TRACTEUR_DESIGNATIONS.includes(designation.trim().toUpperCase())
    ? [...BASE_ZONES, ...TRACTEUR_EXTRA_ZONES]
    : BASE_ZONES;

// Jauge semi-circulaire SVG — utilisée dans le Dashboard
function GaugeChart({ pct, isDark }: { pct: number; isDark: boolean }) {
  const cx = 60, cy = 56, r = 44, sw = 11;
  const arcLen = Math.PI * r;
  const filled = arcLen * Math.min(Math.max(pct, 0), 1);
  const color = pct >= 0.8 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#f43f5e';
  const track = isDark ? '#0f172a' : '#f1f5f9';
  return (
    <svg viewBox="0 0 120 74" className="w-full" aria-label={`${Math.round(pct * 100)}% opérationnel`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={track} strokeWidth={sw} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={sw + 5} strokeLinecap="round" opacity={0.12}
        strokeDasharray={arcLen} strokeDashoffset={arcLen - filled}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={arcLen} strokeDashoffset={arcLen - filled}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="17" fontWeight="900" fill={color}
        style={{ fontFamily: 'inherit' }}>{Math.round(pct * 100)}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6" fontWeight="700" letterSpacing="1.2"
        fill={isDark ? '#475569' : '#94a3b8'} style={{ fontFamily: 'inherit' }}>OPÉRATIONNEL</text>
      <text x={cx - r + 3} y={cy + 17} textAnchor="start" fontSize="6" fill={isDark ? '#334155' : '#cbd5e1'}>0%</text>
      <text x={cx + r - 3} y={cy + 17} textAnchor="end"   fontSize="6" fill={isDark ? '#334155' : '#cbd5e1'}>100%</text>
    </svg>
  );
}

interface ActiveSession {
  sessionId: string;
  name: string;
  role: 'admin' | 'editor';
  shift: 'Journée' | 'Nuit';
  date: string;
  loginTime: string;
}

// Retourne la date/heure courante au format dd/MM/yyyy HH:mm (stocké dans Historique col A)
const fmtNow = (): string => {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(n.getDate())}/${p(n.getMonth() + 1)}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}`;
};

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

const getCurrentShift = (): 'Journée' | 'Nuit' => {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? 'Journée' : 'Nuit';
};

export default function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const statutOverrides = useRef<Map<number, string>>(new Map());
  const [data, setData] = useState<SheetData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'flotte' | 'historique' | 'dashboard' | 'stats' | 'outofparc'>('dashboard');
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

  const todayISO = new Date().toISOString().split('T')[0];

  // ── Session multi-utilisateurs ───────────────────────────────────────────
  const mySessionIdRef = useRef<string | null>(sessionStorage.getItem('mySessionId'));
  const bcRef = useRef<BroadcastChannel | null>(null);

  const getSessions = (): ActiveSession[] => {
    try { return JSON.parse(localStorage.getItem('activeSessions') || '[]'); } catch { return []; }
  };

  // Initialisé directement depuis localStorage pour éviter le flash vide
  const [mySession, setMySession] = useState<ActiveSession | null>(() => {
    const sid = sessionStorage.getItem('mySessionId');
    if (!sid) return null;
    return getSessions().find(s => s.sessionId === sid) ?? null;
  });
  const [allSessions, setAllSessions] = useState<ActiveSession[]>(() => getSessions());

  const refreshSessions = () => setAllSessions(getSessions());

  const persistSessions = (sessions: ActiveSession[]) => {
    localStorage.setItem('activeSessions', JSON.stringify(sessions));
    setAllSessions([...sessions]);
    // Notifier tous les autres onglets via BroadcastChannel (fiable) ET storage event (fallback)
    bcRef.current?.postMessage({ type: 'sessions_updated' });
  };
  const addSession = (session: ActiveSession) => {
    persistSessions([...getSessions().filter(s => s.sessionId !== session.sessionId), session]);
  };
  const removeSession = (sessionId: string) => {
    persistSessions(getSessions().filter(s => s.sessionId !== sessionId));
  };
  const generateSessionId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  // ── Fin session ──────────────────────────────────────────────────────────

  const [editorUsers, setEditorUsers] = useState<Array<{ id: string; password: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('editorUsers') || '[]'); } catch { return []; }
  });

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState<{ shift: 'Journée' | 'Nuit'; date: string }>({ shift: getCurrentShift(), date: todayISO });

  const [showEditorLoginModal, setShowEditorLoginModal] = useState(false);
  const [editorLoginForm, setEditorLoginForm] = useState<{ id: string; password: string; shift: 'Journée' | 'Nuit'; date: string }>({ id: '', password: '', shift: getCurrentShift(), date: todayISO });
  const [editorLoginError, setEditorLoginError] = useState('');

  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [newEditorForm, setNewEditorForm] = useState({ id: '', password: '', confirmPassword: '' });
  const [newEditorError, setNewEditorError] = useState('');
  const [selectedTypeDetail, setSelectedTypeDetail] = useState<string | null>(null);
  const [dashZoneFilter, setDashZoneFilter] = useState('Toutes');
  const [retireTarget, setRetireTarget] = useState<SheetData | null>(null);
  const [retireObs, setRetireObs] = useState('');
  const [permDeleteTarget, setPermDeleteTarget] = useState<SheetData | null>(null);

  const captureTypeTable = (rows: { name: string; total: number; ok: number; hs: number; taux: number }[]) => {
    if (rows.length === 0) return;
    const sc = 2, pad = 24, rH = 40, thH = 40, titH = 68;
    const cW = [200, 60, 60, 60, 76];
    const W = cW.reduce((a, b) => a + b) + pad * 2;
    const H = titH + thH + rows.length * rH + pad;
    const cvs = document.createElement('canvas');
    cvs.width = W * sc; cvs.height = H * sc;
    const ctx = cvs.getContext('2d')!;
    ctx.scale(sc, sc);
    const dark = isDarkMode;
    ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 0, 3, H);
    ctx.fillStyle = dark ? '#f1f5f9' : '#0f172a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText("Répartition par Type d'Engin", pad, 26);
    ctx.fillStyle = dark ? '#475569' : '#94a3b8';
    ctx.font = '8px system-ui, sans-serif';
    const now = new Date();
    ctx.fillText(`Export ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · Zone: ${dashZoneFilter} · Suivi de Flotte Engins`, pad, 44);
    ctx.fillStyle = dark ? '#1e293b' : '#f1f5f9'; ctx.fillRect(0, 56, W, 1);
    let y = titH;
    ctx.fillStyle = dark ? '#1e293b' : '#f8fafc'; ctx.fillRect(0, y, W, thH);
    let x = pad;
    ["Type d'Engin", 'Total', 'OK', 'HS', 'Dispo.'].forEach((h, i) => {
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8'; ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText(h.toUpperCase(), x + 4, y + thH / 2 + 3); x += cW[i];
    });
    y += thH;
    rows.forEach((row, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? (dark ? '#0f172a' : '#ffffff') : (dark ? '#1e293b' : '#f8fafc');
      ctx.fillRect(0, y, W, rH);
      x = pad;
      const vals = [row.name, `${row.total}`, `${row.ok}`, `${row.hs}`, `${row.taux}%`];
      const clrs = [dark ? '#e2e8f0' : '#1e293b', dark ? '#94a3b8' : '#64748b', '#10b981', row.hs > 0 ? '#f43f5e' : (dark ? '#334155' : '#e2e8f0'), row.taux >= 80 ? '#10b981' : row.taux >= 50 ? '#f59e0b' : '#f43f5e'];
      vals.forEach((v, i) => {
        ctx.fillStyle = clrs[i]; ctx.font = `${i === 0 ? 'bold ' : ''}10px system-ui, sans-serif`;
        const tw = ctx.measureText(v).width;
        ctx.fillText(v, i === 0 ? x + 4 : x + cW[i] / 2 - tw / 2, y + rH / 2 + 4); x += cW[i];
      });
      ctx.fillStyle = dark ? '#1e293b' : '#f1f5f9'; ctx.fillRect(0, y + rH - 1, W, 1);
      y += rH;
    });
    cvs.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `flotte-types-${now.toISOString().split('T')[0]}.png`; a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const formatDisplayDate = (d: string) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

  const suggestions = useMemo(() => {
    const unique = new Set(data.map(item => item.designation.toUpperCase()));
    return Array.from(unique).sort();
  }, [data]);

  const handleRoleSwitch = (role: 'admin' | 'editor' | 'viewer') => {
    if (role === 'viewer') {
      if (mySessionIdRef.current) removeSession(mySessionIdRef.current);
      sessionStorage.removeItem('mySessionId');
      mySessionIdRef.current = null;
      setMySession(null);
      setUserRole('viewer');
      setEditingRow(null);
    } else if (role === 'admin') {
      setShowPasswordModal(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setEditorLoginForm({ id: '', password: '', shift: getCurrentShift(), date: todayISO });
      setEditorLoginError('');
      setShowEditorLoginModal(true);
    }
  };

  const verifyPassword = () => {
    if (passwordInput === 'IRATIB') {
      setShowPasswordModal(false);
      setPasswordInput('');
      setSessionForm({ shift: getCurrentShift(), date: todayISO });
      setShowSessionModal(true);
    } else {
      setPasswordError(true);
    }
  };

  const handleAdminSessionSubmit = () => {
    const sessionId = generateSessionId();
    const session: ActiveSession = {
      sessionId,
      name: 'Administrateur',
      role: 'admin',
      shift: sessionForm.shift,
      date: sessionForm.date,
      loginTime: new Date().toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    if (mySessionIdRef.current) removeSession(mySessionIdRef.current);
    sessionStorage.setItem('mySessionId', sessionId);
    sessionStorage.setItem('mySession', JSON.stringify(session));
    mySessionIdRef.current = sessionId;
    addSession(session);
    setMySession(session);
    setUserRole('admin');
    setShowSessionModal(false);
  };

  const handleEditorLogin = () => {
    const user = editorUsers.find(u => u.id === editorLoginForm.id && u.password === editorLoginForm.password);
    if (user) {
      const sessionId = generateSessionId();
      const session: ActiveSession = {
        sessionId,
        name: editorLoginForm.id,
        role: 'editor',
        shift: editorLoginForm.shift,
        date: editorLoginForm.date,
        loginTime: new Date().toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      };
      if (mySessionIdRef.current) removeSession(mySessionIdRef.current);
      sessionStorage.setItem('mySessionId', sessionId);
      sessionStorage.setItem('mySession', JSON.stringify(session));
      mySessionIdRef.current = sessionId;
      addSession(session);
      setMySession(session);
      setUserRole('admin');
      setShowEditorLoginModal(false);
      setEditorLoginError('');
    } else {
      setEditorLoginError('Identifiant ou mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    if (mySessionIdRef.current) removeSession(mySessionIdRef.current);
    sessionStorage.removeItem('mySessionId');
    sessionStorage.removeItem('mySession');
    mySessionIdRef.current = null;
    setMySession(null);
    setUserRole('viewer');
    setEditingRow(null);
  };

  const handleKickSession = (sessionId: string) => {
    if (!confirm('Forcer la déconnexion de cette session ?')) return;
    removeSession(sessionId);
  };

  const handleAddEditor = () => {
    if (!newEditorForm.id.trim() || !newEditorForm.password.trim()) { setNewEditorError('Tous les champs sont obligatoires'); return; }
    if (newEditorForm.password !== newEditorForm.confirmPassword) { setNewEditorError('Les mots de passe ne correspondent pas'); return; }
    if (editorUsers.find(u => u.id.toLowerCase() === newEditorForm.id.toLowerCase())) { setNewEditorError('Cet identifiant existe déjà'); return; }
    const updated = [...editorUsers, { id: newEditorForm.id, password: newEditorForm.password }];
    setEditorUsers(updated);
    localStorage.setItem('editorUsers', JSON.stringify(updated));
    setNewEditorForm({ id: '', password: '', confirmPassword: '' });
    setNewEditorError('');
  };

  const handleRemoveEditor = (id: string) => {
    if (!confirm(`Supprimer l'éditeur "${id}" ?`)) return;
    const updated = editorUsers.filter(u => u.id !== id);
    setEditorUsers(updated);
    localStorage.setItem('editorUsers', JSON.stringify(updated));
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

  // Restaurer la session + ouvrir le canal inter-onglets
  useEffect(() => {
    // sessionStorage survit aux refreshs et se vide à la fermeture de l'onglet
    const raw = sessionStorage.getItem('mySession');
    if (raw) {
      try {
        const session: ActiveSession = JSON.parse(raw);
        // Re-enregistrer dans activeSessions si elle a disparu (ex: autre onglet a nettoyé)
        const sessions = getSessions();
        if (!sessions.find(s => s.sessionId === session.sessionId)) {
          persistSessions([...sessions, session]);
        }
        mySessionIdRef.current = session.sessionId;
        setMySession(session);
        setUserRole('admin');
      } catch { sessionStorage.removeItem('mySession'); sessionStorage.removeItem('mySessionId'); }
    }
    // BroadcastChannel : canal dédié inter-onglets, plus fiable que storage events
    if ('BroadcastChannel' in window) {
      bcRef.current = new BroadcastChannel('fleet_sessions');
      bcRef.current.onmessage = () => refreshSessions();
    }
    // storage event comme fallback (certains navigateurs bloquent BroadcastChannel)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'activeSessions') refreshSessions();
    };
    window.addEventListener('storage', onStorage);
    // Rafraîchissement périodique toutes les 5 s (filet de sécurité)
    const interval = setInterval(refreshSessions, 5000);

    return () => {
      bcRef.current?.close();
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  // Pas de cleanup sur les événements navigateur : sessionStorage se vide automatiquement
  // à la fermeture de l'onglet sans aucun listener nécessaire.

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
      const response = await fetch(URL_FLOTTE);
      if (!response.ok) throw new Error('Failed to fetch');
      const text = await response.text();
      const rows = parseGviz(text);

      const mappedData: SheetData[] = rows.map((row, idx) => {
        const rowIndex = idx + 2;
        const fetchedStatut = row[5] || 'Actif';
        const statut = statutOverrides.current.get(rowIndex) ?? fetchedStatut;
        return {
          designation: row[0] || 'Sans nom',
          numEngin:    row[1] || 'N/A',
          zone:        row[2] || 'INCONNU',
          etat:        row[3] || 'INCONNU',
          observation: row[4] || '',
          statut,
          statusType:  getStatusType(row[3]),
          rowIndex
        };
      });

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
      const response = await fetch(URL_HISTORY);
      if (!response.ok) throw new Error('Failed to fetch history');
      const text = await response.text();
      const rows = parseGviz(text);

      const mappedHistory: HistoryItem[] = rows.map((row) => ({
        timestamp:   formatDate(row[0] || ''),  // dd/MM/yyyy HH:mm
        designation: row[1] || 'Sans nom',
        numEngin:    row[2] || 'N/A',
        zone:        row[3] || '',
        etat:        row[4] || 'INCONNU',
        observation: row[5] || '',
        action:      row[6] || '',
        editeur:     row[7] || ''
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
    const isEdit = editingRow !== null && editingRow !== -1;

    // Unicité du numéro d'engin
    const duplicate = data.find(d =>
      d.numEngin.trim().toLowerCase() === form.numEngin.trim().toLowerCase() &&
      d.rowIndex !== editingRow
    );
    if (duplicate) {
      alert(`Le numéro d'engin "${form.numEngin}" est déjà utilisé par "${duplicate.designation}". Chaque numéro doit être unique.`);
      return;
    }

    // Observation obligatoire si passage OK → HS en mode édition
    if (isEdit) {
      const original = data.find(d => d.rowIndex === editingRow);
      if (original?.etat === 'OK' && form.etat === 'HS' && !form.observation.trim()) {
        alert('L\'observation est obligatoire pour justifier le passage en Hors Service.');
        return;
      }
    }

    setSubmitting(true);
    const editorId = mySession?.name || (userRole === 'admin' ? 'Admin' : 'Viewer');
    try {
      const values = [form.designation, form.numEngin, form.zone, form.etat, form.observation];

      // Mise à jour ou ajout dans Feuil1
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'Feuille 1',
          values,
          rowIndex: isEdit ? editingRow : null
        })
      });

      // Ajout dans Historique avec action + éditeur
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'Historique',
          values: [fmtNow(), ...values, isEdit ? 'Modification' : 'Ajout', editorId]
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

  const handleDelete = (item: SheetData) => {
    setRetireObs('');
    setRetireTarget(item);
  };

  const confirmRetire = () => {
    if (!retireTarget) return;
    if (!retireObs.trim()) { alert('L\'observation est obligatoire pour justifier le retrait de l\'engin.'); return; }
    const editorId = mySession?.name || (userRole === 'admin' ? 'Admin' : 'Viewer');
    statutOverrides.current.set(retireTarget.rowIndex!, 'Retiré');
    setData(prev => prev.map(d => d.rowIndex === retireTarget.rowIndex ? { ...d, statut: 'Retiré', observation: retireObs.trim() } : d));
    fetch(`${APPS_SCRIPT_URL}?action=retire&sheet=Feuille%201&rowIndex=${retireTarget.rowIndex}&observation=${encodeURIComponent(retireObs.trim())}`, { method: 'GET', mode: 'no-cors' })
      .catch(() => {});
    // Historique du retrait
    fetch(APPS_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet: 'Historique',
        values: [fmtNow(), retireTarget.designation, retireTarget.numEngin, retireTarget.zone, retireTarget.etat, retireObs.trim(), 'Retrait', editorId]
      })
    }).catch(() => {});
    setRetireTarget(null);
    setRetireObs('');
  };

  const handlePermanentDelete = (item: SheetData) => {
    setPermDeleteTarget(item);
  };

  const confirmPermanentDelete = () => {
    if (!permDeleteTarget) return;
    setData(prev => prev.filter(d => d.rowIndex !== permDeleteTarget.rowIndex));
    statutOverrides.current.delete(permDeleteTarget.rowIndex!);
    fetch(`${APPS_SCRIPT_URL}?action=delete&sheet=Feuille%201&rowIndex=${permDeleteTarget.rowIndex}`, { method: 'GET', mode: 'no-cors' })
      .catch(() => {});
    setPermDeleteTarget(null);
  };

  const handleRestore = async (item: SheetData) => {
    const editorId = mySession?.name || (userRole === 'admin' ? 'Admin' : 'Viewer');
    statutOverrides.current.set(item.rowIndex!, 'Actif');
    setData(prev => prev.map(d => d.rowIndex === item.rowIndex ? { ...d, statut: 'Actif' } : d));
    fetch(`${APPS_SCRIPT_URL}?action=restore&sheet=Feuille%201&rowIndex=${item.rowIndex}`, { method: 'GET', mode: 'no-cors' })
      .catch(() => {});
    // Historique de la restauration
    fetch(APPS_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet: 'Historique',
        values: [fmtNow(), item.designation, item.numEngin, item.zone, item.etat, item.observation || '', 'Restauration', editorId]
      })
    }).catch(() => {});
  };

  const activeData = data.filter(item => item.statut !== 'Retiré');
  const retiredData = data.filter(item => item.statut === 'Retiré');

  const filteredData = activeData.filter(item =>
    item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.numEngin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRetired = retiredData.filter(item =>
    item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.numEngin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const active = data.filter(i => i.statut !== 'Retiré');
    const total = active.length;
    const ok = active.filter(i => i.etat === 'OK').length;
    const hs = active.filter(i => i.etat === 'HS').length;
    const maintenance = total - ok - hs;
    const okPercentage = total > 0 ? Math.round((ok / total) * 100) : 0;

    const zoneDetails = active.reduce((acc, item) => {
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

    const typeDetails = active.reduce((acc, item) => {
      const type = item.designation.toUpperCase();
      if (!acc[type]) acc[type] = { total: 0, ok: 0, hs: 0 };
      acc[type].total += 1;
      if (item.etat === 'OK') acc[type].ok += 1;
      if (item.etat === 'HS') acc[type].hs += 1;
      return acc;
    }, {} as Record<string, { total: number, ok: number, hs: number }>);

    const typeDetailedData = Object.entries(typeDetails)
      .map(([name, counts]: [string, { total: number, ok: number, hs: number }]) => ({
        name,
        total: counts.total,
        ok:    counts.ok,
        hs:    counts.hs,
        taux:  counts.total > 0 ? Math.round((counts.ok / counts.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    return { total, ok, hs, maintenance, okPercentage, zoneData, statusData, zoneDetailedData, typeDetailedData };
  }, [data]);

  const dashStats = useMemo(() => {
    const active = data.filter(d => d.statut !== 'Retiré');
    const filtered = dashZoneFilter === 'Toutes' ? active : active.filter(d => d.zone === dashZoneFilter);
    const total = filtered.length;
    const ok = filtered.filter(d => d.etat === 'OK').length;
    const hs = filtered.filter(d => d.etat === 'HS').length;
    const statusData = [
      { name: 'Opérationnel', value: ok, pct: total > 0 ? Math.round(ok / total * 100) : 0, color: '#10b981' },
      { name: 'Hors Service',  value: hs, pct: total > 0 ? Math.round(hs / total * 100) : 0, color: '#f43f5e' }
    ].filter(d => d.value > 0);
    const typeMap = filtered.reduce((acc, d) => {
      const k = d.designation.toUpperCase();
      if (!acc[k]) acc[k] = { total: 0, ok: 0, hs: 0 };
      acc[k].total++; if (d.etat === 'OK') acc[k].ok++; if (d.etat === 'HS') acc[k].hs++;
      return acc;
    }, {} as Record<string, { total: number; ok: number; hs: number }>);
    const typeData = (Object.entries(typeMap) as [string, { total: number; ok: number; hs: number }][])
      .map(([name, c]) => ({ name, total: c.total, ok: c.ok, hs: c.hs, taux: c.total > 0 ? Math.round(c.ok / c.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
    return { total, ok, hs, statusData, typeData };
  }, [data, dashZoneFilter]);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 dark:selection:text-blue-100 transition-colors duration-300 overscroll-none">
      {/* PWA update notification */}
      {needRefresh && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl shadow-blue-900/30 animate-bounce-in">
          <RefreshCw size={15} className="shrink-0" />
          <span>Nouvelle version disponible</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="ml-1 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-3 py-1 rounded-lg text-xs transition-colors"
          >
            Mettre à jour
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-blue-200 hover:text-white ml-1 text-lg leading-none"
            aria-label="Ignorer"
          >
            ×
          </button>
        </div>
      )}
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm z-10 transition-colors duration-300">

        {/* ── Row 1 : logo + primary action icons ── */}
        <div className="flex items-center justify-between px-4 md:px-8 h-14 md:h-16">

          {/* Logo + title */}
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Suivi de Flotte Engins"
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg shadow-md shadow-blue-500/20 object-contain bg-white/20 p-1 shrink-0"
            />
            <div>
              <h1 className="text-sm md:text-lg font-bold text-slate-800 dark:text-white leading-tight">Suivi de Flotte Engins</h1>
              <p className="hidden md:block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.15em]">
                Interface Aéroportuaire — Google Sheets Sync
              </p>
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 md:gap-6">

            {/* Live status — desktop only */}
            <div className="hidden md:flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-full">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20'}`} />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                {loading ? 'Synchronisation...' : 'Live Data Feed'}
              </span>
            </div>

            <div className="flex items-center gap-1 md:gap-3 md:border-l md:border-slate-200 md:dark:border-slate-800 md:pl-6">
              {mySession ? (
                <>
                  {/* Desktop only: shift + date + name */}
                  <div className="hidden md:flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${mySession.shift === 'Journée' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30'}`}>
                      {mySession.shift === 'Journée' ? <Sunrise className="w-2.5 h-2.5 inline mr-0.5" /> : <MoonIcon className="w-2.5 h-2.5 inline mr-0.5" />}
                      {mySession.shift}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{formatDisplayDate(mySession.date)}</span>
                  </div>
                  {/* Desktop only: users management */}
                  {mySession.role === 'admin' && (
                    <button onClick={() => { setNewEditorForm({ id: '', password: '', confirmPassword: '' }); setNewEditorError(''); setShowUserManagementModal(true); }}
                      className="hidden md:flex p-2 text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-all"
                      title="Gérer les utilisateurs">
                      <Users className="w-4 h-4" />
                    </button>
                  )}
                  {/* Always visible */}
                  <button onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title={isDarkMode ? "Mode clair" : "Mode sombre"}>
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button onClick={fetchData}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Rafraîchir">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  {/* Desktop only: name + role text */}
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{mySession.name}</p>
                    <p className={`text-[10px] font-black uppercase tracking-wide ${mySession.role === 'admin' ? 'text-blue-500' : 'text-violet-500'}`}>
                      {mySession.role === 'admin' ? 'Administrateur' : 'Éditeur'}
                    </p>
                  </div>
                  {/* Always visible: avatar */}
                  <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs font-black text-white shadow-inner ${mySession.role === 'admin' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                    {mySession.name[0].toUpperCase()}
                  </div>
                  {/* Always visible: logout */}
                  <button onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                    title="Se déconnecter">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  {/* Desktop only: role switcher (mobile version is in Row 2) */}
                  <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button onClick={() => handleRoleSwitch('admin')}
                      className="px-3 py-1 text-[10px] font-black rounded-md transition-all text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700">
                      ADMIN
                    </button>
                    <button onClick={() => handleRoleSwitch('editor')}
                      className="px-3 py-1 text-[10px] font-black rounded-md transition-all text-slate-400 dark:text-slate-500 hover:text-violet-600 hover:bg-white dark:hover:bg-slate-700">
                      ÉDITEUR
                    </button>
                    <button onClick={() => handleRoleSwitch('viewer')}
                      className="px-3 py-1 text-[10px] font-black rounded-md transition-all bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                      LECTURE
                    </button>
                  </div>
                  {/* Always visible */}
                  <button onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title={isDarkMode ? "Mode clair" : "Mode sombre"}>
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button onClick={fetchData}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Rafraîchir">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  {/* Desktop only: "Non connecté" text */}
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Non connecté</p>
                    <p className="text-[10px] font-medium text-slate-300 dark:text-slate-600">Mode lecture</p>
                  </div>
                  {/* Always visible: anonymous avatar */}
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-inner">
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2 : mobile only ── */}
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 px-3 py-2">
          {mySession ? (
            /* Session info: shift + date + name + admin action */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${mySession.shift === 'Journée' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30'}`}>
                  {mySession.shift === 'Journée' ? <Sunrise className="w-2.5 h-2.5 inline mr-0.5" /> : <MoonIcon className="w-2.5 h-2.5 inline mr-0.5" />}
                  {mySession.shift}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{formatDisplayDate(mySession.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{mySession.name}</span>
                <span className={`text-[9px] font-black uppercase tracking-wide ${mySession.role === 'admin' ? 'text-blue-500' : 'text-violet-500'}`}>
                  {mySession.role === 'admin' ? 'Admin' : 'Éditeur'}
                </span>
                {mySession.role === 'admin' && (
                  <button onClick={() => { setNewEditorForm({ id: '', password: '', confirmPassword: '' }); setNewEditorError(''); setShowUserManagementModal(true); }}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-all"
                    title="Gérer les utilisateurs">
                    <Users className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Role switcher — full width on mobile */
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-full">
              <button onClick={() => handleRoleSwitch('admin')}
                className="flex-1 py-1.5 text-[10px] font-black rounded-md transition-all text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700">
                ADMIN
              </button>
              <button onClick={() => handleRoleSwitch('editor')}
                className="flex-1 py-1.5 text-[10px] font-black rounded-md transition-all text-slate-400 dark:text-slate-500 hover:text-violet-600 hover:bg-white dark:hover:bg-slate-700">
                ÉDITEUR
              </button>
              <button onClick={() => handleRoleSwitch('viewer')}
                className="flex-1 py-1.5 text-[10px] font-black rounded-md transition-all bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                LECTURE
              </button>
            </div>
          )}
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
                <button
                  onClick={() => setActiveTab('outofparc')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shrink-0 ${activeTab === 'outofparc' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <Lock className="w-4 h-4" />
                  <h2 className="font-bold text-sm">Out of Parc</h2>
                  {retiredData.length > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">{retiredData.length}</span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {!['dashboard', 'stats'].includes(activeTab) && <div className="relative flex-grow sm:flex-grow-0">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Chercher..." 
                    className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white dark:bg-slate-800 dark:text-white shadow-sm"
                  />
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>}
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
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-white dark:hover:text-white hover:bg-blue-600 dark:hover:bg-blue-500 border border-transparent hover:border-blue-700 dark:hover:border-blue-400 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter transition-all flex items-center gap-1.5"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    Editer
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item)}
                                    className="text-rose-500 dark:text-rose-400 hover:text-white dark:hover:text-white hover:bg-rose-600 dark:hover:bg-rose-500 border border-transparent hover:border-rose-700 dark:hover:border-rose-400 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter transition-all flex items-center gap-1.5"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Suppr.
                                  </button>
                                </div>
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
                              <th className="px-4 py-4 text-center">Action</th>
                              <th className="px-4 py-4 text-center">État</th>
                              <th className="px-4 py-4 text-center">Zone</th>
                              <th className="px-4 py-4 text-center">Éditeur</th>
                              <th className="px-6 py-4">Observations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {historyData
                              .filter(h => h.numEngin === selectedHistoryNum)
                              .map((item, idx) => {
                                const actionColors: Record<string, string> = {
                                  'Ajout':         'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
                                  'Modification':  'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
                                  'Retrait':       'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
                                  'Restauration':  'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
                                };
                                const actionCls = actionColors[item.action] || 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700';
                                return (
                                <tr key={idx} className="hover:bg-white dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                      <Calendar className="w-3 h-3 opacity-40" />
                                      {item.timestamp}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    {item.action ? (
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${actionCls}`}>{item.action}</span>
                                    ) : <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                      item.etat === 'OK'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                                    }`}>
                                      {item.etat}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center text-[10px] font-bold text-slate-500">
                                    {item.zone}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    {item.editeur ? (
                                      <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30 rounded text-[9px] font-black">{item.editeur}</span>
                                    ) : <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>}
                                  </td>
                                  <td className="px-6 py-4 text-xs italic text-slate-500 dark:text-slate-400">
                                    {item.observation || "Aucune observation particulière"}
                                  </td>
                                </tr>
                                );
                              })}
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
                            lastAction: item.action,
                            lastEditeur: item.editeur,
                            currentStatus: item.etat
                          };
                        }
                        const s = acc[key];
                        s.events += 1;
                        s.lastAction = item.action;
                        s.lastEditeur = item.editeur;
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-slate-500 text-[9px] font-bold">
                                <Clock className="w-3 h-3" />
                                <span>{s.lastUpdate}</span>
                              </div>
                              {s.lastEditeur && (
                                <span className="px-2 py-0.5 bg-violet-900/30 text-violet-400 border border-violet-800/30 rounded text-[9px] font-black flex items-center gap-1">
                                  <Users className="w-2.5 h-2.5" />
                                  {s.lastEditeur}
                                  {s.lastAction && <span className="text-violet-500/70 font-bold"> · {s.lastAction}</span>}
                                </span>
                              )}
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
                <div className="p-8 overflow-y-auto h-full space-y-8">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  </div>

                  {/* Zone section */}
                  {(() => {
                    const FIXED_ZONES = ['PISTE', 'ANTENNE PISTE', 'GSE', 'T1', 'T2', 'LIVRAISON', 'FRET', 'RAVITAILLEMENT', 'CORRESPONDANCE'];
                    const zoneMap = Object.fromEntries(stats.zoneData.map(z => [z.name.toUpperCase(), z.value]));
                    const t3Count = zoneMap['T3'] ?? 0;
                    const displayZones = [
                      ...FIXED_ZONES.map(name => ({ name, value: zoneMap[name.toUpperCase()] ?? 0, fixed: true })),
                      ...(t3Count > 0 ? [{ name: 'T3', value: t3Count, fixed: false }] : []),
                    ];
                    return (
                      <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1">Répartition par Zone</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {displayZones.map((zone) => {
                            const isEmpty = zone.value === 0;
                            return (
                              <div key={zone.name} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border flex items-center gap-3 transition-all ${isEmpty ? 'border-rose-200 dark:border-rose-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${isEmpty ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-indigo-600 text-white'}`}>
                                  {zone.value}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none truncate">{zone.name}</div>
                                  <div className={`text-[11px] font-bold mt-0.5 ${isEmpty ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {isEmpty ? 'Aucun engin' : 'Engins affectés'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Performance par Type d'Engin — Gauge Charts ── */}
                  {stats.typeDetailedData.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1">Performance par Type d'Engin</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {stats.typeDetailedData.map((type, i) => {
                          const pct = type.total > 0 ? type.ok / type.total : 0;
                          const borderCls = pct >= 0.8
                            ? 'border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50'
                            : pct >= 0.5
                            ? 'border-amber-100 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700/50'
                            : 'border-rose-100 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700/50';
                          const textCls = pct >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                          return (
                            <div key={i}
                              onClick={() => setSelectedTypeDetail(type.name)}
                              title={`${type.name} — Cliquer pour le détail`}
                              className={`bg-white dark:bg-slate-800 rounded-2xl border ${borderCls} p-3 cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-lg dark:hover:shadow-slate-900/50 group select-none`}>
                              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide text-center mb-0.5 leading-tight line-clamp-2 min-h-[24px] flex items-center justify-center">
                                {type.name}
                              </p>
                              <GaugeChart pct={pct} isDark={isDarkMode} />
                              <div className="flex items-center justify-center gap-2 mt-1">
                                <div className="text-center">
                                  <div className={`text-sm font-black ${textCls}`}>{type.ok}</div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">OK</div>
                                </div>
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                <div className="text-center">
                                  <div className="text-sm font-black text-slate-700 dark:text-slate-300">{type.total}</div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">Total</div>
                                </div>
                                {type.hs > 0 && (
                                  <>
                                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                    <div className="text-center">
                                      <div className="text-sm font-black text-rose-500">{type.hs}</div>
                                      <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">HS</div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Voir détail →</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sessions Actives — visible Admin uniquement */}
                  {mySession?.role === 'admin' && (
                    <div>
                      <div className="flex items-center justify-between mb-4 pl-1">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sessions Actives</h3>
                        <div className="flex items-center gap-2">
                          <button onClick={refreshSessions} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-all text-slate-400 hover:text-blue-500" title="Rafraîchir">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          {/* Alerte conflit de shift */}
                          {(() => {
                            const journee = allSessions.filter(s => s.role === 'editor' && s.shift === 'Journée');
                            const nuit = allSessions.filter(s => s.role === 'editor' && s.shift === 'Nuit');
                            if (journee.length > 1 || nuit.length > 1) {
                              return (
                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Conflit de shift détecté
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">{allSessions.length}</span>
                        </div>
                      </div>
                      {allSessions.length === 0 ? (
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-200 dark:border-slate-700">
                          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucune session active</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {allSessions.map((session) => {
                            const isMe = session.sessionId === mySessionIdRef.current;
                            const shiftDuplicate = allSessions.filter(s => s.role === 'editor' && s.shift === session.shift && session.role === 'editor').length > 1;
                            return (
                              <div key={session.sessionId} className={`rounded-xl border p-4 flex flex-col gap-3 relative ${isMe ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                {isMe && <span className="absolute top-2 right-2 text-[8px] font-black text-blue-500 uppercase tracking-widest">Vous</span>}
                                {shiftDuplicate && !isMe && (
                                  <span className="absolute top-2 right-2 text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" /> Conflit
                                  </span>
                                )}
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${session.role === 'admin' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                                    {session.name[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-800 dark:text-white">{session.name}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-wide ${session.role === 'admin' ? 'text-blue-500' : 'text-violet-500'}`}>{session.role === 'admin' ? 'Administrateur' : 'Éditeur'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${session.shift === 'Journée' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30'}`}>
                                    {session.shift === 'Journée' ? <Sunrise className="w-2.5 h-2.5 inline mr-0.5" /> : <MoonIcon className="w-2.5 h-2.5 inline mr-0.5" />}{session.shift}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-400">{formatDisplayDate(session.date)}</span>
                                  <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5"><Clock className="w-2 h-2" />{session.loginTime}</span>
                                </div>
                                {!isMe && (
                                  <button onClick={() => handleKickSession(session.sessionId)}
                                    className="w-full py-1.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1">
                                    <LogOut className="w-2.5 h-2.5" /> Déconnecter
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Zone filter bar */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Zone :</span>
                    {(['Toutes', ...stats.zoneData.map(z => z.name)] as string[]).map(zone => (
                      <button key={zone} onClick={() => setDashZoneFilter(zone)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${dashZoneFilter === zone ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 dark:shadow-blue-900/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600'}`}>
                        {zone}
                      </button>
                    ))}
                  </motion.div>

                  {/* Donut + Bar chart row */}
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Improved donut */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">État Global de la Flotte</h3>
                      <div className="flex items-center gap-6 flex-grow">
                        <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
                          <ResponsiveContainer width={160} height={160}>
                            <PieChart>
                              <Pie data={dashStats.statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                                {dashStats.statusData.map((entry, index) => (
                                  <Cell key={`dc-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{dashStats.total}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Engins</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-4 flex-grow">
                          {dashStats.statusData.map((d, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                  <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">{d.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black" style={{ color: d.color }}>{d.value}</span>
                                  <span className="text-[10px] font-bold text-slate-400">({d.pct}%)</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div className="h-full rounded-full" style={{ background: d.color }} initial={{ width: 0 }} animate={{ width: `${d.pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                              </div>
                            </div>
                          ))}
                          {dashStats.statusData.length === 0 && (
                            <p className="text-xs text-slate-400 italic">Aucune donnée</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Horizontal bar chart OK vs HS per type */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">OK vs HS par Type d'Engin</h3>
                      <div className="flex-grow" style={{ minHeight: Math.max(180, dashStats.typeData.length * 46) }}>
                        <ResponsiveContainer width="100%" height={Math.max(180, dashStats.typeData.length * 46)}>
                          <BarChart layout="vertical" data={dashStats.typeData} margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.4} />
                            <XAxis type="number" fontSize={9} axisLine={false} tickLine={false} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={130} fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                            <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number, name: string) => [value, name]} />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar dataKey="ok" name="Opérationnel" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive>
                              <LabelList dataKey="ok" position="right" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#059669' }} formatter={(v: number) => v > 0 ? v : ''} />
                            </Bar>
                            <Bar dataKey="hs" name="Hors Service" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive>
                              <LabelList dataKey="hs" position="right" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#e11d48' }} formatter={(v: number) => v > 0 ? v : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </motion.div>

                  {/* Type table at bottom with capture button */}
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Par Type d'Engin</h3>
                      <button onClick={() => captureTypeTable(dashStats.typeData)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all bg-white dark:bg-slate-800 shadow-sm">
                        📸 Capturer le tableau
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 dark:border-slate-700">
                            <th className="px-5 py-3">Type</th>
                            <th className="px-4 py-3 text-center">Total</th>
                            <th className="px-4 py-3 text-center">OK</th>
                            <th className="px-4 py-3 text-center">HS</th>
                            <th className="px-4 py-3 text-right">Dispo.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {dashStats.typeData.map((type, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-5 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-200 max-w-[180px] truncate" title={type.name}>{type.name}</td>
                              <td className="px-4 py-3 text-center text-[11px] font-mono text-slate-500 dark:text-slate-400">{type.total}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-black">{type.ok}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${type.hs > 0 ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400' : 'text-slate-300 dark:text-slate-600'}`}>{type.hs}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[11px] font-black ${type.taux >= 80 ? 'text-emerald-600 dark:text-emerald-400' : type.taux >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{type.taux}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
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
                            <Pie data={stats.statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                              {stats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} formatter={(value: number, name: string) => [value, name]} />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '8px' }} formatter={(value: string, entry: any) => `${value} : ${entry.payload?.value ?? ''}`} />
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

                  {/* Répartition par Type d'Engin */}
                  <div>
                    <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6">Répartition par Type d'Engin</h3>
                    {stats.typeDetailedData.length === 0 ? (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-slate-700">
                        <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucune donnée disponible</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Grouped horizontal bar chart */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-5">Analyse OK vs HS par Type</h4>
                          <ResponsiveContainer width="100%" height={Math.max(240, stats.typeDetailedData.length * 52)}>
                            <BarChart layout="vertical" data={stats.typeDetailedData} margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                              <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={150} fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number, name: string) => [value, name]} />
                              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                              <Bar dataKey="ok" name="Opérationnel" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14}>
                                <LabelList dataKey="ok" position="right" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#059669' }} formatter={(v: number) => v > 0 ? v : ''} />
                              </Bar>
                              <Bar dataKey="hs" name="Hors Service" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={14}>
                                <LabelList dataKey="hs" position="right" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#e11d48' }} formatter={(v: number) => v > 0 ? v : ''} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Type cards grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {stats.typeDetailedData.map((type, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">{type.name}</span>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                  type.taux >= 80
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                    : type.taux >= 50
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'
                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'
                                }`}>{type.taux}%</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-center shrink-0">
                                  <div className="text-2xl font-black text-slate-800 dark:text-white leading-none">{type.total}</div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Total</div>
                                </div>
                                <div className="flex-grow flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    <div className="flex-grow h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${type.total > 0 ? (type.ok / type.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 w-4 text-right shrink-0">{type.ok}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                    <div className="flex-grow h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${type.total > 0 ? (type.hs / type.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 w-4 text-right shrink-0">{type.hs}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Summary table */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Résumé Détaillé par Type</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-6 py-4">Type d'Engin</th>
                                  <th className="px-6 py-4 text-center">Total</th>
                                  <th className="px-6 py-4 text-center">OK</th>
                                  <th className="px-6 py-4 text-center">HS</th>
                                  <th className="px-6 py-4 text-right">Disponibilité</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.typeDetailedData.map((type, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{type.name}</td>
                                    <td className="px-6 py-4 text-center font-mono text-slate-600 dark:text-slate-400">{type.total}</td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded text-xs font-bold">{type.ok}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${type.hs > 0 ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-600'}`}>{type.hs}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex items-center justify-end gap-3">
                                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                                          <div className={`h-full rounded-full ${type.taux >= 80 ? 'bg-emerald-500' : type.taux >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${type.taux}%` }} />
                                        </div>
                                        <span className={`font-black text-sm ${type.taux >= 80 ? 'text-emerald-600 dark:text-emerald-400' : type.taux >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{type.taux}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'outofparc' ? (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wide">Engins Retirés du Parc</h3>
                        <p className="text-[10px] text-slate-400 font-mono">{retiredData.length} engin{retiredData.length > 1 ? 's' : ''} archivé{retiredData.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">Out of Service</span>
                  </div>

                  {filteredRetired.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Aucun engin retiré</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Les engins retirés de la flotte active apparaîtront ici.</p>
                    </div>
                  ) : (
                    <div className="overflow-auto flex-grow h-0">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="sticky top-0 bg-slate-800 dark:bg-slate-950 z-10">
                          <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-700">
                            <th className="px-6 py-3">Désignation</th>
                            <th className="px-6 py-3">N° Engin</th>
                            <th className="px-6 py-3 text-center">Zone</th>
                            <th className="px-6 py-3 text-center">Dernier État</th>
                            <th className="px-6 py-3">Observations</th>
                            {userRole === 'admin' && <th className="px-6 py-3 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredRetired.map((item, idx) => (
                            <tr key={idx} className="bg-slate-900 hover:bg-slate-800/80 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-300">{item.designation}</div>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{item.numEngin}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-[10px] font-bold border border-slate-700">{item.zone}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded text-[10px] font-black tracking-wide inline-flex items-center gap-1.5 opacity-60
                                  ${item.statusType === 'active' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' : ''}
                                  ${item.statusType === 'warning' ? 'bg-amber-950/30 text-amber-400 border border-amber-900/30' : ''}
                                  ${item.statusType === 'error' ? 'bg-rose-950/30 text-rose-400 border border-rose-900/30' : ''}
                                `}>
                                  {item.etat}
                                </span>
                              </td>
                              <td className="px-6 py-4 italic text-slate-600 text-xs truncate max-w-[180px]">{item.observation || '-'}</td>
                              {userRole === 'admin' && (
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleRestore(item)}
                                      className="text-emerald-400 hover:text-white hover:bg-emerald-600 border border-transparent hover:border-emerald-500 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter transition-all flex items-center gap-1.5"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Restaurer
                                    </button>
                                    <button
                                      onClick={() => handlePermanentDelete(item)}
                                      className="text-rose-500 hover:text-white hover:bg-rose-700 border border-transparent hover:border-rose-600 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter transition-all flex items-center gap-1.5"
                                      title="Supprimer définitivement de la base de données"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Suppr. déf.
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                    onChange={e => {
                      const desig = e.target.value.toUpperCase();
                      const validZones = getZonesForDesignation(desig);
                      const zone = validZones.includes(form.zone) ? form.zone : validZones[0];
                      setForm({...form, designation: desig, zone});
                    }}
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
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Zone d'Affectation
                    {TRACTEUR_DESIGNATIONS.includes(form.designation.trim()) && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[8px] font-black border border-amber-200 dark:border-amber-800/30 normal-case tracking-normal">Tracteur — zones étendues</span>
                    )}
                  </label>
                  <select
                    value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none appearance-none cursor-pointer dark:text-white text-sm font-medium shadow-inner"
                  >
                    {getZonesForDesignation(form.designation).map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
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

      {/* Modal : Détail Type d'Engin */}
      {selectedTypeDetail && (() => {
        const type = stats.typeDetailedData.find(t => t.name === selectedTypeDetail);
        const pct = type && type.total > 0 ? type.ok / type.total : 0;
        const engines = activeData.filter(item => item.designation.toUpperCase() === selectedTypeDetail);
        const textCls = pct >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
        const bgCls = pct >= 0.8 ? 'bg-emerald-50 dark:bg-emerald-900/20' : pct >= 0.5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-rose-50 dark:bg-rose-900/20';
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTypeDetail(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className={`p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ${bgCls}`}>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide">{selectedTypeDetail}</h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                    {type?.total} engins · {type?.ok} opérationnels · {type?.hs} HS
                  </p>
                </div>
                <button onClick={() => setSelectedTypeDetail(null)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all text-lg leading-none">✕</button>
              </div>
              {/* Gauge + KPI */}
              <div className="flex gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-28 shrink-0">
                  <GaugeChart pct={pct} isDark={isDarkMode} />
                </div>
                <div className="flex-grow grid grid-cols-3 gap-2 content-center">
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{type?.total}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Total</div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{type?.ok}</div>
                    <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">OK</div>
                  </div>
                  <div className="text-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{type?.hs}</div>
                    <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase mt-0.5">HS</div>
                  </div>
                </div>
              </div>
              {/* Engine list */}
              <div className="overflow-y-auto max-h-72 p-4 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3">Détail des engins</p>
                {engines.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Aucun engin actif</p>
                ) : engines.map((eng, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${eng.etat === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div>
                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono">{eng.numEngin}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{eng.zone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {eng.observation && (
                        <p className="text-[9px] italic text-slate-400 max-w-[110px] truncate hidden sm:block">{eng.observation}</p>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        eng.etat === 'OK'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                          : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
                      }`}>{eng.etat}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Modal : Confirmation retrait (Out of Parc) */}
      {retireTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base">Retirer du parc actif</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{retireTarget.designation} ({retireTarget.numEngin})</span> sera déplacé vers Out of Parc.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                Motif du retrait <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3} value={retireObs} onChange={e => setRetireObs(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none resize-none dark:text-white text-sm placeholder:text-slate-400 shadow-inner"
                placeholder="Ex: Panne moteur, maintenance programmée, révision générale..."
              />
              {!retireObs.trim() && <p className="text-[10px] text-rose-500 font-bold">Le motif est obligatoire.</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRetireTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Annuler
              </button>
              <button onClick={confirmRetire} disabled={!retireObs.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm shadow-lg shadow-amber-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Confirmer le retrait
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal : Suppression définitive */}
      {permDeleteTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-rose-200 dark:border-rose-900/50 shadow-2xl w-full max-w-md space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-black text-rose-700 dark:text-rose-400 text-base uppercase tracking-wide">Suppression définitive</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  L'engin <span className="font-bold text-slate-700 dark:text-slate-300">{permDeleteTarget.designation} ({permDeleteTarget.numEngin})</span> sera <span className="font-black text-rose-600">supprimé définitivement</span> de la base de données. Cette action est <span className="font-black">irréversible</span>.
                </p>
              </div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30 text-[11px] text-rose-700 dark:text-rose-400 font-bold">
              ⚠ La ligne sera supprimée du Google Sheet. L'historique associé reste conservé.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPermDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Annuler
              </button>
              <button onClick={confirmPermanentDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-black text-sm shadow-lg shadow-rose-700/20 transition-all">
                Supprimer définitivement
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal : Mot de passe Admin */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Accès Administration</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Code sécurisé requis</p>
            </div>
            <div className="space-y-4">
              <input type="password" value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                autoFocus placeholder="••••••"
                className={`w-full text-center text-2xl tracking-[1em] font-black px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${passwordError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all`}
              />
              {passwordError && <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest">Code incorrect</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-widest">Annuler</button>
              <button onClick={verifyPassword} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black shadow-md hover:bg-blue-700 transition-all uppercase tracking-widest">Valider</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal : Session Admin (shift + date) */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Informations de Session</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Administrateur</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                <input type="date" value={sessionForm.date}
                  onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all outline-none"
                />
              </div>
            </div>
            <button onClick={handleAdminSessionSubmit}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-black shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Commencer la session
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal : Connexion Éditeur */}
      {showEditorLoginModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto text-violet-600 dark:text-violet-400 mb-4">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Connexion Éditeur</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saisissez vos identifiants</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identifiant</label>
                <input type="text" value={editorLoginForm.id}
                  onChange={e => setEditorLoginForm(f => ({ ...f, id: e.target.value }))}
                  autoFocus placeholder="Votre identifiant"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mot de passe</label>
                <input type="password" value={editorLoginForm.password}
                  onChange={e => setEditorLoginForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••"
                  onKeyDown={e => e.key === 'Enter' && handleEditorLogin()}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                <input type="date" value={editorLoginForm.date}
                  onChange={e => setEditorLoginForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
              </div>
              {editorLoginError && <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest">{editorLoginError}</p>}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowEditorLoginModal(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-widest">Annuler</button>
              <button onClick={handleEditorLogin} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-black shadow-md hover:bg-violet-700 transition-all uppercase tracking-widest">Connexion</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal : Gestion des utilisateurs (Admin seulement) */}
      {showUserManagementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">Gestion des Éditeurs</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accès réservé à l'Admin</p>
                </div>
              </div>
              <button onClick={() => setShowUserManagementModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400">
                <LogOut className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {/* Existing editors */}
            <div className="p-6 space-y-4 max-h-64 overflow-y-auto">
              {editorUsers.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun éditeur créé</p>
                </div>
              ) : (
                editorUsers.map((u, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-black">{u.id[0].toUpperCase()}</div>
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-white">{u.id}</p>
                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Éditeur</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveEditor(u.id)}
                      className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/20 hover:text-rose-600 text-slate-400 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new editor */}
            <div className="border-t border-slate-100 dark:border-slate-800 p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
              <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" /> Créer un éditeur
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Identifiant" value={newEditorForm.id}
                  onChange={e => setNewEditorForm(f => ({ ...f, id: e.target.value }))}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
                <input type="password" placeholder="Mot de passe" value={newEditorForm.password}
                  onChange={e => setNewEditorForm(f => ({ ...f, password: e.target.value }))}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
                <input type="password" placeholder="Confirmer" value={newEditorForm.confirmPassword}
                  onChange={e => setNewEditorForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddEditor()}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                />
              </div>
              {newEditorError && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{newEditorError}</p>}
              <button onClick={handleAddEditor}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black shadow-md hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                <UserPlus className="w-3.5 h-3.5" />
                Créer l'éditeur
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
