import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './components/Login';

// Pages
import Home from './pages/Home';
import Teachers from './pages/Teachers';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import GenericCrud from './components/GenericCrud';

import { UserProvider, useUser } from './contexts/UserContext';

function AppContent() {
  const { userProfile, permissions, loading, login, logout } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Login onLoginSuccess={login} />;
  }

  const hasPermission = (module: string) => {
    if (!permissions || !userProfile) return false;
    return permissions[userProfile.role]?.[module];
  };

  return (
    <ErrorBoundary>
      <Router>
        <Layout userProfile={userProfile} onLogout={logout}>
          <Routes>
            <Route path="/" element={hasPermission('home') ? <Home /> : <Navigate to="/" />} />
            <Route path="/teachers" element={hasPermission('teachers') ? <Teachers /> : <Navigate to="/" />} />
            <Route path="/payments" element={hasPermission('payments') ? <Payments /> : <Navigate to="/" />} />
            <Route path="/reports" element={hasPermission('reports') ? <Reports /> : <Navigate to="/" />} />
            <Route path="/settings" element={hasPermission('settings') ? <Settings /> : <Navigate to="/" />} />
            
            {/* Hierarchy Routes */}
            <Route path="/zones" element={hasPermission('zones') ? <GenericCrud collectionName="zones" title="Zonas" /> : <Navigate to="/" />} />
            <Route path="/circles" element={hasPermission('circles') ? <GenericCrud collectionName="circles" title="Círculos" parentCollection="zones" parentField="zoneId" parentLabel="Zona" /> : <Navigate to="/" />} />
            <Route path="/cells" element={hasPermission('cells') ? <GenericCrud collectionName="cells" title="Células" parentCollection="circles" parentField="circleId" parentLabel="Círculo" /> : <Navigate to="/" />} />
            <Route path="/functions" element={hasPermission('functions') ? <GenericCrud collectionName="functions" title="Funções" /> : <Navigate to="/" />} />
            
            {/* Admin Routes */}
            <Route 
              path="/users" 
              element={hasPermission('users') ? <Users /> : <Navigate to="/" />} 
            />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
