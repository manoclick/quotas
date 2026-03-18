import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Teacher, Zone, Circle, Cell, TeacherFunction } from '../types';
import { Plus, Trash2, Edit2, Search, X, ShieldAlert, ShieldCheck } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Notification from '../components/Notification';

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [functions, setFunctions] = useState<TeacherFunction[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBlocked, setFilterBlocked] = useState<'all' | 'active' | 'blocked'>('all');

  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; id: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    zoneId: '',
    circleId: '',
    cellId: '',
    functionId: '',
    cardNumber: '',
    email: '',
    contact: '',
    defaultAmount: 500
  });

  useEffect(() => {
    const unsubTeachers = onSnapshot(query(collection(db, 'teachers'), orderBy('name')), (snap) => {
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'teachers'));

    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
      setZones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'zones'));

    const unsubCircles = onSnapshot(collection(db, 'circles'), (snap) => {
      setCircles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Circle)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'circles'));

    const unsubCells = onSnapshot(collection(db, 'cells'), (snap) => {
      setCells(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cell)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cells'));

    const unsubFunctions = onSnapshot(collection(db, 'functions'), (snap) => {
      setFunctions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherFunction)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'functions'));

    return () => {
      unsubTeachers();
      unsubZones();
      unsubCircles();
      unsubCells();
      unsubFunctions();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId && teachers.length > 0) {
      const teacher = teachers.find(t => t.id === editId);
      if (teacher) {
        startEdit(teacher);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [teachers]);

  const filteredCircles = circles.filter(c => c.zoneId === formData.zoneId);
  const filteredCells = cells.filter(c => c.circleId === formData.circleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'teachers', editingId), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        setNotification({ message: 'Professor atualizado com sucesso!', type: 'success' });
      } else {
        await addDoc(collection(db, 'teachers'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        setNotification({ message: 'Professor cadastrado com sucesso!', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', zoneId: '', circleId: '', cellId: '', functionId: '', cardNumber: '', email: '', contact: '', defaultAmount: 500 });
    } catch (error) {
      setNotification({ message: 'Erro ao salvar professor.', type: 'error' });
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'teachers');
    }
  };

  const handleDelete = async () => {
    if (!confirmConfig) return;
    try {
      await deleteDoc(doc(db, 'teachers', confirmConfig.id));
      setNotification({ message: 'Professor excluído com sucesso!', type: 'success' });
      setConfirmConfig(null);
    } catch (error) {
      setNotification({ message: 'Erro ao excluir professor.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, `teachers/${confirmConfig.id}`);
    }
  };

  const handleToggleBlock = async (teacher: Teacher) => {
    try {
      await updateDoc(doc(db, 'teachers', teacher.id), {
        blocked: !teacher.blocked
      });
      setNotification({ 
        message: `Professor ${!teacher.blocked ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 
        type: 'success' 
      });
    } catch (error) {
      setNotification({ message: 'Erro ao alterar status do professor.', type: 'error' });
      handleFirestoreError(error, OperationType.UPDATE, `teachers/${teacher.id}`);
    }
  };

  const startEdit = (teacher: Teacher) => {
    setEditingId(teacher.id);
    setFormData({
      name: teacher.name,
      zoneId: teacher.zoneId,
      circleId: teacher.circleId,
      cellId: teacher.cellId,
      functionId: teacher.functionId,
      cardNumber: teacher.cardNumber,
      email: teacher.email || '',
      contact: teacher.contact || '',
      defaultAmount: teacher.defaultAmount || 500
    });
    setIsModalOpen(true);
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.cardNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    if (filterBlocked === 'active') return matchesSearch && !t.blocked;
    if (filterBlocked === 'blocked') return matchesSearch && t.blocked;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou cartão..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold text-slate-600"
            value={filterBlocked}
            onChange={(e) => setFilterBlocked(e.target.value as any)}
          >
            <option value="all">Todos os Professores</option>
            <option value="active">Apenas Ativos</option>
            <option value="blocked">Apenas Bloqueados</option>
          </select>
        </div>
        <button
          onClick={() => { 
            setEditingId(null); 
            setFormData({ 
              name: '', 
              zoneId: '', 
              circleId: '', 
              cellId: '', 
              functionId: '', 
              cardNumber: '', 
              email: '', 
              contact: '', 
              defaultAmount: 500 
            }); 
            setIsModalOpen(true); 
          }}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Novo Professor
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100" style={{ backgroundColor: '#363636' }}>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Professor</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Hierarquia</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Função</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest">Cartão</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher, idx) => (
              <tr 
                key={teacher.id} 
                style={{ backgroundColor: idx % 2 === 0 ? '#cbf1f6' : '#f2f2f3' }}
                className="transition-colors hover:opacity-80"
              >
                <td className={`px-6 py-2 ${teacher.blocked ? 'opacity-50' : ''}`}>
                  <p className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase">
                    {teacher.name}
                    {teacher.blocked && <ShieldAlert size={14} className="text-red-500" />}
                  </p>
                  <p className="text-[10px] text-slate-500">{teacher.email || 'Sem email'}</p>
                </td>
                <td className="px-6 py-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md uppercase">
                      {zones.find(z => z.id === teacher.zoneId)?.name || 'N/A'}
                    </span>
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md uppercase">
                      {circles.find(c => c.id === teacher.circleId)?.name || 'N/A'}
                    </span>
                    <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-md uppercase">
                      {cells.find(c => c.id === teacher.cellId)?.name || 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-2">
                  <span className="text-sm text-slate-600">
                    {functions.find(f => f.id === teacher.functionId)?.name || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-2">
                  <span className="font-mono text-sm text-slate-700">{teacher.cardNumber}</span>
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleToggleBlock(teacher)} 
                      title={teacher.blocked ? "Desbloquear" : "Bloquear"}
                      className={`p-2 rounded-lg transition-all ${
                        teacher.blocked 
                          ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' 
                          : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                      }`}
                    >
                      {teacher.blocked ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                    </button>
                    <button onClick={() => startEdit(teacher)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setConfirmConfig({ isOpen: true, id: teacher.id })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      <ConfirmDialog
        isOpen={!!confirmConfig?.isOpen}
        title="Excluir Professor"
        message="Tem certeza que deseja excluir este professor do sistema?"
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
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Editar Professor' : 'Novo Professor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nome Completo</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nr. do Cartão</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contacto</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Zona</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.zoneId}
                    onChange={(e) => setFormData({ ...formData, zoneId: e.target.value, circleId: '', cellId: '' })}
                  >
                    <option value="">Selecionar Zona</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Círculo</label>
                  <select
                    disabled={!formData.zoneId}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 text-sm"
                    value={formData.circleId}
                    onChange={(e) => setFormData({ ...formData, circleId: e.target.value, cellId: '' })}
                  >
                    <option value="">Selecionar Círculo</option>
                    {filteredCircles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Célula</label>
                  <select
                    required
                    disabled={!formData.circleId}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 text-sm"
                    value={formData.cellId}
                    onChange={(e) => setFormData({ ...formData, cellId: e.target.value })}
                  >
                    <option value="">Selecionar Célula</option>
                    {filteredCells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Função</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={formData.functionId}
                    onChange={(e) => setFormData({ ...formData, functionId: e.target.value })}
                  >
                    <option value="">Selecionar Função</option>
                    {functions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2 text-sm"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Professor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
