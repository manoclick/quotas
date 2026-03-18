import React, { useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { Lock, User, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Ensure we are signed in anonymously for Firebase Rules
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 2. Check for the admin bootstrap if it's the first time
      if (username === 'admin' && password === 'click23') {
        const adminDoc = await getDoc(doc(db, 'users', 'admin'));
        if (!adminDoc.exists()) {
          const initialAdmin: UserProfile = {
            id: 'admin',
            username: 'admin',
            password: 'click23',
            name: 'Administrador',
            role: 'admin'
          };
          await setDoc(doc(db, 'users', 'admin'), initialAdmin);
          onLoginSuccess(initialAdmin);
          return;
        }
      }

      // 3. Query for the user
      const q = query(
        collection(db, 'users'),
        where('username', '==', username),
        where('password', '==', password)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        
        // Create a session link for security rules
        if (auth.currentUser) {
          await setDoc(doc(db, 'active_sessions', auth.currentUser.uid), {
            username: profile.username,
            role: profile.role,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
          });
        }
        
        onLoginSuccess(profile);
      } else {
        setError('Usuário ou senha incorretos.');
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      if (err.message?.includes('the client is offline') || err.code === 'unavailable') {
        setError('Erro de conexão: O servidor está inacessível. Verifique sua internet.');
      } else if (err.code === 'permission-denied') {
        setError('Acesso negado: Verifique as permissões do sistema.');
      } else {
        setError(`Erro ao conectar: ${err.message || 'Verifique sua conexão.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
      <div className="max-w-sm w-full bg-white rounded-[2rem] shadow-2xl p-8 border border-slate-100 animate-in fade-in zoom-in duration-300">
        <div className="w-14 h-14 bg-brand-primary rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-brand-primary/20">
          <Lock size={28} />
        </div>
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-brand-ink mb-1">QUOTAS</h1>
          <p className="text-slate-400 text-sm font-medium">Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="text"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all font-medium text-sm"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="password"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all font-medium text-sm"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold animate-in slide-in-from-top-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-primary text-white text-sm font-black rounded-xl shadow-lg shadow-brand-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'ENTRAR NO SISTEMA'}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] text-slate-400 font-medium leading-relaxed">
          Acesso restrito a pessoal autorizado.<br />
          Gestão de Contribuições e Quotas.
        </p>
      </div>
    </div>
  );
}
