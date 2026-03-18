import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Teacher, Payment, Zone, Circle, Cell } from '../types';
import { Users, CreditCard, MapPin, TrendingUp, Calendar } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalZones: 0,
    totalCircles: 0,
    totalCells: 0,
    totalPaymentsThisMonth: 0,
    amountThisMonth: 0
  });

  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
      setStats(prev => ({ ...prev, totalTeachers: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'teachers'));

    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
      setStats(prev => ({ ...prev, totalZones: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'zones'));

    const unsubCircles = onSnapshot(collection(db, 'circles'), (snap) => {
      setStats(prev => ({ ...prev, totalCircles: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'circles'));

    const unsubCells = onSnapshot(collection(db, 'cells'), (snap) => {
      setStats(prev => ({ ...prev, totalCells: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cells'));

    const qPayments = query(
      collection(db, 'payments'),
      where('month', '==', currentMonth),
      where('year', '==', currentYear),
      where('status', '==', 'paid')
    );

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      const amount = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setStats(prev => ({ 
        ...prev, 
        totalPaymentsThisMonth: snap.size,
        amountThisMonth: amount
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payments'));

    return () => {
      unsubTeachers();
      unsubZones();
      unsubCircles();
      unsubCells();
      unsubPayments();
    };
  }, []);

  const cards = [
    { name: 'Total de Professores', value: stats.totalTeachers, icon: Users, color: 'bg-brand-secondary' },
    { name: 'Zonas Ativas', value: stats.totalZones, icon: MapPin, color: 'bg-emerald-400' },
    { name: 'Círculos e Células', value: `${stats.totalCircles} / ${stats.totalCells}`, icon: TrendingUp, color: 'bg-amber-400' },
    { name: 'Pagamentos (Mês Atual)', value: stats.totalPaymentsThisMonth, icon: Calendar, color: 'bg-brand-primary' },
    { name: 'Arrecadação (Mês Atual)', value: `Mt ${stats.amountThisMonth.toLocaleString()}`, icon: CreditCard, color: 'bg-rose-400' },
    { name: 'Relatório Anual', value: 'Ver Detalhes', icon: TrendingUp, color: 'bg-indigo-500', path: '/reports' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            className="px-4 h-[56px] border border-slate-100 rounded-2xl hover:shadow-sm transition-all cursor-pointer bg-white flex items-center gap-3 group active:scale-[0.98]"
            onClick={() => card.path && navigate(card.path)}
          >
            <div className={`${card.color} w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0`}>
              <card.icon size={18} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight truncate">{card.name}</p>
              <span className="text-xs font-black shrink-0" style={{ color: '#cb55e2' }}>({card.value})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
