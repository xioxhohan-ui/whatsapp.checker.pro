import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Settings, 
  BarChart3, 
  History, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  X,
  MessageSquareCode,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Initialize theme from localStorage or default to light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'WhatsApp Checker', href: '/checker', icon: CheckSquare },
    { name: 'API Settings', href: '/settings', icon: Settings },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Export History', href: '/history', icon: History },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin Panel', href: '/admin', icon: ShieldAlert });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const activeItem = navigation.find(item => item.href === location.pathname);
    return activeItem ? activeItem.name : 'WhatsApp Checker';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 bg-grid-pattern flex transition-colors duration-200">
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 glass-panel border-r border-slate-200/80 dark:border-slate-800/80 p-5 shrink-0 select-none">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyber-green/10 border border-cyber-green/30 flex items-center justify-center text-cyber-green text-glow-green">
            <MessageSquareCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-slate-900 dark:text-slate-100">WA INTEL PRO</h1>
            <p className="text-[9px] font-mono text-slate-400 dark:text-cyber-green/80 uppercase tracking-widest font-semibold">[GATEWAY: READY]</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${isActive 
                    ? 'bg-cyber-cyan/10 dark:bg-cyber-green/10 text-cyber-cyan dark:text-cyber-green border-l-4 border-cyber-cyan dark:border-cyber-green pl-3 font-mono' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-cyber-cyan dark:text-cyber-green' : 'text-slate-400 dark:text-slate-500'}`} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-cyber-cyan/10 dark:bg-cyber-green/10 border border-cyber-cyan/20 dark:border-cyber-green/20 flex items-center justify-center font-bold text-cyber-cyan dark:text-cyber-green">
              {user?.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
              <p className="text-[10px] text-cyber-cyan dark:text-cyber-green uppercase font-bold tracking-widest font-mono">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 dark:border-red-500/30 hover:bg-red-500/20 hover:border-red-500/30 text-red-500 font-semibold text-xs transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER NAV */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
            />
            {/* Sidebar content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 z-50 p-5 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between py-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyber-green/10 border border-cyber-green/30 flex items-center justify-center text-cyber-green">
                    <MessageSquareCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="font-extrabold text-sm tracking-wide text-slate-900 dark:text-slate-100">WA INTEL PRO</h1>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-cyber-green/80 uppercase tracking-widest font-semibold">[READY]</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileOpen(false)} 
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-1.5">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                        ${isActive 
                          ? 'bg-cyber-cyan/10 dark:bg-cyber-green/10 text-cyber-cyan dark:text-cyber-green border-l-4 border-cyber-cyan dark:border-cyber-green pl-3 font-mono' 
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-cyber-cyan/10 dark:bg-cyber-green/10 border border-cyber-cyan/20 dark:border-cyber-green/20 flex items-center justify-center font-bold text-cyber-cyan dark:text-cyber-green">
                    {user?.email[0].toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
                    <p className="text-[10px] text-cyber-cyan dark:text-cyber-green uppercase font-bold tracking-widest font-mono">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 dark:border-red-500/30 hover:bg-red-500/20 hover:border-red-500/30 text-red-500 font-semibold text-xs transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER NAVBAR */}
        <header className="h-16 glass-panel border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-6 z-30 select-none">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMobileOpen(true);
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer relative z-50 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-extrabold text-sm md:text-base text-slate-800 dark:text-slate-200 font-mono tracking-tight">{`// ${getPageTitle().toUpperCase()}`}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
            </button>

            <span className="hidden md:inline text-xs font-mono text-slate-400 dark:text-slate-500">System Status:</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyber-green/10 border border-cyber-green/20 text-[10px] font-bold text-cyber-green text-glow-green">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse"></span>
              [STATUS: OK]
            </span>
          </div>
        </header>

        {/* VIEWPORT BODY */}
        <main className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-8 pt-4 border-t border-slate-200/50 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 select-none">
            <div>
              [VERSION: 1.0.0-PRO] [ENVIRONMENT: STABLE]
            </div>
            <div className="mt-1 sm:mt-0 uppercase">
              © {new Date().getFullYear()} SHAMS CODE. ALL RIGHTS RESERVED. DEVELOPED BY SHOHAN AHMED SHAM.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
