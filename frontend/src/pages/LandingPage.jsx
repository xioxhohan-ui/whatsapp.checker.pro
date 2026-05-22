import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckSquare, 
  Trash2, 
  Smartphone, 
  Zap, 
  Database, 
  ShieldCheck, 
  ArrowRight,
  MessageSquareCode,
  Sun,
  Moon
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Initialize theme from localStorage or default to dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
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

  const features = [
    {
      title: 'Bulk WhatsApp Verification',
      description: 'Check up to 100K+ phone numbers for active WhatsApp presence utilizing real APIs.',
      icon: CheckSquare,
      color: 'text-cyber-green border-cyber-green/20 bg-cyber-green/5'
    },
    {
      title: 'Duplicate Remover Pro',
      description: 'Intelligent formatting identification that merges different representations of the same subscriber.',
      icon: Trash2,
      color: 'text-cyber-cyan border-cyber-cyan/20 bg-cyber-cyan/5'
    },
    {
      title: 'Bangladesh Normalization',
      description: 'Auto-convert all formats to standardized +880 format, filtering length constraints and prefixes.',
      icon: Smartphone,
      color: 'text-cyber-amber border-cyber-amber/20 bg-cyber-amber/5'
    },
    {
      title: 'High-Performance Workers',
      description: 'Distributed Celery & Redis task architecture allowing asynchronous bulk check workflows.',
      icon: Zap,
      color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
    },
    {
      title: 'Flexible Integrations',
      description: 'Supports WaAPI, WhatsApp Cloud API, Twilio WhatsApp, and UltraMsg gateways.',
      icon: Database,
      color: 'text-cyber-cyan border-cyber-cyan/20 bg-cyber-cyan/5'
    },
    {
      title: 'Enterprise Security',
      description: 'API credentials saved securely with AES encryption. Tokenized auth cycles protect all routes.',
      icon: ShieldCheck,
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/5'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 bg-grid-pattern relative overflow-hidden flex flex-col transition-colors duration-200">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyber-green/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyber-cyan/5 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="h-20 max-w-7xl mx-auto w-full flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyber-green/10 border border-cyber-green/40 flex items-center justify-center text-cyber-green text-glow-green">
            <MessageSquareCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-slate-900 dark:text-slate-100 font-mono">WA INTEL PRO</h1>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono font-semibold">[WHATSAPP INTELLIGENCE]</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all duration-200"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
          </button>
          
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-sm font-semibold transition-all duration-200"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 w-full flex flex-col justify-center items-center text-center py-12 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-green/10 border border-cyber-green/30 text-cyber-green text-[10px] font-bold tracking-wider uppercase font-mono shadow-glow-green">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping" />
            [ENTERPRISE GRADE BULK CHECKER]
          </div>
          
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-slate-100">
            Clean, Normalize & Verify{' '}
            <span className="text-gradient-cyber">
              WhatsApp Numbers
            </span>{' '}
            at Scale
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm leading-relaxed max-w-2xl mx-auto font-mono">
            Clean duplicate listings, automatically normalize Bangladesh contacts, and check real-time availability on WhatsApp using WaAPI or Cloud API gateways.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login?tab=register')}
              className="btn-primary px-8 py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="px-8 py-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 font-bold text-sm text-slate-700 dark:text-slate-200 transition-all duration-200"
            >
              Access Dashboard
            </motion.button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel p-6 rounded-2xl text-left hover:border-cyber-cyan/40 dark:hover:border-cyber-green/40 hover:shadow-cyber-hover transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${feature.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold mb-2 text-slate-900 dark:text-slate-100 group-hover:text-cyber-cyan dark:group-hover:text-cyber-green transition-colors duration-200 font-mono">
                  {`// ${feature.title.toUpperCase()}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">{feature.description}</p>
              </motion.div>
            );
          })}
        </section>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono font-semibold">
        © {new Date().getFullYear()} Shams Code. All Rights Reserved. Developed by Shohan Ahmed Sham.
      </footer>
    </div>
  );
}
