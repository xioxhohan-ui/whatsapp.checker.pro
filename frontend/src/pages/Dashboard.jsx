import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Layers, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#00FF66', '#00E5FF', '#FFB000'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Monitor document theme
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDark(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const statsRes = await api.get('/analytics');
        setStats(statsRes.data);

        const jobsRes = await api.get('/jobs');
        setRecentJobs(jobsRes.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyber-green border-t-transparent animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono">[RETRIEVING DASHBOARD METRICS...]</p>
      </div>
    );
  }

  const hasStats = stats && stats.total_checked > 0;
  
  const dailyData = stats?.daily_stats || [];
  const providerData = Object.entries(stats?.provider_distribution || {}).map(([key, val]) => ({
    name: key.toUpperCase().replace('_', ' '),
    value: val
  }));

  const metrics = [
    {
      title: 'Total Numbers Checked',
      value: stats?.total_checked || 0,
      icon: Layers,
      color: 'text-cyber-cyan border-cyber-cyan/20 bg-cyber-cyan/5'
    },
    {
      title: 'Valid WhatsApp Accounts',
      value: stats?.total_valid || 0,
      icon: CheckCircle2,
      color: 'text-cyber-green border-cyber-green/20 bg-cyber-green/5'
    },
    {
      title: 'Invalid Accounts',
      value: stats?.total_invalid || 0,
      icon: XCircle,
      color: 'text-cyber-red border-cyber-red/20 bg-cyber-red/5'
    },
    {
      title: 'Overall Hit Rate',
      value: `${stats?.success_rate || 0}%`,
      icon: Percent,
      color: 'text-cyber-amber border-cyber-amber/20 bg-cyber-amber/5'
    }
  ];

  // Theme styles for Recharts
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(30, 41, 59, 0.05)';
  const tooltipBg = isDark ? '#111827' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(0, 255, 102, 0.25)' : 'rgba(30, 41, 59, 0.15)';
  const tooltipTextColor = isDark ? '#ffffff' : '#0f172a';

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="glass-panel p-5 rounded-2xl flex items-center justify-between hover:border-cyber-cyan/40 dark:hover:border-cyber-green/40 hover:shadow-cyber-hover transition-all"
            >
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">{metric.title}</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{metric.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${metric.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics Charts */}
      {hasStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main line volume chart */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{`// DAILY VERIFICATION VOLUMES`}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Processed numbers in the past 7 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-cyber-green font-bold bg-cyber-green/10 px-2 py-1 rounded-lg font-mono">
                <TrendingUp className="w-3.5 h-3.5 animate-pulse" />
                [SYSTEM: READY]
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FF66" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00FF66" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#00E5FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: tooltipBg, 
                      border: `1px solid ${tooltipBorder}`, 
                      borderRadius: '12px', 
                      color: tooltipTextColor,
                      fontFamily: 'monospace'
                    }} 
                    itemStyle={{ fontSize: '12px' }}
                    labelStyle={{ fontSize: '10px', color: '#64748B' }}
                  />
                  <Area type="monotone" dataKey="valid" stroke="#00FF66" fillOpacity={1} fill="url(#colorValid)" name="Valid Accounts" strokeWidth={2} />
                  <Area type="monotone" dataKey="checked" stroke="#00E5FF" fillOpacity={1} fill="url(#colorTotal)" name="Total Checked" strokeWidth={1.5} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Provider distribution pie chart */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{`// GATEWAY API DISTRIBUTION`}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Utilization split across WhatsApp API providers</p>
            </div>
            <div className="h-64 flex items-center justify-center">
              {providerData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={providerData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {providerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: tooltipBg, 
                        border: `1px solid ${tooltipBorder}`, 
                        borderRadius: '12px', 
                        color: tooltipTextColor,
                        fontFamily: 'monospace'
                      }} 
                      itemStyle={{ fontSize: '11px' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      align="center"
                      iconSize={8}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', color: '#64748B', paddingTop: '10px', fontFamily: 'monospace' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">[NO GATEWAY LOGS DETECTED]</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm font-mono">[NO VERIFICATION METRICS LOGGED YET]</p>
          <button
            onClick={() => navigate('/checker')}
            className="btn-primary px-6 py-2.5 rounded-xl text-xs uppercase"
          >
            Start WhatsApp Verification
          </button>
        </div>
      )}

      {/* Recent Jobs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-mono">{`// RECENT VERIFICATION JOBS`}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Status of last 5 uploaded phone check processes</p>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-xs font-bold text-cyber-cyan dark:text-cyber-green hover:underline flex items-center gap-1 transition-colors font-mono"
          >
            [FULL HISTORY]
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                  <th className="px-5 py-3">Job ID</th>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Valid / Invalid</th>
                  <th className="px-5 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {recentJobs.map((job) => {
                  const pct = job.total_numbers > 0 ? Math.round((job.total_numbers / job.total_numbers) * 100) : 0;
                  return (
                    <tr key={job.id} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-colors cursor-pointer" onClick={() => navigate(`/checker?job_id=${job.id}`)}>
                      <td className="px-5 py-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{job.id.slice(0, 8)}...</td>
                      <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300 font-mono uppercase text-[11px]">{job.provider.replace('_', ' ')}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono
                          ${(job.status === 'done' || job.status === 'completed') ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : ''}
                          ${job.status === 'processing' ? 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan animate-pulse' : ''}
                          ${job.status === 'paused' ? 'bg-cyber-amber/10 border border-cyber-amber/20 text-cyber-amber' : ''}
                          ${job.status === 'pending' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' : ''}
                          ${job.status === 'failed' ? 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red' : ''}
                        `}>
                          {`[${job.status}]`}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="w-full bg-slate-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden border border-slate-300/30 dark:border-white/5">
                            <div className="bg-cyber-cyan dark:bg-cyber-green h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px]">
                        <span className="text-cyber-green font-bold">+{job.valid_count}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-cyber-red font-bold">-{job.invalid_count}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-500 dark:text-slate-500 font-semibold font-mono text-[10px]">{new Date(job.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">[NO VERIFICATION JOBS FOUND]</div>
        )}
      </div>
    </div>
  );
}
