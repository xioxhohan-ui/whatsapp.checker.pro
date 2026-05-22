import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';
import { MessageSquareCode, Mail, Lock, AlertCircle, Sparkles, Sun, Moon } from 'lucide-react';

export default function LoginRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, error, clearError, isAuthenticated } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Theme support
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

  // Switch tabs based on search params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
    clearError();
    setValidationError('');
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMsg('');
    clearError();

    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      if (isLogin) {
        const success = await login(email, password);
        if (success) {
          navigate('/dashboard');
        }
      } else {
        const success = await register(email, password);
        if (success) {
          setSuccessMsg('Registration successful! Please sign in.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 bg-grid-pattern flex flex-col justify-center items-center p-6 relative overflow-hidden select-none transition-colors duration-200">
      {/* Theme toggle in top corner */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </button>
      </div>

      {/* Background radial glows */}
      <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-cyber-green/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[30%] w-[40%] h-[40%] bg-cyber-cyan/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Brand logo link */}
      <div className="flex items-center gap-3 mb-8 cursor-pointer z-10" onClick={() => navigate('/')}>
        <div className="w-12 h-12 rounded-2xl bg-cyber-green/10 border border-cyber-green/40 flex items-center justify-center text-cyber-green text-glow-green shadow-glow-green">
          <MessageSquareCode className="w-7 h-7" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg tracking-wide text-slate-900 dark:text-slate-100 font-mono">WA INTEL PRO</h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono font-semibold">[WHATSAPP INTELLIGENCE]</p>
        </div>
      </div>

      {/* Form Container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md glass-panel-glow rounded-3xl p-8 relative z-10"
      >
        {/* Title & switch buttons */}
        <div className="flex justify-between border-b border-slate-200 dark:border-white/5 pb-4 mb-6">
          <button
            onClick={() => {
              setIsLogin(true);
              setValidationError('');
              setSuccessMsg('');
              clearError();
            }}
            className={`font-bold text-base md:text-lg pb-2 border-b-2 transition-all font-mono uppercase ${
              isLogin ? 'border-cyber-green text-cyber-green text-glow-green' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setValidationError('');
              setSuccessMsg('');
              clearError();
            }}
            className={`font-bold text-base md:text-lg pb-2 border-b-2 transition-all font-mono uppercase ${
              !isLogin ? 'border-cyber-green text-cyber-green text-glow-green' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error notification */}
        {(validationError || error) && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs mb-5 font-semibold font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{validationError || error}</p>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-xs mb-5 font-semibold font-mono">
            <Sparkles className="w-4 h-4 shrink-0 animate-bounce" />
            <p>{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="btn-primary w-full py-3.5 mt-4 rounded-xl text-sm uppercase"
          >
            {isLogin ? 'Access Dashboard' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
