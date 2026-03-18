import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Users, 
  CreditCard, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  UserCheck,
  Map,
  Layers,
  Grid,
  BarChart3,
  Settings as SettingsIcon,
  ShieldAlert
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { UserProvider, useUser } from '../contexts/UserContext';

interface LayoutProps {
  children: React.ReactNode;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

export default function Layout({ children, userProfile, onLogout }: LayoutProps) {
  const { permissions } = useUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'active_sessions', auth.currentUser.uid));
      }
      await signOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
    onLogout();
    navigate('/');
  };

  const menuItems = [
    { name: 'HOME', icon: Home, path: '/', key: 'home' },
    { name: 'PROFESSORES', icon: UserCheck, path: '/teachers', key: 'teachers' },
    { name: 'PAGAMENTOS', icon: CreditCard, path: '/payments', key: 'payments' },
    { name: 'RELATÓRIOS', icon: BarChart3, path: '/reports', key: 'reports' },
    { name: 'ZONAS', icon: Map, path: '/zones', key: 'zones' },
    { name: 'CÍRCULOS', icon: Layers, path: '/circles', key: 'circles' },
    { name: 'CÉLULAS', icon: Grid, path: '/cells', key: 'cells' },
    { name: 'FUNÇÕES', icon: SettingsIcon, path: '/functions', key: 'functions' },
    { name: 'GESTORES', icon: Users, path: '/users', key: 'users' },
    { name: 'CONFIGURAÇÕES', icon: SettingsIcon, path: '/settings', key: 'settings' },
  ];

  const filteredMenu = menuItems.filter(item => {
    if (!userProfile || !permissions) return false;
    const rolePermissions = permissions[userProfile.role];
    return rolePermissions?.[item.key];
  });

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:block",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                <CreditCard size={24} />
              </div>
              <div>
                <h1 className="font-bold text-brand-ink leading-tight">QUOTAS</h1>
                <p className="text-xs text-slate-500 font-medium tracking-wider uppercase">Gestão Escolar</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredMenu.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  location.pathname === item.path 
                    ? "bg-brand-primary/10 text-brand-primary" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  location.pathname === item.path ? "text-brand-primary" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <span className="font-medium text-sm">{item.name}</span>
                {location.pathname === item.path && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="bg-brand-bg rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-700">
                  {userProfile?.name?.charAt(0) || userProfile?.username?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-ink truncate">
                    {userProfile?.name || 'Usuário'}
                  </p>
                  <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">
                    {userProfile?.role}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium text-sm">Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <button 
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1 px-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Painel'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-slate-500 font-medium">Data de Hoje</p>
              <p className="text-sm font-semibold text-slate-900">
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
