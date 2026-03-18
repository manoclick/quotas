import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useUser } from '../contexts/UserContext';
import { Teacher, Payment, SystemConfig } from '../types';
import { Search, CheckCircle2, XCircle, Calendar, DollarSign, Plus, X, Users, ShieldAlert, ChevronDown, Check, Triangle } from 'lucide-react';
import { format, isBefore, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';
import Notification from '../components/Notification';

export default function Payments() {
  const { userProfile } = useUser();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [amount, setAmount] = useState(500); // Default amount

  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; teacherId: string; month: number } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<number[]>([]);
  const [activeMonths, setActiveMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);

  const checkPreviousMonthsPaid = (teacherId: string, month: number, year: number) => {
    // Only check months that are active
    const previousActiveMonths = activeMonths.filter(m => m < month);
    
    for (const m of previousActiveMonths) {
      const isPaid = payments.some(p => p.teacherId === teacherId && p.month === m && p.year === year && p.status === 'paid');
      if (!isPaid) return false;
    }
    
    return true;
  };

  const handleConfirmMultiPayment = async () => {
    if (!selectedTeacherId || selectedMonthsToPay.length === 0) return;

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return;

    if (teacher.blocked) {
      setNotification({ message: 'Este professor está bloqueado.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setShowConfirmPayment(false);
    try {
      const sortedMonths = [...selectedMonthsToPay].sort((a, b) => a - b);
      const paymentAmount = teacher.defaultAmount || amount;

      for (const month of sortedMonths) {
        // Sequential check for each month
        const previousActiveMonths = activeMonths.filter(m => m < month);
        
        for (const prevMonth of previousActiveMonths) {
          const isPaid = payments.some(p => p.teacherId === selectedTeacherId && p.month === prevMonth && p.year === selectedYear && p.status === 'paid');
          const isBeingPaid = sortedMonths.includes(prevMonth);
          
          if (!isPaid && !isBeingPaid) {
            setNotification({ 
              message: `Não é possível pagar o mês ${month} sem regularizar todos os meses anteriores em atraso.`, 
              type: 'error' 
            });
            setIsProcessing(false);
            return;
          }
        }

        const existing = payments.find(p => p.teacherId === selectedTeacherId && p.month === month && p.year === selectedYear);
        
        if (existing) {
          if (existing.status === 'pending') {
            await updateDoc(doc(db, 'payments', existing.id), {
              status: 'paid',
              paidAt: new Date().toISOString(),
              recordedBy: userProfile?.username
            });
          }
        } else {
          await addDoc(collection(db, 'payments'), {
            teacherId: selectedTeacherId,
            month,
            year: selectedYear,
            amount: paymentAmount,
            status: 'paid',
            paidAt: new Date().toISOString(),
            recordedBy: userProfile?.username
          });
        }
      }

      setNotification({ message: 'Pagamentos registrados com sucesso!', type: 'success' });
      setIsPaymentModalOpen(false);
      setSelectedTeacherId('');
      setSelectedMonthsToPay([]);
    } catch (error) {
      setNotification({ message: 'Erro ao registrar pagamentos.', type: 'error' });
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMonthSelection = (month: number) => {
    if (!selectedTeacherId) return;
    
    const isSelected = selectedMonthsToPay.includes(month);
    
    if (isSelected) {
      // Unselect this and all months after it to maintain a contiguous range from the start
      setSelectedMonthsToPay(prev => prev.filter(m => m < month));
    } else {
      // Just select the clicked month
      setSelectedMonthsToPay(prev => [...prev, month].sort((a, b) => a - b));
    }
  };

  const handlePayment = async (teacherId: string, month: number) => {
    if (!teacherId) return;

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    if (teacher.blocked) {
      setNotification({ message: 'Este professor está bloqueado e não pode realizar pagamentos.', type: 'error' });
      return;
    }

    if (!activeMonths.includes(month)) {
      setNotification({ message: 'Este mês não está configurado para pagamentos.', type: 'error' });
      return;
    }

    // Check if already paid or pending
    const existing = payments.find(p => p.teacherId === teacherId && p.month === month && p.year === selectedYear);
    if (existing?.status === 'paid') {
      setNotification({ message: 'Este mês já está pago.', type: 'error' });
      return;
    }

    // Sequential check
    if (!checkPreviousMonthsPaid(teacherId, month, selectedYear)) {
      setNotification({ message: 'Não é possível pagar este mês antes de regularizar os meses em atraso.', type: 'error' });
      return;
    }

    try {
      const paymentAmount = teacher.defaultAmount || amount;

      if (existing) {
        // Update pending to paid
        await updateDoc(doc(db, 'payments', existing.id), {
          status: 'paid',
          paidAt: new Date().toISOString(),
          recordedBy: userProfile?.username
        });
      } else {
        // Create new paid record
        await addDoc(collection(db, 'payments'), {
          teacherId,
          month,
          year: selectedYear,
          amount: paymentAmount,
          status: 'paid',
          paidAt: new Date().toISOString(),
          recordedBy: userProfile?.username
        });
      }
      setNotification({ message: 'Pagamento registrado com sucesso!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Erro ao registrar pagamento.', type: 'error' });
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'teachers'));

    const qPayments = query(
      collection(db, 'payments'),
      where('year', '==', selectedYear)
    );

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payments'));

    const unsubConfig = onSnapshot(doc(db, 'system_configs', `config_${selectedYear}`), (docSnap) => {
      if (docSnap.exists()) {
        setActiveMonths(docSnap.data().activeMonths || []);
      } else {
        setActiveMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
    });

    return () => {
      unsubTeachers();
      unsubPayments();
      unsubConfig();
    };
  }, [selectedYear]);

  useEffect(() => {
    if (selectedTeacherId) {
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      if (teacher?.defaultAmount) {
        setAmount(teacher.defaultAmount);
      }
    }
  }, [selectedTeacherId, teachers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const teacherId = params.get('teacher');
    if (teacherId && teachers.length > 0) {
      setSelectedTeacherId(teacherId);
      setIsPaymentModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [teachers]);

  const togglePayment = async (teacherId: string, month: number) => {
    const existing = payments.find(p => p.teacherId === teacherId && p.month === month && p.year === selectedYear);
    
    if (existing) {
      setConfirmConfig({ isOpen: true, teacherId, month });
      return;
    }

    // Use the new handlePayment logic which includes sequential check
    await handlePayment(teacherId, month);
  };

  const handleConfirmDelete = async () => {
    if (!confirmConfig) return;
    const existing = payments.find(p => p.teacherId === confirmConfig.teacherId && p.month === confirmConfig.month && p.year === selectedYear);
    if (!existing) return;

    try {
      await deleteDoc(doc(db, 'payments', existing.id));
      setNotification({ message: 'Pagamento removido!', type: 'success' });
      setConfirmConfig(null);
    } catch (error) {
      setNotification({ message: 'Erro ao remover pagamento.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, `payments/${existing.id}`);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.cardNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="space-y-1 flex-1 md:flex-none">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ano de Referência</label>
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-brand-primary" />
              <select 
                className="bg-transparent font-bold text-brand-ink outline-none cursor-pointer"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200 hidden md:block" />
        </div>

        <div className="relative w-full md:w-96 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Filtrar professor..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} />
            Pagar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr>
              <th 
                className="px-6 py-3 text-xs font-bold text-white uppercase tracking-widest sticky left-0 z-10"
                style={{ backgroundColor: '#363636' }}
              >
                Professor
              </th>
              {months.map(m => (
                <th 
                  key={m} 
                  className="px-4 py-3 text-center text-[10px] font-bold text-white uppercase tracking-widest"
                  style={{ backgroundColor: '#363636' }}
                >
                  {format(new Date(2024, m - 1), 'MMM', { locale: ptBR })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher, idx) => (
              <tr 
                key={teacher.id} 
                style={{ backgroundColor: idx % 2 === 0 ? '#cbf1f6' : '#f2f2f3' }}
                className="transition-colors hover:opacity-80"
              >
                <td className="px-6 py-2 sticky left-0 z-10 font-bold text-slate-900 truncate max-w-[200px] text-xs uppercase bg-inherit">
                  {teacher.name}
                </td>
                  {months.map(m => {
                    const payment = payments.find(p => p.teacherId === teacher.id && p.month === m && p.year === selectedYear);
                    const status = payment ? payment.status : 'unpaid';
                    const isActive = activeMonths.includes(m);
                    
                    const currentYear = new Date().getFullYear();
                    const currentMonth = new Date().getMonth() + 1;
                    const isOverdue = isActive && status === 'unpaid' && (
                      selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)
                    );
                    
                    let color = 'text-slate-200';
                    let icon = null;
                    
                    if (status === 'paid') {
                      color = 'text-[#493dff]';
                      icon = <Check size={16} strokeWidth={4} />;
                    } else if (status === 'pending') {
                      color = 'text-[#efee4d]';
                      icon = <Triangle size={14} fill="currentColor" className="stroke-slate-400/20" />;
                    } else if (isActive) {
                      if (isOverdue) {
                        color = 'text-[#f05d4c]';
                        icon = <X size={16} strokeWidth={4} />;
                      } else {
                        color = 'text-slate-300';
                        icon = <X size={16} strokeWidth={2} />;
                      }
                    } else {
                      icon = <X size={14} className="opacity-10" />;
                    }

                    const isPreviousUnpaid = !checkPreviousMonthsPaid(teacher.id, m, selectedYear);

                    return (
                      <td key={m} className="px-1 py-1 text-center">
                        <button
                          disabled={!isActive || teacher.blocked || (status === 'unpaid' && isPreviousUnpaid)}
                          onClick={() => togglePayment(teacher.id, m)}
                          className={`w-full h-8 flex items-center justify-center transition-all ${color} ${teacher.blocked || (status === 'unpaid' && isPreviousUnpaid) ? 'grayscale opacity-30 cursor-not-allowed' : ''}`}
                          title={!isActive ? 'Mês inativo' : teacher.blocked ? 'Professor bloqueado' : isPreviousUnpaid ? 'Regularize os meses anteriores primeiro' : ''}
                        >
                          {icon}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      <ConfirmDialog
        isOpen={showConfirmPayment}
        title="Confirmar Pagamento"
        message={`Deseja confirmar o pagamento de ${selectedMonthsToPay.length} ${selectedMonthsToPay.length === 1 ? 'mês' : 'meses'} para o professor ${teachers.find(t => t.id === selectedTeacherId)?.name}? Total: Mt ${(amount * selectedMonthsToPay.length).toLocaleString('pt-MZ')}`}
        onConfirm={handleConfirmMultiPayment}
        onCancel={() => setShowConfirmPayment(false)}
      />

      <ConfirmDialog
        isOpen={!!confirmConfig?.isOpen}
        title="Remover Pagamento"
        message="Deseja remover este registro de pagamento?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmConfig(null)}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Registrar Pagamento</h3>
                <p className="text-sm text-slate-500 font-medium">Selecione o professor e o mês para pagar</p>
              </div>
              <button 
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedTeacherId('');
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
              <button
                disabled={!selectedTeacherId || selectedMonthsToPay.length === 0 || isProcessing}
                onClick={() => setShowConfirmPayment(true)}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center"
              >
                {isProcessing ? 'Processando...' : 'Confirmar'}
              </button>
              <button 
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedTeacherId('');
                  setSelectedMonthsToPay([]);
                }}
                className="btn-secondary w-full py-3 flex items-center justify-center"
              >
                Cancelar
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Professor</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={selectedTeacherId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTeacherId(id);
                      const teacher = teachers.find(t => t.id === id);
                      if (teacher?.defaultAmount) {
                        setAmount(teacher.defaultAmount);
                      }
                    }}
                  >
                    <option value="">Selecionar Professor</option>
                    {teachers.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTeacherId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={16} className="text-brand-primary" />
                      Meses a Pagar - {selectedYear}
                    </h4>
                    {teachers.find(t => t.id === selectedTeacherId)?.blocked && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full flex items-center gap-1">
                        <ShieldAlert size={12} />
                        Professor Bloqueado
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <label className="text-sm font-bold text-slate-700 mb-2 block">Selecione os Meses</label>
                    <button
                      type="button"
                      disabled={teachers.find(t => t.id === selectedTeacherId)?.blocked}
                      onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-400 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <span className="text-slate-700 font-medium">
                        {selectedMonthsToPay.length === 0 
                          ? 'Clique para selecionar os meses' 
                          : `${selectedMonthsToPay.length} ${selectedMonthsToPay.length === 1 ? 'mês selecionado' : 'meses selecionados'}`
                        }
                      </span>
                      <ChevronDown size={20} className={`text-slate-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMonthDropdownOpen && (
                      <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {months.map(m => {
                          const payment = payments.find(p => p.teacherId === selectedTeacherId && p.month === m && p.year === selectedYear);
                          const status = payment ? payment.status : 'unpaid';
                          const isActive = activeMonths.includes(m);
                          const isSelected = selectedMonthsToPay.includes(m);
                          
                          const currentYear = new Date().getFullYear();
                          const currentMonth = new Date().getMonth() + 1;
                          const isOverdue = isActive && status === 'unpaid' && (
                            selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)
                          );

                          const previousActiveMonths = activeMonths.filter(prevM => prevM < m);
                          const hasUnpaidPrevious = previousActiveMonths.some(prevM => {
                            const isPaid = payments.some(p => p.teacherId === selectedTeacherId && p.month === prevM && p.year === selectedYear && p.status === 'paid');
                            const isSelected = selectedMonthsToPay.includes(prevM);
                            return !isPaid && !isSelected;
                          });

                          const isDisabled = status === 'paid' || status === 'pending' || hasUnpaidPrevious;

                          return (
                            <div 
                              key={m}
                              onClick={() => !isDisabled && toggleMonthSelection(m)}
                              className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer mb-1 last:mb-0 ${
                                isSelected ? 'bg-indigo-50 text-indigo-700' : 
                                isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                <span className="text-sm font-bold uppercase">{format(new Date(2024, m - 1), 'MMMM', { locale: ptBR })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {status === 'paid' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pago</span>}
                                {status === 'pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendente</span>}
                                {!isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">Isento</span>}
                                {isOverdue && !isSelected && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Atrasado</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedMonthsToPay.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[...selectedMonthsToPay].sort((a, b) => a - b).map(m => (
                        <span key={m} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                          {format(new Date(2024, m - 1), 'MMM', { locale: ptBR })}
                          <button onClick={() => toggleMonthSelection(m)} className="hover:text-indigo-900">
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedMonthsToPay.length > 0 && (
                    <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total a Pagar</p>
                        <p className="text-xl font-black text-indigo-900">
                          Mt {(amount * selectedMonthsToPay.length).toLocaleString('pt-MZ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedTeacherId && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Users size={48} className="mb-4 opacity-20" />
                  <p className="font-medium">Selecione um professor para iniciar o pagamento</p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
