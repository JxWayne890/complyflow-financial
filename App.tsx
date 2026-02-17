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

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <Dashboard userRole={userRole} profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/topics" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <TopicSelector profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/create" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <ContentEditor userRole={userRole} profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/content/:id" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <ContentEditor userRole={userRole} profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <ClientsList profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients/:id" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <ClientDetail profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/compliance" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <Dashboard userRole={userRole} profile={profile} />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/changelog" element={
          session ? (
            <Layout userRole={userRole} profile={profile} setRoleOverride={setRoleOverride}>
              <Changelog />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
