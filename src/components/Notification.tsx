import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export default function Notification({ message, type, onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      <p className="font-bold text-sm">{message}</p>
      <button onClick={onClose} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}
