import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { 
  ShieldAlert, 
  Users, 
  Activity, 
  UserCheck, 
  UserX, 
  Database,
  Server,
  Zap
} from 'lucide-react';

export default function AdminPanel() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const usersRes = await api.get('/admin/users');
      setUsers(usersRes.data);

      const healthRes = await api.get('/admin/health');
      setHealth(healthRes.data);
    } catch (err) {
      setError('Failed to load administrator panel info. Verify role privileges.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/toggle`);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle user status');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyber-green border-t-transparent animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono">[DIAGNOSTIC SYSTEM INITIATION...]</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-xs font-semibold flex items-center gap-2 font-mono">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  const healthMetrics = [
    {
      name: 'PostgreSQL DB',
      status: health?.database_status || 'unhealthy',
      icon: Database,
      desc: 'Stores users, API keys, export histories, and job status.'
    },
    {
      name: 'Redis Cache & Broker',
      status: health?.redis_status || 'unhealthy',
      icon: Zap,
      desc: 'Handles task brokers, WS event queues, and state caching.'
    },
    {
      name: 'Celery Distributed Workers',
      status: health?.celery_status || 'unhealthy',
      icon: Server,
      desc: 'Processes heavy background verification checks.'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
      
      {/* COLUMN 1 & 2: USER MANAGEMENT */}
      <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden h-fit">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 font-mono">
              <Users className="w-4.5 h-4.5 text-cyber-cyan dark:text-cyber-green" />
              [CLIENT ACCESS CONTROL]
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Deactivate / activate client profile accesses</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-cyber-green/10 text-[10px] font-bold text-cyber-green font-mono">
            {users.length} CLIENTS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                <th className="px-5 py-3">User Email</th>
                <th className="px-5 py-3">Privilege Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-mono">
              {users.filter(u => u.id !== user?.id).map((u) => (
                <tr key={u.id} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{u.email}</td>
                  <td className="px-5 py-4 uppercase font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400">{u.role}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
                      ${u.is_active ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red'}
                    `}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 dark:text-slate-500 font-semibold">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleToggleUser(u.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ml-auto transition-all
                        ${u.is_active 
                          ? 'bg-cyber-red/10 hover:bg-cyber-red/20 border border-cyber-red/20 text-cyber-red' 
                          : 'bg-cyber-green/10 hover:bg-cyber-green/20 border border-cyber-green/20 text-cyber-green'
                        }
                      `}
                    >
                      {u.is_active ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Activate
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLUMN 3: SYSTEM HEALTH */}
      <div className="glass-panel p-5 rounded-3xl h-fit space-y-4">
        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/5 pb-3 flex items-center gap-2 font-mono">
          <Activity className="w-4.5 h-4.5 text-cyber-cyan dark:text-cyber-green" />
          [INFRASTRUCTURE STATUS]
        </h3>

        <div className="space-y-4">
          {healthMetrics.map((metric) => {
            const Icon = metric.icon;
            const isHealthy = metric.status === 'healthy';
            return (
              <div key={metric.name} className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${isHealthy ? 'text-cyber-green border-cyber-green/10 bg-cyber-green/5' : 'text-cyber-red border-cyber-red/10 bg-cyber-red/5'}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{metric.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
                    ${isHealthy ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green dark:text-cyber-green' : 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red'}
                  `}>
                    {metric.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{metric.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
