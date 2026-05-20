import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { 
  Key, 
  User, 
  Send, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Settings() {
  const { user, checkAuth } = useAuthStore();
  
  // Active API keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  // Form states - API Keys
  const [provider, setProvider] = useState('waapi');
  const [keyName, setKeyName] = useState('');
  
  // Provider specific credentials inputs
  const [waapiToken, setWaapiToken] = useState('');
  const [waapiInstance, setWaapiInstance] = useState('');
  
  const [waToken, setWaToken] = useState('');
  const [waPhoneId, setWaPhoneId] = useState('');
  const [twSid, setTwSid] = useState('');
  const [twToken, setTwToken] = useState('');
  const [umInstance, setUmInstance] = useState('');
  const [umToken, setUmToken] = useState('');

  // Form states - Profile
  const [telegramChatId, setTelegramChatId] = useState(user?.telegram_chat_id || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification states
  const [apiKeyMsg, setApiKeyMsg] = useState({ text: '', type: '' });
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await api.get('/api-keys');
      setApiKeys(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    setApiKeyMsg({ text: '', type: '' });
    
    // Construct credentials object
    let credentials = {};
    if (provider === 'waapi') {
      if (!waapiToken || !waapiInstance) {
        setApiKeyMsg({ text: 'Please fill in all WaAPI.app credentials.', type: 'error' });
        return;
      }
      credentials = { token: waapiToken, instance_id: waapiInstance };
    } else if (provider === 'whatsapp_cloud') {
      if (!waToken || !waPhoneId) {
        setApiKeyMsg({ text: 'Please fill in all WhatsApp Cloud credentials.', type: 'error' });
        return;
      }
      credentials = { access_token: waToken, phone_number_id: waPhoneId };
    } else if (provider === 'twilio') {
      if (!twSid || !twToken) {
        setApiKeyMsg({ text: 'Please fill in all Twilio credentials.', type: 'error' });
        return;
      }
      credentials = { account_sid: twSid, auth_token: twToken };
    } else if (provider === 'ultramsg') {
      if (!umInstance || !umToken) {
        setApiKeyMsg({ text: 'Please fill in all UltraMsg credentials.', type: 'error' });
        return;
      }
      credentials = { instance_id: umInstance, token: umToken };
    }

    try {
      await api.post('/api-keys', {
        provider,
        name: keyName || `${provider.toUpperCase().replace('_', ' ')} Key`,
        credentials
      });

      setApiKeyMsg({ text: 'API Key credentials saved successfully.', type: 'success' });
      // Reset inputs
      setKeyName('');
      setWaapiToken('');
      setWaapiInstance('');
      setWaToken('');
      setWaPhoneId('');
      setTwSid('');
      setTwToken('');
      setUmInstance('');
      setUmToken('');
      
      loadApiKeys();
    } catch (err) {
      setApiKeyMsg({ text: err.response?.data?.detail || 'Failed to save key credentials.', type: 'error' });
    }
  };

  const handleDeleteApiKey = async (id) => {
    if (!window.confirm('Are you sure you want to delete this API Key configuration?')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      setApiKeys(apiKeys.filter(k => k.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });

    if (password && password.length < 6) {
      setProfileMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }

    if (password && password !== confirmPassword) {
      setProfileMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      const payload = { telegram_chat_id: telegramChatId };
      if (password) {
        payload.password = password;
      }

      await api.put('/auth/me', payload);
      setProfileMsg({ text: 'Profile updated successfully.', type: 'success' });
      setPassword('');
      confirmPassword && setConfirmPassword('');
      checkAuth();
    } catch (err) {
      setProfileMsg({ text: 'Failed to update profile details.', type: 'error' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
      
      {/* COLUMN 1: API KEYS CONFIGURATION */}
      <div className="space-y-6">
        
        {/* ADD API KEY FORM */}
        <div className="glass-panel p-5 rounded-3xl space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/5 pb-3 flex items-center gap-2 font-mono">
            <Plus className="w-4.5 h-4.5 text-cyber-cyan dark:text-cyber-green" />
            [GATEWAY INTEGRATION KEYS]
          </h3>

          {apiKeyMsg.text && (
            <div className={`flex gap-2 p-3 rounded-xl text-xs font-semibold font-mono
              ${apiKeyMsg.type === 'success' ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red'}
            `}>
              {apiKeyMsg.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 shrink-0" /> : <AlertCircle className="w-4.5 h-4.5 shrink-0" />}
              <p>{apiKeyMsg.text}</p>
            </div>
          )}

          <form onSubmit={handleCreateApiKey} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Provider Type</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-200 appearance-none cursor-pointer font-mono"
                >
                  <option value="waapi">WaAPI.app Gateway</option>
                  <option value="whatsapp_cloud">WhatsApp Cloud API</option>
                  <option value="twilio">Twilio WhatsApp</option>
                  <option value="ultramsg">UltraMsg API</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Key Alias Name</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. WaAPI Production"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Render Provider Specific Inputs */}
            {provider === 'waapi' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">WaAPI Access Token</label>
                  <input
                    type="password"
                    required
                    value={waapiToken}
                    onChange={(e) => setWaapiToken(e.target.value)}
                    placeholder="Token string"
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Instance ID</label>
                  <input
                    type="text"
                    required
                    value={waapiInstance}
                    onChange={(e) => setWaapiInstance(e.target.value)}
                    placeholder="e.g. 93169"
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            {provider === 'whatsapp_cloud' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Graph Access Token</label>
                  <input
                    type="password"
                    required
                    value={waToken}
                    onChange={(e) => setWaToken(e.target.value)}
                    placeholder="EAAGz..."
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Phone Number ID</label>
                  <input
                    type="text"
                    required
                    value={waPhoneId}
                    onChange={(e) => setWaPhoneId(e.target.value)}
                    placeholder="107629..."
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            {provider === 'twilio' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Twilio Account SID</label>
                  <input
                    type="text"
                    required
                    value={twSid}
                    onChange={(e) => setTwSid(e.target.value)}
                    placeholder="AC..."
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Twilio Auth Token</label>
                  <input
                    type="password"
                    required
                    value={twToken}
                    onChange={(e) => setTwToken(e.target.value)}
                    placeholder="Auth Token"
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            {provider === 'ultramsg' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Instance ID</label>
                  <input
                    type="text"
                    required
                    value={umInstance}
                    onChange={(e) => setUmInstance(e.target.value)}
                    placeholder="instance12345"
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">UltraMsg Token</label>
                  <input
                    type="password"
                    required
                    value={umToken}
                    onChange={(e) => setUmToken(e.target.value)}
                    placeholder="Token"
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5 rounded-xl text-xs uppercase"
            >
              Save Configuration
            </button>
          </form>
        </div>

        {/* ACTIVE KEYS LIST */}
        <div className="glass-panel p-5 rounded-3xl space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/5 pb-3 flex items-center gap-2 font-mono">
            <Key className="w-4.5 h-4.5 text-cyber-cyan dark:text-cyber-green" />
            [ACTIVE GATEWAYS]
          </h3>

          {loadingKeys ? (
            <div className="text-center py-4 text-xs text-slate-500 font-mono">[CHECKING INTEGRATIONS...]</div>
          ) : apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 font-mono">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{key.name}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{key.provider.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
                      ${key.is_active ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}
                    `}>
                      {key.is_active ? 'Active' : 'Deactivated'}
                    </span>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="p-1.5 rounded-lg bg-cyber-red/10 hover:bg-cyber-red/20 border border-cyber-red/20 text-cyber-red transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 leading-relaxed font-mono">
              [NO ACTIVE GATEWAYS FOUND]<br />Submit the form above to configure credentials.
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 2: PROFILE & NOTIFICATION PARAMETERS */}
      <div className="glass-panel p-5 rounded-3xl h-fit space-y-4">
        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/5 pb-3 flex items-center gap-2 font-mono">
          <User className="w-4.5 h-4.5 text-cyber-cyan dark:text-cyber-green" />
          [NOTIFICATIONS & SECURITY]
        </h3>

        {profileMsg.text && (
          <div className={`flex gap-2 p-3 rounded-xl text-xs font-semibold font-mono
            ${profileMsg.type === 'success' ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' : 'bg-cyber-red/10 border border-cyber-red/20 text-cyber-red'}
          `}>
            {profileMsg.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 shrink-0" /> : <AlertCircle className="w-4.5 h-4.5 shrink-0" />}
            <p>{profileMsg.text}</p>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 font-mono">Login Email</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-xs text-slate-400 font-semibold font-mono select-none outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1 flex items-center gap-1.5 font-mono">
              Telegram Chat ID
              <Send className="w-3 h-3 text-sky-400" />
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="e.g. 192837465"
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-mono">Configure chat ID to receive real-time updates when checker sessions complete.</p>
          </div>

          <div className="border-t border-slate-200 dark:border-white/5 pt-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 font-mono">[CHANGE PASSWORD - OPTIONAL]</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 pl-1 font-mono">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 rounded-xl glass-input text-xs text-slate-850 dark:text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-2.5 rounded-xl text-xs uppercase"
          >
            Update Account Settings
          </button>
        </form>
      </div>

    </div>
  );
}
