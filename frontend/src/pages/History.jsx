import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon,
  Download,
  ExternalLink,
  MessageSquare,
  X,
  Send,
  Search,
  Users,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

// ── WhatsApp Message Modal ──────────────────────────────────────────────────
function MessageModal({ number, onClose }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const encoded = encodeURIComponent(message.trim());
    const clean = number.replace(/\D/g, '');
    const url = encoded
      ? `https://wa.me/${clean}?text=${encoded}`
      : `https://wa.me/${clean}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSent(true);
    setTimeout(() => { setSent(false); onClose(); }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-md glass-panel-glow rounded-3xl p-6 space-y-5 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-mono">[COMPOSE MESSAGE]</h3>
            <p className="text-xs text-cyber-green font-mono mt-0.5">{number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message input */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
            Message Text (optional — leave blank to open chat)
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows={4}
            autoFocus
            className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-800 dark:text-slate-200 font-mono resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={handleSend}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all
              ${sent
                ? 'bg-cyber-green/20 border border-cyber-green/40 text-cyber-green'
                : 'bg-slate-900 dark:bg-cyber-green hover:bg-slate-800 dark:hover:bg-cyber-green/90 text-white dark:text-slate-900 dark:shadow-glow-green'
              }`}
          >
            {sent ? <><Check className="w-4 h-4" /> OPENING...</> : <><Send className="w-4 h-4" /> OPEN WHATSAPP</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main History Component ──────────────────────────────────────────────────
export default function History() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('numbers'); // 'numbers' | 'jobs'

  // Jobs tab state
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Numbers tab state
  const [allNumbers, setAllNumbers] = useState([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Message modal
  const [activeNumber, setActiveNumber] = useState(null);

  // Copy feedback
  const [copiedNum, setCopiedNum] = useState(null);

  // ── Loaders ──
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await api.get('/jobs');
      setJobs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadAllNumbers = useCallback(async () => {
    setNumbersLoading(true);
    try {
      // Fetch all jobs first
      const jobsRes = await api.get('/jobs');
      const completedJobs = (jobsRes.data || []).filter(j => j.status === 'done' || j.status === 'completed');

      // Fetch valid numbers for each completed job
      const chunks = await Promise.all(
        completedJobs.map(job =>
          api.get(`/numbers/results/${job.id}?status_filter=valid&limit=2000`)
            .then(r => r.data.map(n => ({ ...n, job_id: job.id, provider: job.provider })))
            .catch(() => [])
        )
      );

      // Merge and deduplicate by normalized_number
      const seen = new Set();
      const merged = [];
      for (const chunk of chunks) {
        for (const n of chunk) {
          const key = n.normalized_number || n.original_number;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(n);
          }
        }
      }
      setAllNumbers(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setNumbersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'jobs') loadJobs();
    else loadAllNumbers();
  }, [tab]);

  // ── Helpers ──
  const handleExport = (jobId, fileType) => {
    const url = `/api/v1/export/${fileType}/${jobId}?filter_status=valid`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (num) => {
    navigator.clipboard.writeText(num);
    setCopiedNum(num);
    setTimeout(() => setCopiedNum(null), 1500);
  };

  const filtered = allNumbers.filter(n =>
    (n.normalized_number || n.original_number || '').includes(searchTerm)
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 select-none">

      {/* Message Modal */}
      <AnimatePresence>
        {activeNumber && (
          <MessageModal number={activeNumber} onClose={() => setActiveNumber(null)} />
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl w-fit">
        {[
          { id: 'numbers', label: '// VALID NUMBERS', icon: Users },
          { id: 'jobs', label: '// JOB ARCHIVES', icon: HistoryIcon },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={isActive ? {
                background: 'rgba(0,255,102,0.15)',
                border: '1px solid rgba(0,255,102,0.5)',
                color: '#00FF66',
                textShadow: '0 0 8px rgba(0,255,102,0.4)'
              } : {}}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all duration-200
                ${isActive
                  ? ''
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: ALL VALID NUMBERS ── */}
      {tab === 'numbers' && (
        <div className="glass-panel rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-green" />
                ALL VERIFIED WHATSAPP NUMBERS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {numbersLoading ? 'Loading...' : `${filtered.length} unique valid numbers across all sessions`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search number..."
                  className="pl-9 pr-3 py-2 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-200 font-mono w-44"
                />
              </div>
              <button
                onClick={loadAllNumbers}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 font-mono hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
              >
                REFRESH
              </button>
            </div>
          </div>

          {/* Body */}
          {numbersLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">[AGGREGATING VALID NUMBERS...]</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {searchTerm ? '[NO NUMBERS MATCHING SEARCH]' : '[NO VERIFIED NUMBERS FOUND — RUN A CHECK FIRST]'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => navigate('/checker')}
                  className="mt-3 px-5 py-2.5 rounded-xl bg-cyber-green/20 border border-cyber-green/50 hover:bg-cyber-green/30 text-cyber-green text-xs font-bold font-mono shadow-glow-green transition-all"
                >
                  START WHATSAPP CHECK
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Phone Number</th>
                    <th className="px-5 py-3">Original</th>
                    <th className="px-5 py-3">Gateway</th>
                    <th className="px-5 py-3">Verified At</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-mono">
                  {filtered.map((n, idx) => {
                    const num = n.normalized_number || n.original_number;
                    return (
                      <tr key={n.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.015] transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 text-[10px]">{idx + 1}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-cyber-green text-glow-green">{num}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-[10px]">{n.original_number}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-cyber-cyan/10 dark:bg-cyber-cyan/5 border border-cyber-cyan/20 text-cyber-cyan text-[9px] font-bold uppercase">
                            {(n.provider || 'unknown').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 text-[10px]">
                          {n.checked_at ? new Date(n.checked_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {/* Copy */}
                            <button
                              onClick={() => handleCopy(num)}
                              title="Copy number"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                            >
                              {copiedNum === num
                                ? <Check className="w-3.5 h-3.5 text-cyber-green" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </button>
                            {/* Open WA directly */}
                            <a
                              href={`https://wa.me/${num.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open WhatsApp chat"
                              className="p-1.5 rounded-lg bg-cyber-green/10 border border-cyber-green/20 text-cyber-green hover:bg-cyber-green/20 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {/* Message modal */}
                            <button
                              onClick={() => setActiveNumber(num)}
                              title="Send a message"
                              className="btn-cyber flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]"
                            >
                              <MessageSquare className="w-3 h-3" />
                              MESSAGE
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: JOB ARCHIVES ── */}
      {tab === 'jobs' && (
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-cyber-cyan dark:text-cyber-green" />
                [VERIFICATION JOB ARCHIVES]
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">All bulk checker sessions run by your profile</p>
            </div>
            <button onClick={loadJobs} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
              REFRESH
            </button>
          </div>

          {jobsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">[RETRIEVING JOB ARCHIVES...]</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono">[NO JOB RECORDS FOUND]</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                    <th className="px-5 py-3">Job ID</th>
                    <th className="px-5 py-3">Gateway</th>
                    <th className="px-5 py-3">Numbers</th>
                    <th className="px-5 py-3">Hit Rate</th>
                    <th className="px-5 py-3">Dupes Cut</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-mono">
                  {jobs.map(job => {
                    const hitRate = job.total_numbers > 0
                      ? Math.round((job.valid_count / job.total_numbers) * 100) : 0;
                    return (
                      <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-5 py-4 text-[10px] text-slate-500 dark:text-slate-400">
                          <span
                            className="hover:text-cyber-cyan dark:hover:text-cyber-green cursor-pointer flex items-center gap-1"
                            onClick={() => navigate(`/checker?job_id=${job.id}`)}
                          >
                            {job.id.slice(0, 8)}...
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                          {job.provider?.replace('_', ' ')}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div>Total: <strong className="text-slate-800 dark:text-slate-200">{job.total_numbers}</strong></div>
                            <div className="flex gap-1.5 text-[9px] font-bold">
                              <span className="text-cyber-green">✓ {job.valid_count}</span>
                              <span className="text-slate-400">|</span>
                              <span className="text-cyber-red">✗ {job.invalid_count}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-black text-slate-800 dark:text-slate-200">
                          {(job.status === 'done' || job.status === 'completed') ? `${hitRate}%` : '—'}
                        </td>
                        <td className="px-5 py-4 text-cyber-cyan dark:text-cyber-green font-bold">{job.duplicate_count}</td>
                        <td className="px-5 py-4 text-slate-400 dark:text-slate-500 text-[10px]">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {(job.status === 'done' || job.status === 'completed') ? (
                            <div className="inline-flex gap-2">
                              <button onClick={() => handleExport(job.id, 'xlsx')} className="px-2 py-1 rounded-lg bg-cyber-green/10 border border-cyber-green/20 text-[10px] font-bold text-cyber-green flex items-center gap-1 hover:bg-cyber-green/20 transition-all">
                                <Download className="w-3 h-3" /> Excel
                              </button>
                              <button onClick={() => handleExport(job.id, 'csv')} className="px-2 py-1 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-[10px] font-bold text-cyber-cyan flex items-center gap-1 hover:bg-cyber-cyan/20 transition-all">
                                <Download className="w-3 h-3" /> CSV
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                              ${job.status === 'processing' ? 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan animate-pulse' : ''}
                              ${job.status === 'paused' ? 'bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber' : ''}
                              ${job.status === 'pending' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' : ''}
                              ${job.status === 'failed' ? 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red' : ''}
                            `}>
                              {job.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
