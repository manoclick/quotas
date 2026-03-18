import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Notification from './Notification';

interface GenericCrudProps {
  collectionName: string;
  title: string;
  parentCollection?: string;
  parentField?: string;
  parentLabel?: string;
}

export default function GenericCrud({ collectionName, title, parentCollection, parentField, parentLabel }: GenericCrudProps) {
  const [items, setItems] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', parentId: '' });
  
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; id: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, collectionName), orderBy('name')), (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, collectionName));

    let unsubParent = () => {};
    if (parentCollection) {
      unsubParent = onSnapshot(query(collection(db, parentCollection), orderBy('name')), (snap) => {
        setParents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.GET, parentCollection));
    }

    return () => {
      unsub();
      unsubParent();
    };
  }, [collectionName, parentCollection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = { name: formData.name };
      if (parentField) data[parentField] = formData.parentId;

      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), data);
        setNotification({ message: 'Registro atualizado com sucesso!', type: 'success' });
      } else {
        await addDoc(collection(db, collectionName), data);
        setNotification({ message: 'Registro criado com sucesso!', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', parentId: '' });
    } catch (error) {
      setNotification({ message: 'Erro ao salvar registro.', type: 'error' });
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, collectionName);
    }
  };

  const handleDelete = async () => {
    if (!confirmConfig) return;
    try {
      await deleteDoc(doc(db, collectionName, confirmConfig.id));
      setNotification({ message: 'Registro excluído com sucesso!', type: 'success' });
      setConfirmConfig(null);
    } catch (error) {
      setNotification({ message: 'Erro ao excluir registro.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${confirmConfig.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand-ink">{title}</h2>
        <button
          onClick={() => { setEditingId(null); setFormData({ name: '', parentId: '' }); setIsModalOpen(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Registro
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100" style={{ backgroundColor: '#F3F0F9' }}>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nome</th>
              {parentLabel && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{parentLabel}</th>}
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr 
                key={item.id} 
                style={{ backgroundColor: idx % 2 === 0 ? '#cbf1f6' : '#f2f2f3' }}
                className="hover:opacity-80 transition-colors"
              >
                <td className="px-6 py-4 font-bold text-slate-900 text-xs uppercase">{item.name}</td>
                {parentLabel && (
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {parents.find(p => p.id === item[parentField!])?.name || 'N/A'}
                  </td>
                )}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        setEditingId(item.id);
                        setFormData({ name: item.name, parentId: item[parentField!] || '' });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setConfirmConfig({ isOpen: true, id: item.id })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      <ConfirmDialog
        isOpen={!!confirmConfig?.isOpen}
        title="Excluir Registro"
        message={`Tem certeza que deseja excluir este item de ${title}?`}
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Editar' : 'Novo'} {title}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Nome</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              {parentCollection && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">{parentLabel}</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  >
                    <option value="">Selecionar {parentLabel}</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
