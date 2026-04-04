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

const DEV_MODE = true; // Flip to false when ready for client testing

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500',
  advisor: 'bg-blue-500',
  compliance: 'bg-amber-500',
  client: 'bg-emerald-500',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  advisor: 'Advisor',
  compliance: 'Compliance',
  client: 'Client',
};

const DevProfileSwitcher: React.FC<{
  currentProfile: Profile;
  realProfile: Profile;
  orgProfiles: Profile[];
  onSwitch: (p: Profile) => void;
}> = ({ currentProfile, realProfile, orgProfiles, onSwitch }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-white text-xs font-bold shadow-lg border-2 border-white/30 transition-all hover:scale-105 ${ROLE_COLORS[currentProfile.role] || 'bg-slate-600'}`}
      >
        <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
        DEV: {currentProfile.name} ({ROLE_LABELS[currentProfile.role] || currentProfile.role})
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800 text-white">
            <p className="text-xs font-bold tracking-wider uppercase">Dev Profile Switcher</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Signed in as {realProfile.email}</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {orgProfiles.map(p => (
              <button
                key={p.id}
                onClick={() => { onSwitch(p); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${p.id === currentProfile.id ? 'bg-slate-50' : ''}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_COLORS[p.role] || 'bg-slate-500'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[p.role] || p.role} &middot; {p.email}</p>
                </div>
                {p.id === currentProfile.id && (
                  <span className="text-emerald-500 text-xs font-semibold">Active</span>
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
            <p className="text-[10px] text-slate-400 text-center">Remove DEV_MODE flag in App.tsx for production</p>
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Dev mode: override profile for role switching
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [devProfile, setDevProfile] = useState<Profile | null>(null);
  const [orgProfiles, setOrgProfiles] = useState<Profile[]>([]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      setRealProfile(data);

      if (DEV_MODE && data?.org_id) {
        const { data: orgData } = await supabase
          .from('profiles')
          .select('*')
          .eq('org_id', data.org_id)
          .order('role');
        setOrgProfiles(orgData || []);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const activeProfile = devProfile || profile;



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

  const userRole = activeProfile!.role;
  const ep = activeProfile!;

  return (
    <HashRouter>
      {DEV_MODE && realProfile && (
        <DevProfileSwitcher
          currentProfile={ep}
          realProfile={realProfile}
          orgProfiles={orgProfiles}
          onSwitch={setDevProfile}
        />
      )}
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/signup" element={<Navigate to="/" />} />
        <Route path="/forgot-password" element={<Navigate to="/" />} />

        <Route path="/" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <Dashboard userRole={userRole} profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/select-client" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <ClientPicker profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/topics" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <TopicSelector profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/create" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <ContentEditor userRole={userRole} profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/content/:id" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <ContentEditor userRole={userRole} profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/clients" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <ClientsList profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/library" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <MyLibrary />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/clients/:id" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <ClientDetail profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/compliance" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <Dashboard userRole={userRole} profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="/settings" element={
          <Layout userRole={userRole} profile={ep}>
            <ErrorBoundary>
              <Settings profile={ep} />
            </ErrorBoundary>
          </Layout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
