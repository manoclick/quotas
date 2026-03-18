export type UserRole = 'admin' | 'gestor' | 'gestor_celula' | 'professor';

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  email?: string;
  name?: string;
  role: UserRole;
}

export interface SystemConfig {
  id: string;
  activeMonths: number[]; // [1, 2, 3, ...]
  year: number;
}

export interface Zone {
  id: string;
  name: string;
}

export interface Circle {
  id: string;
  name: string;
  zoneId: string;
}

export interface Cell {
  id: string;
  name: string;
  circleId: string;
}

export interface TeacherFunction {
  id: string;
  name: string;
}

export interface Teacher {
  id: string;
  name: string;
  zoneId?: string;
  circleId?: string;
  cellId: string;
  functionId?: string;
  cardNumber?: string;
  email?: string;
  contact?: string;
  defaultAmount: number;
  blocked?: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  teacherId: string;
  month: number;
  year: number;
  amount: number;
  status: 'paid' | 'pending';
  paidAt?: string;
  recordedBy?: string;
}
