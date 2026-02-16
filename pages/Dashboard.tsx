import React from 'react';
import { Link } from 'react-router-dom';
import { UserRole, ContentStatus, Profile } from '../types';
import StatusBadge from '../components/StatusBadge';
import { Plus, ArrowRight, Activity, Clock, ShieldCheck, FileText, BarChart3 } from 'lucide-react';

interface DashboardProps {
  userRole: UserRole;
  profile: Profile | null;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole, profile }) => {
  // Mock data
  const recentItems = [
    { id: '1', title: 'Q4 Market Outlook', type: 'Blog Article', status: ContentStatus.IN_REVIEW, date: 'Oct 24, 2023' },
    { id: '2', title: 'Retirement Planning 101', type: 'LinkedIn Post', status: ContentStatus.APPROVED, date: 'Oct 22, 2023' },
    { id: '3', title: 'Tax Harvesting Tips', type: 'Video Script', status: ContentStatus.DRAFT, date: 'Oct 20, 2023' },
  ];

  const complianceQueue = [
    { id: '1', title: 'Q4 Market Outlook', advisor: 'John Doe', type: 'Blog', submitted: '2h ago' },
    { id: '4', title: 'Crypto Risks Update', advisor: 'Sarah Smith', type: 'Facebook', submitted: '5h ago' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            {userRole === UserRole.ADVISOR ? 'Advisor Dashboard' : 'Compliance Overview'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back. You have <span className="font-semibold text-slate-900">{complianceQueue.length} items</span> requiring attention.
          </p>
        </div>
        {userRole === UserRole.ADVISOR && (
          <Link to="/topics" className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20">
            <Plus size={18} />
            Create Content
          </Link>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock size={20} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">+2 today</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Review</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">12</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ShieldCheck size={20} className="text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">+4 this week</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Approved Content</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">8</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">94% rate</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Completion Rate</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">94%</h3>
          </div>
        </div>
      </div>

      {/* Content Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Advisor View: Recent Drafts */}
        {(userRole === UserRole.ADVISOR || userRole === UserRole.ADMIN) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-slate-400" />
                <h3 className="font-semibold text-slate-900">Recent Activity</h3>
              </div>
              <Link to="/clients" className="text-sm font-medium text-primary-600 hover:text-primary-700">View All</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentItems.map(item => (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-500">{item.type}</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-400">{item.date}</span>
                    </div>
                    <Link to={`/content/${item.id}`} className="block text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                      {item.title}
                    </Link>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance View: Queue */}
        {(userRole === UserRole.COMPLIANCE || userRole === UserRole.ADMIN) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-slate-400" />
                <h3 className="font-semibold text-slate-900">Compliance Queue</h3>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{complianceQueue.length} Pending</span>
            </div>
            <div className="divide-y divide-slate-100">
              {complianceQueue.map(item => (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">JD</div>
                      <span className="text-xs font-medium text-slate-700">{item.advisor}</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-400">{item.submitted}</span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 truncate">{item.title}</h4>
                  </div>
                  <Link to={`/content/${item.id}`} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                    <ArrowRight size={20} />
                  </Link>
                </div>
              ))}
              {complianceQueue.length === 0 && (
                <div className="p-12 text-center">
                  <ShieldCheck size={48} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">All caught up!</p>
                  <p className="text-sm text-slate-400">No items pending review.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;