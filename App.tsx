import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import TopicSelector from './pages/TopicSelector';
import ContentEditor from './pages/ContentEditor';
import ClientsList from './pages/ClientsList';
import ClientDetail from './pages/ClientDetail';
import { UserRole } from './types';

const App: React.FC = () => {
  // Mock auth state for demo
  const [session, setSession] = useState<boolean>(true); // Assume logged in for demo
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADVISOR); // Change this to test other roles

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          session ? (
            <Layout userRole={userRole}>
              <Dashboard userRole={userRole} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/topics" element={
          session ? (
            <Layout userRole={userRole}>
              <TopicSelector />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/create" element={
          session ? (
            <Layout userRole={userRole}>
              <ContentEditor userRole={userRole} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/content/:id" element={
          session ? (
            <Layout userRole={userRole}>
              <ContentEditor userRole={userRole} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients" element={
          session ? (
            <Layout userRole={userRole}>
              <ClientsList />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients/:id" element={
          session ? (
            <Layout userRole={userRole}>
              <ClientDetail />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/compliance" element={
          session ? (
            <Layout userRole={userRole}>
              <Dashboard userRole={userRole} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
