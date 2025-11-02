
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Login from './pages/Login';
import CharacterLibrary from './pages/CharacterLibrary';
import CreateCharacter from './pages/CreateCharacter';
import CharacterDetail from './pages/CharacterDetail';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
          <Header />
          <main className="p-4 sm:p-6 md:p-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <CharacterLibrary />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/create" 
                element={
                  <ProtectedRoute>
                    <CreateCharacter />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/character/:id" 
                element={
                  <ProtectedRoute>
                    <CharacterDetail />
                  </ProtectedRoute>
                } 
              />
               <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
