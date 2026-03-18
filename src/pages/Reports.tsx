import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Teacher, Payment, SystemConfig, Cell } from '../types';
import { Search, Calendar, DollarSign, Download, FileText, Filter, ShieldAlert, Edit2, CreditCard, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';
import Notification from '../components/Notification';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [activeMonths, setActiveMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCell, setSelectedCell] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; id: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const generatePDF = (cellId?: string) => {
    // Se cellId for fornecido, filtramos os professores daquela célula específica
    // Caso contrário, usamos os professores já filtrados pela busca/filtro da tela
    const tableTeachers = cellId 
      ? teachers.filter(t => t.cellId?.toString().trim() === cellId.toString().trim())
      : filteredTeachers;

    if (tableTeachers.length === 0) {
      setNotification({ message: 'Não há dados para exportar para esta seleção.', type: 'error' });
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const targetCell = cellId ? cells.find(c => c.id === cellId) : null;
    const title = targetCell ? `Relatório de Quotas - Célula: ${targetCell.name}` : 'Relatório Geral de Quotas';
    
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Ano: ${selectedYear} | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

    const head = [
      'Professor',
      ...months.map(m => format(new Date(2024, m - 1), 'MMM', { locale: ptBR }).toUpperCase()),
      'Total'
    ];

    const body = tableTeachers.map(t => {
      const row = [t.name.toUpperCase()];
      months.forEach(m => {
        const p = getTeacherPaymentForMonth(t.id, m);
        const isActive = activeMonths.includes(m);
        if (p) {
          row.push(`${p.amount.toLocaleString('pt-MZ')} MT`);
        } else {
          row.push(isActive ? '—' : 'N/A');
        }
      });
      row.push(`${calculateTeacherTotal(t.id).toLocaleString('pt-MZ')} MT`);
      return row;
    });

    autoTable(doc, {
      head: [head],
      body: body,
      startY: 30,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [54, 54, 54], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        [head.length - 1]: { fontStyle: 'bold', halign: 'right' }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.text(`Página ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
      }
    });

    const fileName = targetCell 
      ? `Relatorio_Quotas_${targetCell.name.replace(/\s+/g, '_')}_${selectedYear}.pdf`
      : `Relatorio_Quotas_Geral_${selectedYear}.pdf`;
      
    doc.save(fileName);
  };

  const generateAllCellsPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    let hasData = false;
    let firstPage = true;
    
    // Ordenar células por nome para o relatório
    const sortedCells = [...cells].sort((a, b) => a.name.localeCompare(b.name));

    sortedCells.forEach((cell) => {
      const cellTeachers = teachers.filter(t => t.cellId?.toString().trim() === cell.id.toString().trim());
      if (cellTeachers.length === 0) return; // Pula células sem professores

      hasData = true;
      if (!firstPage) doc.addPage();
      firstPage = false;
      
      doc.setFontSize(18);
      doc.text(`Relatório de Quotas - Célula: ${cell.name}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Ano: ${selectedYear} | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

      const head = [
        'Professor',
        ...months.map(m => format(new Date(2024, m - 1), 'MMM', { locale: ptBR }).toUpperCase()),
        'Total'
      ];

      const body = cellTeachers.map(t => {
        const row = [t.name.toUpperCase()];
        months.forEach(m => {
          const p = getTeacherPaymentForMonth(t.id, m);
          const isActive = activeMonths.includes(m);
          if (p) {
            row.push(`${p.amount.toLocaleString('pt-MZ')} MT`);
          } else {
            row.push(isActive ? '—' : 'N/A');
          }
        });
        row.push(`${calculateTeacherTotal(t.id).toLocaleString('pt-MZ')} MT`);
        return row;
      });

      autoTable(doc, {
        head: [head],
        body: body,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [54, 54, 54], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          [head.length - 1]: { fontStyle: 'bold', halign: 'right' }
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.text(`Página ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        }
      });
    });

    if (!hasData) {
      setNotification({ message: 'Nenhuma célula possui professores cadastrados para este ano.', type: 'error' });
      return;
    }

    doc.save(`Relatorio_Quotas_Todas_Celulas_${selectedYear}.pdf`);
  };

  useEffect(() => {
    setLoading(true);
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'teachers'));

    const unsubCells = onSnapshot(collection(db, 'cells'), (snap) => {
      setCells(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cell)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cells'));

    const qPayments = query(
      collection(db, 'payments'),
      where('year', '==', selectedYear),
      where('status', '==', 'paid')
    );

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      setLoading(false);
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
      unsubCells();
      unsubPayments();
      unsubConfig();
    };
  }, [selectedYear]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.cardNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCell = selectedCell ? t.cellId === selectedCell : true;
    return matchesSearch && matchesCell;
  });

  const handleDeleteTeacher = async () => {
    if (!confirmConfig) return;
    try {
      await deleteDoc(doc(db, 'teachers', confirmConfig.id));
      setNotification({ message: 'Professor removido com sucesso!', type: 'success' });
      setConfirmConfig(null);
    } catch (error) {
      setNotification({ message: 'Erro ao remover professor.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, `teachers/${confirmConfig.id}`);
    }
  };

  const getTeacherPaymentForMonth = (teacherId: string, month: number) => {
    return payments.find(p => p.teacherId === teacherId && p.month === month);
  };

  const calculateTeacherTotal = (teacherId: string) => {
    return payments
      .filter(p => p.teacherId === teacherId)
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const grandTotal = payments.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-brand-primary to-brand-secondary text-slate-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Arrecadado</span>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-black">
              Mt {grandTotal.toLocaleString('pt-MZ')}
            </h3>
            <p className="text-[10px] opacity-80 font-medium">Ano {selectedYear}</p>
          </div>
        </div>

        <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
              <FileText size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pagamentos</span>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-black text-slate-900">{payments.length} Mt</h3>
            <p className="text-[10px] text-slate-500 font-medium">Confirmados</p>
          </div>
        </div>

        <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
              <Calendar size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ano Fiscal</span>
          </div>
          <div className="text-right">
            <select 
              className="text-xl font-black text-slate-900 bg-transparent outline-none cursor-pointer"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <p className="text-[10px] text-slate-500 font-medium">Filtrar</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <Filter size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Relatório Detalhado</h3>
          </div>
          
          <select
            className="w-full md:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-semibold text-slate-600"
            value={selectedCell}
            onChange={(e) => setSelectedCell(e.target.value)}
          >
            <option value="">Todas as Células</option>
            {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Filtrar professor..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1500px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-widest sticky left-0 z-10 w-[6cm]" style={{ backgroundColor: '#363636' }}>Professor</th>
              {months.map(m => (
                <th key={m} className={`px-2 py-3 text-center text-[9px] font-bold uppercase tracking-widest ${!activeMonths.includes(m) ? 'text-white/50' : 'text-white'}`} style={{ backgroundColor: '#363636' }}>
                  {format(new Date(2024, m - 1), 'MMM', { locale: ptBR })}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-[10px] font-bold text-white uppercase tracking-widest" style={{ backgroundColor: '#363636' }}>Total</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-white uppercase tracking-widest" style={{ backgroundColor: '#363636' }} colSpan={3}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher, idx) => {
              const teacherTotal = calculateTeacherTotal(teacher.id);
              return (
                <tr 
                  key={teacher.id} 
                  style={{ backgroundColor: idx % 2 === 0 ? '#cbf1f6' : '#f2f2f3' }}
                  className={`transition-colors hover:opacity-80 ${teacher.blocked ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-2 sticky left-0 bg-inherit z-10 w-[6cm]">
                    <div className="flex items-center gap-2">
                      <div className="w-full">
                        <p className="font-bold text-slate-900 truncate max-w-[5.5cm] text-xs uppercase">{teacher.name}</p>
                        <p className="text-[9px] font-mono text-slate-400">{teacher.cardNumber || 'S/N'}</p>
                      </div>
                      {teacher.blocked && (
                        <ShieldAlert size={12} className="text-red-500" />
                      )}
                    </div>
                  </td>
                    {months.map(m => {
                      const payment = getTeacherPaymentForMonth(teacher.id, m);
                      const isActive = activeMonths.includes(m);
                      return (
                        <td key={m} className={`px-1 py-2 text-center ${!isActive ? 'bg-slate-50/50' : ''}`}>
                          {payment ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-bold text-emerald-600">
                                {payment.amount.toLocaleString('pt-MZ')}
                              </span>
                              <span className="text-[7px] text-slate-400 uppercase font-bold">MT</span>
                            </div>
                          ) : (
                            <span className={`text-[10px] text-slate-200 ${!isActive ? 'opacity-20' : ''}`}>{isActive ? '—' : 'N/A'}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right bg-brand-primary/5">
                      <p className="font-black text-brand-primary text-sm">
                        {teacherTotal.toLocaleString('pt-MZ')}
                      </p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase">Meticais</p>
                    </td>
                    
                    {/* Actions Columns */}
                    <td className="p-0 border-l border-slate-100">
                      <button 
                        onClick={() => navigate(`/teachers?edit=${teacher.id}`)}
                        className="w-full h-full py-2 flex items-center justify-center text-white hover:opacity-90 transition-colors"
                        style={{ backgroundColor: '#cb55e2' }}
                        title="Editar Professor"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                    <td className="p-0 border-l border-slate-100">
                      <button 
                        onClick={() => navigate(`/payments?teacher=${teacher.id}`)}
                        className="w-full h-full py-2 flex items-center justify-center text-white hover:opacity-90 transition-colors"
                        style={{ backgroundColor: '#cb55e2' }}
                        title="Ir para Pagamentos"
                      >
                        <CreditCard size={14} />
                      </button>
                    </td>
                    <td className="p-0 border-l border-slate-100">
                      <button 
                        onClick={() => setConfirmConfig({ isOpen: true, id: teacher.id })}
                        className="w-full h-full py-2 flex items-center justify-center text-white hover:opacity-90 transition-colors"
                        style={{ backgroundColor: '#cb55e2' }}
                        title="Apagar Professor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-white" style={{ backgroundColor: '#363636' }}>
                <td className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Total Geral</td>
                {months.map(m => {
                  const monthTotal = payments
                    .filter(p => p.month === m)
                    .reduce((acc, curr) => acc + curr.amount, 0);
                  return (
                    <td key={m} className="px-1 py-3 text-center">
                      <span className="text-[8px] font-bold opacity-60 block mb-0.5">
                        {format(new Date(2024, m - 1), 'MMM', { locale: ptBR }).toUpperCase()}
                      </span>
                      <span className="text-[11px] font-black">
                        {monthTotal.toLocaleString('pt-MZ')}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right bg-brand-primary text-white">
                  <p className="text-[8px] font-bold opacity-80 uppercase mb-0.5">Anual</p>
                  <p className="text-base font-black">
                    {grandTotal.toLocaleString('pt-MZ')}
                  </p>
                </td>
                <td colSpan={3} style={{ backgroundColor: '#363636' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Baixar PDF:</span>
          <button 
            onClick={() => generatePDF()}
            className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs"
          >
            <Download size={14} />
            Geral
          </button>
          <button 
            onClick={() => generateAllCellsPDF()}
            className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs"
          >
            <Download size={14} />
            Todas Células
          </button>
          <button 
            disabled={!selectedCell}
            onClick={() => generatePDF(selectedCell)}
            className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs disabled:opacity-50"
          >
            <Download size={14} />
            {selectedCell ? `Célula: ${cells.find(c => c.id === selectedCell)?.name}` : 'Por Célula'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmConfig?.isOpen}
        title="Remover Professor"
        message="Tem certeza que deseja remover este professor do sistema? Esta ação é irreversível."
        onConfirm={handleDeleteTeacher}
        onCancel={() => setConfirmConfig(null)}
      />

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
