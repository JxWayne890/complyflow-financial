import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import TopicSelector from './pages/TopicSelector';
import ContentEditor from './pages/ContentEditor';
import ClientsList from './pages/ClientsList';
import ClientDetail from './pages/ClientDetail';
import MyLibrary from './pages/MyLibrary';
import Settings from './pages/Settings';
import ClientPicker from './pages/ClientPicker';

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



  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </HashRouter>
    );
  }

  const userRole = profile.role;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/signup" element={<Navigate to="/" />} />
        <Route path="/forgot-password" element={<Navigate to="/" />} />

        <Route path="/" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <Dashboard userRole={userRole} profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/select-client" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <ClientPicker profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/topics" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <TopicSelector profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/create" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <ContentEditor userRole={userRole} profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/content/:id" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <ContentEditor userRole={userRole} profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/clients" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <ClientsList profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/library" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <MyLibrary />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/clients/:id" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <ClientDetail profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/compliance" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <Dashboard userRole={userRole} profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/settings" element={
          <Layout userRole={userRole} profile={profile}>
            <ErrorBoundary>
              <Settings profile={profile} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
