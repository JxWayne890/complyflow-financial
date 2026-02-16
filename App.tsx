import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TopicSelector from './pages/TopicSelector';
import ContentEditor from './pages/ContentEditor';
import ClientsList from './pages/ClientsList';
import ClientDetail from './pages/ClientDetail';
import Changelog from './pages/Changelog';
import { UserRole, Profile } from './types';

// Demo profile – no login required
const demoProfile: Profile = {
  id: 'demo-user',
  name: 'Demo Advisor',
  email: 'demo@legacywealth.com',
  role: UserRole.ADMIN,
  org_id: 'demo-org',
};

const App: React.FC = () => {
  const userRole = demoProfile.role;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <Dashboard userRole={userRole} profile={demoProfile} />
          </Layout>
        } />

        <Route path="/topics" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <TopicSelector profile={demoProfile} />
          </Layout>
        } />

        <Route path="/create" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <ContentEditor userRole={userRole} profile={demoProfile} />
          </Layout>
        } />

        <Route path="/content/:id" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <ContentEditor userRole={userRole} profile={demoProfile} />
          </Layout>
        } />

        <Route path="/clients" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <ClientsList profile={demoProfile} />
          </Layout>
        } />

        <Route path="/clients/:id" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <ClientDetail profile={demoProfile} />
          </Layout>
        } />

        <Route path="/compliance" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <Dashboard userRole={userRole} profile={demoProfile} />
          </Layout>
        } />

        <Route path="/changelog" element={
          <Layout userRole={userRole} profile={demoProfile}>
            <Changelog />
          </Layout>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
