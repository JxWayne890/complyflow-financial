import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  PenTool,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} />, roles: [UserRole.ADMIN, UserRole.ADVISOR, UserRole.COMPLIANCE] },
    { label: 'Topics Library', path: '/topics', icon: <PenTool size={18} />, roles: [UserRole.ADVISOR, UserRole.ADMIN] },
    { label: 'Clients', path: '/clients', icon: <Users size={18} />, roles: [UserRole.ADVISOR, UserRole.ADMIN] },
    { label: 'Review Queue', path: '/compliance', icon: <ShieldCheck size={18} />, roles: [UserRole.COMPLIANCE, UserRole.ADMIN] },
    { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: [UserRole.ADMIN] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 z-20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">ComplyFlow</h1>
          </div>

          <div className="px-3 py-2 bg-slate-50 rounded-xl mb-6 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Organization</p>
            <p className="text-sm font-medium text-slate-800 truncate">Acme Financial Partners</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <span className={isActive ? 'text-primary-600' : 'text-slate-400'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm font-medium text-slate-500 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-display font-bold text-slate-900">ComplyFlow</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${location.pathname === item.path ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className={location.pathname === item.path ? 'text-primary-600' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-display font-semibold text-slate-800 hidden sm:block">
              {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-900">Alex Morgan</span>
                <span className="text-xs text-slate-500 font-medium capitalize">{userRole}</span>
              </div>
              <div className="h-9 w-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm ring-1 ring-slate-100">
                AM
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;