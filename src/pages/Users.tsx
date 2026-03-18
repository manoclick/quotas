import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole, Cell } from '../types';
import { Plus, Trash2, Shield, X, Mail, User, Lock, Layout, ArrowLeft, Edit2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Notification from '../components/Notification';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'professor' as UserRole, cellId: '' });
  
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; id: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('username')), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubCells = onSnapshot(query(collection(db, 'cells'), orderBy('name')), (snap) => {
      setCells(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cell)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cells'));

    return () => {
      unsubUsers();
      unsubCells();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = editingId || formData.username.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      const userData: any = {
        username: formData.username,
        password: formData.password,
        name: formData.name,
        role: formData.role
      };
      if (formData.role === 'gestor_celula') {
        userData.cellId = formData.cellId;
      }

      await setDoc(doc(db, 'users', userId), userData);
      setNotification({ message: editingId ? 'Gestor atualizado com sucesso!' : 'Gestor adicionado com sucesso!', type: 'success' });
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ username: '', password: '', name: '', role: 'professor', cellId: '' });
    } catch (error) {
      setNotification({ message: editingId ? 'Erro ao atualizar gestor.' : 'Erro ao adicionar gestor.', type: 'error' });
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingId(user.id);
    setFormData({
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
      cellId: user.cellId || ''
    });
    setIsModalOpen(true);
  };

  const handleUpdateRole = async (id: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole });
      setNotification({ message: 'Nível de acesso atualizado!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Erro ao atualizar nível de acesso.', type: 'error' });
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDelete = async () => {
    if (!confirmConfig) return;
    try {
      await deleteDoc(doc(db, 'users', confirmConfig.id));
      setNotification({ message: 'Gestor removido com sucesso!', type: 'success' });
      setConfirmConfig(null);
    } catch (error) {
      setNotification({ message: 'Erro ao remover gestor.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, `users/${confirmConfig.id}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand-primary hover:border-brand-primary transition-all"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-brand-ink">Gestores do Sistema</h2>
            <p className="text-slate-500">Gerencie quem pode acessar e editar as informações do app.</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Adicionar Gestor
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100" style={{ backgroundColor: '#363636' }}>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Nome</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Usuários</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Senha</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Nível de Acesso</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr 
                key={user.id} 
                style={{ backgroundColor: idx % 2 === 0 ? '#cbf1f6' : '#f2f2f3' }}
                className="transition-colors hover:opacity-80"
              >
                <td className="px-6 py-3">
                  <p className="font-bold text-slate-900 text-xs uppercase">{user.name || 'Sem Nome'}</p>
                </td>
                <td className="px-6 py-3">
                  <p className="text-xs text-slate-600 font-medium">@{user.username}</p>
                </td>
                <td className="px-6 py-3">
                  <p className="text-xs font-mono text-slate-600">{user.password}</p>
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-col">
                    <select
                      className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer"
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="gestor">Gestor</option>
                      <option value="gestor_celula">Gestor da Célula</option>
                      <option value="professor">Professor</option>
                    </select>
                    {user.role === 'gestor_celula' && (
                      <span className="text-[10px] text-brand-primary font-bold">
                        {cells.find(c => c.id === user.cellId)?.name || 'Célula não definida'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                  <button 
                    onClick={() => handleEdit(user)}
                    className="p-2 text-white rounded-lg transition-all hover:opacity-80"
                    style={{ backgroundColor: '#0000FF' }}
                    title="Editar Gestor"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => setConfirmConfig({ isOpen: true, id: user.id })}
                    className="p-2 text-white rounded-lg transition-all hover:opacity-80"
                    style={{ backgroundColor: '#FF0000' }}
                    title="Remover Gestor"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!confirmConfig?.isOpen}
        title="Remover Gestor"
        message="Tem certeza que deseja remover este gestor do sistema?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmConfig(null)}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="text-2xl font-bold text-slate-900">{editingId ? 'Editar Gestor' : 'Novo Gestor'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); setFormData({ username: '', password: '', name: '', role: 'professor', cellId: '' }); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User size={16} /> Nome
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User size={16} /> Usuário
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="ex: joao_silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Lock size={16} /> Senha
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Defina uma senha"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Shield size={16} /> Nível de Acesso
                </label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <option value="admin">Administrador (Acesso Total)</option>
                  <option value="gestor">Gestor (Edição)</option>
                  <option value="gestor_celula">Gestor da Célula</option>
                  <option value="professor">Professor (Leitura)</option>
                </select>
              </div>

              {formData.role === 'gestor_celula' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Layout size={16} /> Célula Responsável
                  </label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.cellId}
                    onChange={(e) => setFormData({ ...formData, cellId: e.target.value })}
                  >
                    <option value="">Selecionar Célula</option>
                    {cells.map(cell => (
                      <option key={cell.id} value={cell.id}>{cell.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); setFormData({ username: '', password: '', name: '', role: 'professor', cellId: '' }); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  {editingId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
