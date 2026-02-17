import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TopicSelector from './pages/TopicSelector';
import ContentEditor from './pages/ContentEditor';
import ClientsList from './pages/ClientsList';
import ClientDetail from './pages/ClientDetail';
import Changelog from './pages/Changelog';
import { UserRole, Profile } from './types';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Role Switcher State
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const userRole = roleOverride || profile?.role || UserRole.ADVISOR;

  // Demo Profile Fallback
  const effectiveProfile: Profile = profile || {
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@example.com',
    role: UserRole.ADVISOR,
    org_id: 'demo-org'
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes (with Demo Fallback) */}
        <Route path="/" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <Dashboard userRole={userRole} profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/topics" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <TopicSelector profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/create" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <ContentEditor userRole={userRole} profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/content/:id" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <ContentEditor userRole={userRole} profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/clients" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <ClientsList profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/clients/:id" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <ClientDetail profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/compliance" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <Dashboard userRole={userRole} profile={effectiveProfile} />
          </Layout>
        } />

        <Route path="/changelog" element={
          <Layout userRole={userRole} profile={effectiveProfile} setRoleOverride={setRoleOverride}>
            <Changelog />
          </Layout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
