import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SystemConfig } from '../types';
import { Calendar, CheckCircle2, XCircle, Save, RefreshCw, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Notification from '../components/Notification';

export default function Settings() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const configId = `config_${selectedYear}`;
    const unsubConfig = onSnapshot(doc(db, 'system_configs', configId), (docSnap) => {
      if (docSnap.exists()) {
        setConfig({ id: docSnap.id, ...docSnap.data() } as SystemConfig);
      } else {
        const defaultConfig: SystemConfig = {
          id: configId,
          year: selectedYear,
          activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        };
        setConfig(defaultConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_configs');
    });

    const unsubPermissions = onSnapshot(doc(db, 'system_configs', 'permissions'), (docSnap) => {
      if (docSnap.exists()) {
        setPermissions(docSnap.data());
      } else {
        const defaultPermissions = {
          admin: { home: true, teachers: true, payments: true, reports: true, settings: true, users: true },
          gestor: { home: true, teachers: true, payments: true, reports: true, settings: true, users: false },
          gestor_celula: { home: true, teachers: true, payments: true, reports: false, settings: false, users: false },
          professor: { home: true, teachers: false, payments: false, reports: true, settings: false, users: false }
        };
        setPermissions(defaultPermissions);
      }
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubPermissions();
    };
  }, [selectedYear]);

  const togglePermission = (role: string, module: string) => {
    if (!permissions) return;
    const newPermissions = {
      ...permissions,
      [role]: {
        ...permissions[role],
        [module]: !permissions[role][module]
      }
    };
    setPermissions(newPermissions);
  };

  const toggleMonth = (month: number) => {
    if (!config) return;
    const newMonths = config.activeMonths.includes(month)
      ? config.activeMonths.filter(m => m !== month)
      : [...config.activeMonths, month].sort((a, b) => a - b);
    setConfig({ ...config, activeMonths: newMonths });
  };

  const handleSave = async () => {
    if (!config || !permissions) return;
    try {
      await setDoc(doc(db, 'system_configs', config.id), {
        year: config.year,
        activeMonths: config.activeMonths
      });
      await setDoc(doc(db, 'system_configs', 'permissions'), permissions);
      setNotification({ message: 'Configurações e permissões salvas!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Erro ao salvar configurações.', type: 'error' });
      handleFirestoreError(error, OperationType.CREATE, 'system_configs');
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Configurações do Sistema</h2>
          <p className="text-slate-500 font-medium">Gerencie os meses letivos e parâmetros globais</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-3">
            <Calendar size={20} className="text-brand-primary" />
            <select 
              className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save size={20} />
            Salvar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="card-elegant p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Meses Ativos</h3>
                <p className="text-sm text-slate-500">Selecione quais meses exigem pagamento de quota em {selectedYear}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {months.map(m => {
                const isActive = config?.activeMonths.includes(m);
                return (
                  <div 
                    key={m} 
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      isActive ? 'bg-brand-primary/5 border-brand-primary/20' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <button
                      onClick={() => toggleMonth(m)}
                      className={`w-5 h-5 rounded-md border-2 transition-all flex-shrink-0 ${
                        isActive 
                          ? 'bg-brand-primary border-brand-primary shadow-sm shadow-brand-primary/20' 
                          : 'bg-white border-slate-300 hover:border-slate-400'
                      }`}
                    />
                    <span className={`text-xs font-black uppercase tracking-tight ${isActive ? 'text-brand-primary' : 'text-slate-500'}`}>
                      {format(new Date(2024, m - 1), 'MMM', { locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-elegant p-8 border-none bg-white" style={{ color: '#1C1C1C' }}>
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw size={24} className="text-brand-primary" />
              <h3 className="text-xl font-bold">Ações Rápidas</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setConfig({ ...config!, activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })}
                className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-left transition-all border border-slate-200"
              >
                <p className="font-bold mb-1">Ativar Todos</p>
                <p className="text-xs opacity-70">Marca todos os meses como obrigatórios</p>
              </button>
              <button 
                onClick={() => setConfig({ ...config!, activeMonths: [] })}
                className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-left transition-all border border-slate-200"
              >
                <p className="font-bold mb-1">Desativar Todos</p>
                <p className="text-xs opacity-70">Remove a obrigatoriedade de todos os meses</p>
              </button>
            </div>
          </div>

          <div className="card-elegant p-8 bg-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Painel de Controle de Acessos</h3>
                <p className="text-sm text-slate-500">Defina o que cada cargo pode visualizar no sistema</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Módulos</th>
                    {['admin', 'gestor', 'gestor_celula', 'professor'].map(role => (
                      <th key={role} className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
                        {role.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'home', label: 'Início / Dashboard' },
                    { id: 'teachers', label: 'Professores' },
                    { id: 'payments', label: 'Pagamentos' },
                    { id: 'reports', label: 'Relatórios' },
                    { id: 'zones', label: 'Zonas' },
                    { id: 'circles', label: 'Círculos' },
                    { id: 'cells', label: 'Células' },
                    { id: 'functions', label: 'Funções' },
                    { id: 'settings', label: 'Configurações' },
                    { id: 'users', label: 'Usuários' }
                  ].map(module => (
                    <tr key={module.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-2">
                        <span className="text-sm font-bold text-slate-700">{module.label}</span>
                      </td>
                      {['admin', 'gestor', 'gestor_celula', 'professor'].map(role => (
                        <td key={role} className="py-4 px-2 text-center">
                          <button
                            onClick={() => togglePermission(role, module.id)}
                            disabled={role === 'admin' && module.id === 'settings'}
                            className={`w-10 h-6 rounded-full transition-all relative ${
                              permissions?.[role]?.[module.id] ? 'bg-brand-primary' : 'bg-slate-200'
                            } ${role === 'admin' && module.id === 'settings' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                              permissions?.[role]?.[module.id] ? 'left-5' : 'left-1'
                            }`} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-xs text-slate-400 italic">
              * Administradores sempre têm acesso ao módulo de Configurações para evitar bloqueio total do sistema.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elegant p-6 bg-amber-50 border-amber-100">
            <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2">
              <RefreshCw size={18} />
              Nota Importante
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              Os meses desativados não serão considerados no cálculo de atrasos e não aparecerão como pendentes nos relatórios de inadimplência.
            </p>
          </div>

          <div className="card-elegant p-6">
            <h4 className="text-slate-900 font-bold mb-4">Resumo do Ano</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-500 font-medium">Meses Letivos</span>
                <span className="font-bold text-slate-900">{config?.activeMonths.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-500 font-medium">Férias/Isentos</span>
                <span className="font-bold text-slate-900">{12 - (config?.activeMonths.length || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
