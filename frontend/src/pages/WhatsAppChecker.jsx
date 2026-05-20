import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCheckerStore } from '../store/checkerStore';
import api from '../utils/api';
import CopyButton from '../components/CopyButton';
import { 
  Play, 
  Pause, 
  Upload, 
  FileText, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Download,
  AlertCircle,
  Terminal,
  Search,
  Check
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function WhatsAppChecker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { 
    currentJob, 
    currentResults, 
    logs, 
    isLoading, 
    error, 
    startJob, 
    pauseJob, 
    resumeJob, 
    loadJobDetails, 
    connectWebSocket, 
    clearCurrentJob 
  } = useCheckerStore();

  // Input states
  const [provider, setProvider] = useState('whatsapp_cloud');
  const [telegramNotice, setTelegramNotice] = useState(false);
  const [numbersPaste, setNumbersPaste] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // Table search & pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  
  // UI states
  const [dragActive, setDragActive] = useState(false);
  const [apiKeysWarning, setApiKeysWarning] = useState(false);
  const [copyData, setCopyData] = useState({ valid: '', invalid: '', cleaned: '', logs: '' });
  
  const fileInputRef = useRef(null);
  const logsConsoleEndRef = useRef(null);

  // Auto-load job if ID is passed in URL and fallback to polling if WebSocket is offline
  useEffect(() => {
    const job_id = searchParams.get('job_id');
    let pollInterval = null;
    
    if (job_id) {
      loadJobDetails(job_id);
      connectWebSocket(job_id);
      
      // Serverless fallback: Poll job details periodically to ensure stats update
      // in environments where WebSocket connections are restricted or fail (such as Vercel).
      pollInterval = setInterval(() => {
        if (currentJob && (currentJob.status === 'processing' || currentJob.status === 'pending')) {
          loadJobDetails(job_id);
        }
      }, 2500);
    } else {
      clearCurrentJob();
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [searchParams, currentJob?.status]);

  // Load API key checklist to prevent failures
  useEffect(() => {
    async function checkApiKeys() {
      try {
        const response = await api.get('/api-keys');
        const keys = response.data;
        const exists = keys.some(k => k.provider === provider && k.is_active);
        setApiKeysWarning(!exists);
      } catch (err) {
        setApiKeysWarning(true);
      }
    }
    if (!currentJob) {
      checkApiKeys();
    }
  }, [provider, currentJob]);

  // Auto scroll logs console to bottom
  useEffect(() => {
    if (logsConsoleEndRef.current) {
      logsConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Regenerate copy inputs whenever results or logs update
  useEffect(() => {
    if (currentJob) {
      async function buildCopyStrings() {
        try {
          const res = await api.get(`/jobs/${currentJob.id}/results?limit=100000`);
          const items = Array.isArray(res.data) ? res.data : [];
          
          const valids = items
            .filter(r => r.status === 'valid' || r.status === 'business')
            .map(r => r.phone_number || r.normalized_number || r.original_number || '')
            .join('\n');
          const invalids = items
            .filter(r => r.status === 'invalid')
            .map(r => r.phone_number || r.normalized_number || r.original_number || '')
            .join('\n');
          const cleaned = [
            ...new Set(
              items
                .filter(r => r.status === 'valid' || r.status === 'business')
                .map(r => r.phone_number || r.normalized_number || r.original_number || '')
            )
          ].join('\n');
          
          setCopyData({
            valid: valids,
            invalid: invalids,
            cleaned: cleaned,
            logs: (logs || []).join('\n')
          });
        } catch (e) {
          console.error(e);
        }
      }
      buildCopyStrings();
    }
  }, [currentJob, currentResults, logs]);

  // Handle file drop events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('provider', provider);
    formData.append('telegram_notifications', telegramNotice);
    
    if (uploadedFile) {
      formData.append('numbers_file', uploadedFile);
    }
    if (numbersPaste) {
      formData.append('numbers_paste', numbersPaste);
    }

    try {
      const job = await startJob(formData);
      setSearchParams({ job_id: job.id });
    } catch (err) {
      // Handled by store error
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = (fileType, filterType) => {
    if (!currentJob) return;
    const url = `/api/v1/jobs/${currentJob.id}/export?file_type=${fileType}&filter_status=${filterType}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = (currentResults || []).filter(r => {
    const phone = r.phone_number || r.normalized_number || r.original_number || '';
    const matchesSearch = phone.includes(searchTerm);
    const matchesStatus = statusFilter ? r.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const paginatedResults = filteredResults.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredResults.length / pageSize);

  const pct = currentJob?.total_count > 0 
    ? Math.round((currentJob.processed_count / currentJob.total_count) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1: CONFIGURATION OR PROGRESS STATS */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* API KEY WARNING CARD */}
        {!currentJob && apiKeysWarning && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-cyber-amber/15 border border-cyber-amber/30 text-cyber-amber text-xs flex gap-3 cursor-pointer"
            onClick={() => navigate('/settings')}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold font-mono">[WARNING: MISSING GATEWAY API KEY]</p>
              <p className="leading-relaxed">You haven't configured active credentials for the <strong className="uppercase">{provider.replace('_', ' ')}</strong> provider. Click here to configure them.</p>
            </div>
          </motion.div>
        )}

        {/* INPUT/CONFIG PANEL */}
        {!currentJob ? (
          <div className="glass-panel p-5 rounded-3xl space-y-5">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/5 pb-3 font-mono">{`// 1. SETUP PARAMETERS`}</h3>
            
            {error && (
              <div className="flex gap-2 p-3 rounded-xl bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-xs font-semibold font-mono">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 pl-1 font-mono">API Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-800 dark:text-slate-200 appearance-none cursor-pointer font-mono"
                >
                  <option value="waapi">WaAPI.app Gateway</option>
                  <option value="whatsapp_cloud">WhatsApp Cloud API (Meta)</option>
                  <option value="twilio">Twilio Lookups API (WhatsApp)</option>
                  <option value="ultramsg">UltraMsg Gateway API</option>
                </select>
              </div>

              {/* Telegram Switch */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-300 font-mono">Telegram Alerts</p>
                  <p className="text-[10px] text-slate-500">Notify chat when check completes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramNotice}
                    onChange={(e) => setTelegramNotice(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 dark:after:bg-slate-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-cyan dark:peer-checked:bg-cyber-green peer-checked:after:bg-slate-900" />
                </label>
              </div>

              {/* Paste Inputs */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 pl-1 font-mono">Paste Subscriber Numbers</label>
                <textarea
                  value={numbersPaste}
                  onChange={(e) => setNumbersPaste(e.target.value)}
                  placeholder="01819985042&#10;8801717840013&#10;+8801911320091"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-200 font-mono resize-none"
                  disabled={uploadedFile !== null}
                />
              </div>

              <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 my-1 font-mono">— OR —</div>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200
                  ${dragActive ? 'border-cyber-cyan dark:border-cyber-green bg-cyber-cyan/5 dark:bg-cyber-green/5' : 'border-slate-200 dark:border-white/10 hover:border-cyber-cyan dark:hover:border-cyber-green bg-slate-50 dark:bg-white/[0.01] hover:bg-slate-100 dark:hover:bg-white/[0.02]'}
                  ${numbersPaste ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".txt,.csv,.xls,.xlsx"
                  className="hidden"
                  disabled={numbersPaste.length > 0}
                />
                
                {uploadedFile ? (
                  <div className="space-y-2">
                    <FileText className="w-10 h-10 text-cyber-cyan dark:text-cyber-green mx-auto" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-300 truncate max-w-[200px] mx-auto font-mono">{uploadedFile.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); clearFile(); }} 
                      className="px-2.5 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-[10px] hover:bg-cyber-red/20 font-bold transition-all font-mono"
                    >
                      REMOVE FILE
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">[UPLOAD LIST FILE]</p>
                    <p className="text-[10px] text-slate-500 font-mono">Drag & drop TXT, CSV, or XLSX</p>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || (!numbersPaste && !uploadedFile)}
                className="btn-primary w-full py-3.5 mt-4 rounded-xl text-sm uppercase"
              >
                {isLoading ? 'Preparing Lists...' : 'Start WhatsApp Check'}
              </motion.button>
            </form>
          </div>
        ) : (
          /* ACTIVE CHECK LIVE STATS PANEL */
          <div className="glass-panel p-5 rounded-3xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{`// 2. CHECK STATUS`}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider font-mono
                ${currentJob.status === 'completed' ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : ''}
                ${currentJob.status === 'processing' ? 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan animate-pulse' : ''}
                ${currentJob.status === 'paused' ? 'bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber' : ''}
                ${currentJob.status === 'failed' ? 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red' : ''}
                ${currentJob.status === 'pending' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' : ''}
              `}>
                {`[${currentJob.status}]`}
              </span>
            </div>

            {/* Circular Progress & Percentage */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="rgba(100,116,139,0.08)" strokeWidth="6" fill="transparent" />
                  <circle cx="56" cy="56" r="48" stroke="#00FF66" strokeWidth="6" fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - pct / 100)}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-850 dark:text-slate-100 font-mono">{pct}%</span>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">Progress</p>
                </div>
              </div>
              
              {currentJob.status === 'processing' && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
                  Speed: <strong className="text-cyber-green">{currentJob.speed || 0}</strong> num/s
                </p>
              )}
            </div>

            {/* Micro Stats Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center font-mono">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Processed</p>
                <p className="text-base font-black text-slate-700 dark:text-slate-200">{currentJob.processed_count} / {currentJob.total_count}</p>
              </div>
              <div className="p-3 rounded-2xl bg-cyber-green/5 border border-cyber-green/15 text-center font-mono">
                <p className="text-[10px] font-bold text-cyber-green uppercase tracking-wider mb-0.5">Valid</p>
                <p className="text-base font-black text-cyber-green">{currentJob.valid_count}</p>
              </div>
              <div className="p-3 rounded-2xl bg-cyber-red/5 border border-cyber-red/15 text-center font-mono">
                <p className="text-[10px] font-bold text-cyber-red uppercase tracking-wider mb-0.5">Invalid</p>
                <p className="text-base font-black text-cyber-red">{currentJob.invalid_count}</p>
              </div>
              <div className="p-3 rounded-2xl bg-cyber-cyan/5 border border-cyber-cyan/15 text-center font-mono">
                <p className="text-[10px] font-bold text-cyber-cyan uppercase tracking-wider mb-0.5">Duplicates</p>
                <p className="text-base font-black text-cyber-cyan">{currentJob.duplicates_removed}</p>
              </div>
            </div>

            {/* Run Actions */}
            <div className="flex gap-3 pt-2">
              {currentJob.status === 'processing' && (
                <button
                  onClick={() => pauseJob(currentJob.id)}
                  className="flex-1 py-3 rounded-xl bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber font-bold text-xs flex items-center justify-center gap-2 hover:bg-cyber-amber/20 transition-all font-mono"
                >
                  <Pause className="w-4 h-4" />
                  PAUSE CHECK
                </button>
              )}
              {currentJob.status === 'paused' && (
                <button
                  onClick={() => resumeJob(currentJob.id)}
                  className="flex-1 py-3 rounded-xl bg-cyber-green/10 border border-cyber-green/20 text-cyber-green font-bold text-xs flex items-center justify-center gap-2 hover:bg-cyber-green/20 transition-all font-mono"
                >
                  <Play className="w-4 h-4" />
                  RESUME CHECK
                </button>
              )}
              {(currentJob.status === 'done' || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'paused') && (
                <button
                  onClick={() => {
                    setSearchParams({});
                    clearCurrentJob();
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-mono"
                >
                  <RefreshCcw className="w-4 h-4" />
                  NEW PROCESS
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* COLUMN 2 & 3: LIVE LOGS AND PAGINATED DATA VIEW */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* LOG CONSOLE BOX */}
        {currentJob && (
          <div className="glass-panel p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 font-mono">
                <Terminal className="w-4 h-4 text-cyber-green" />
                Live Job Console Logs
              </h3>
              <CopyButton textToCopy={copyData.logs} label="Copy Logs" className="py-1 px-2.5" />
            </div>

            {/* Matrix green-on-black terminal logs box - retained in dark colors for both modes */}
            <div className="h-40 bg-slate-950 border border-slate-900 rounded-2xl p-4 overflow-y-auto font-mono text-[10px] text-cyber-green/90 space-y-1 scroll-smooth">
              {logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed border-l-2 border-cyber-green/20 pl-2">
                  {log}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-slate-700 italic font-mono">[WAITING FOR PROCESS HEARTBEAT...]</div>
              )}
              <div ref={logsConsoleEndRef} />
            </div>
          </div>
        )}

        {/* RESULTS TABLE AND EXPORT BUTTONS */}
        {currentJob && (
          <div className="glass-panel rounded-3xl overflow-hidden">
            {/* Table Header toolbar */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{`// VERIFIED TARGETS`}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Virtual view of processed numbers lists</p>
                </div>

                {/* COPY BUTTONS BAR */}
                <div className="flex flex-wrap gap-2">
                  <CopyButton textToCopy={copyData.valid} label="Copy Valid" />
                  <CopyButton textToCopy={copyData.invalid} label="Copy Invalid" />
                  <CopyButton textToCopy={copyData.cleaned} label="Copy Cleaned" />
                </div>
              </div>

              {/* EXPORT OPTIONS PANEL */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-3 rounded-2xl text-xs font-mono">
                <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
                  <Download className="w-4 h-4 text-cyber-cyan dark:text-cyber-green" />
                  [EXPORT FILES]:
                </span>
                
                <button 
                  onClick={() => handleExport('xlsx', 'all')}
                  className="px-3 py-1.5 rounded-lg bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-[10px] font-bold hover:bg-cyber-green/20 transition-all"
                >
                  Excel (All)
                </button>
                <button 
                  onClick={() => handleExport('csv', 'valid')}
                  className="px-3 py-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-[10px] font-bold hover:bg-cyber-cyan/20 transition-all"
                >
                  CSV (Valid Only)
                </button>
                <button 
                  onClick={() => handleExport('txt', 'unique_cleaned')}
                  className="px-3 py-1.5 rounded-lg bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber text-[10px] font-bold hover:bg-cyber-amber/20 transition-all"
                >
                  TXT (Cleaned)
                </button>
              </div>

              {/* FILTER / SEARCH */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                    placeholder="Search by phone number..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                  className="px-3 py-2 rounded-xl glass-input text-xs text-slate-700 dark:text-slate-350 appearance-none cursor-pointer font-mono"
                >
                  <option value="">All Statuses</option>
                  <option value="valid">Valid Accounts</option>
                  <option value="business">Business Accounts</option>
                  <option value="invalid">Invalid Format</option>
                  <option value="failed">Verification Failed</option>
                </select>
              </div>
            </div>

            {/* Results Grid List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                    <th className="px-5 py-3">Phone Number</th>
                    <th className="px-5 py-3">Verification State</th>
                    <th className="px-5 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-mono">
                  {paginatedResults.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-3.5 text-slate-800 dark:text-slate-300 font-semibold">
                        {res.phone_number || res.normalized_number || res.original_number}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                          ${(res.status === 'valid' || res.status === 'business') ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : ''}
                          ${res.status === 'invalid' ? 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red' : ''}
                          ${res.status === 'failed' ? 'bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber' : ''}
                        `}>
                          {(res.status === 'valid' || res.status === 'business') ? (
                            <>
                              <Check className="w-3 h-3 text-cyber-green" />
                              {`[${res.status}]`}
                            </>
                          ) : (
                            `[${res.status}]`
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-400 dark:text-slate-500 text-[10px]">{new Date(res.checked_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-slate-450 dark:text-slate-500 italic font-mono">[NO SUBSCRIBERS LOGGED]</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs select-none font-mono">
                <span className="font-semibold text-slate-400 dark:text-slate-500">
                  Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filteredResults.length)} of {filteredResults.length}
                </span>
                
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-150 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-slate-150 dark:disabled:hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold transition-all"
                  >
                    PREV
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-150 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-slate-150 dark:disabled:hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold transition-all"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
