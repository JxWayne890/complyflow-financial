import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { UserRole, ContentStatus, Profile } from '../types';
import StatusBadge from '../components/StatusBadge';
import { Plus, ArrowRight, Activity, Clock, ShieldCheck, FileText, BarChart3, Loader2 } from 'lucide-react';

interface DashboardProps {
  userRole: UserRole;
  profile: Profile | null;
}

interface RecentItem {
  id: string;
  title: string;
  type: string;
  status: ContentStatus;
  date: string;
  mode: string;
}

interface ComplianceItem {
  id: string;
  title: string;
  advisor: string;
  type: string;
  submitted: string;
}

const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getContentTypeLabel = (type: string | null) => {
  switch (type) {
    case 'blog': return 'Blog Article';
    case 'linkedin': return 'LinkedIn Post';
    case 'facebook': return 'Facebook Post';
    case 'video_script': return 'Video Script';
    case 'ad': return 'Advertisement';
    default: return 'Content';
  }
};

const getGenerationModeLabel = (mode: string | null, title: string) => {
  if (mode === 'image' || title.toLowerCase().startsWith('visual asset:')) return 'Visual';
  if (mode === 'both') return 'Full Article';
  return 'Written';
};

const Dashboard: React.FC<DashboardProps> = ({ userRole, profile }) => {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [complianceQueue, setComplianceQueue] = useState<ComplianceItem[]>([]);
  const [allDrafts, setAllDrafts] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (profile?.org_id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [profile?.org_id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const isCompliance = userRole === UserRole.COMPLIANCE;

      // 1. Fetch content_requests for metrics
      // Compliance users only see submitted/in_review items
      let query = supabase
        .from('content_requests')
        .select('id, status, updated_at, topic_text, content_type, advisor_id')
        .eq('org_id', profile!.org_id)
        .order('updated_at', { ascending: false });

      if (isCompliance) {
        query = query.in('status', ['submitted', 'in_review']);
      }

      const { data: allRequests, error: reqError } = await query;

      if (reqError) throw reqError;

      const requests = allRequests || [];
      const pending = requests.filter(r => r.status === 'submitted' || r.status === 'in_review').length;
      const approved = requests.filter(r => r.status === 'approved').length;
      setPendingCount(pending);
      setApprovedCount(approved);
      setTotalCount(requests.length);

      // 2. Recent Activity (last 5 items with their latest version title)
      // Skip for compliance users — they only see the queue
      if (!isCompliance) {
        const recentReqs = requests.slice(0, 5);
        if (recentReqs.length > 0) {
          const reqIds = recentReqs.map(r => r.id);
          const { data: versions } = await supabase
            .from('content_versions')
            .select('request_id, title, version_number')
            .in('request_id', reqIds)
            .order('version_number', { ascending: false });

          const versionMap: Record<string, string> = {};
          (versions || []).forEach((v: any) => {
            if (!versionMap[v.request_id] && v.title) {
              versionMap[v.request_id] = v.title;
            }
          });

          const items: RecentItem[] = recentReqs.map(r => {
            const title = versionMap[r.id] || r.topic_text || 'Untitled';
            return {
              id: r.id,
              title,
              type: getContentTypeLabel(r.content_type),
              status: r.status as ContentStatus,
              date: formatRelativeTime(r.updated_at),
              mode: getGenerationModeLabel(null, title),
            };
          });
          setRecentItems(items);
        }
      }

      // 2b. ALL drafts (full list with version titles)
      // Skip for compliance users — they don't create content
      if (!isCompliance && requests.length > 0) {
        const allReqIds = requests.map(r => r.id);
        const { data: allVersions } = await supabase
          .from('content_versions')
          .select('request_id, title, version_number')
          .in('request_id', allReqIds)
          .order('version_number', { ascending: false });

        const allVersionMap: Record<string, string> = {};
        (allVersions || []).forEach((v: any) => {
          if (!allVersionMap[v.request_id] && v.title) {
            allVersionMap[v.request_id] = v.title;
          }
        });

        const drafts: RecentItem[] = requests.map(r => {
          const title = allVersionMap[r.id] || r.topic_text || 'Untitled';
          return {
            id: r.id,
            title,
            type: getContentTypeLabel(r.content_type),
            status: r.status as ContentStatus,
            date: formatRelativeTime(r.updated_at),
            mode: getGenerationModeLabel(null, title),
          };
        });
        setAllDrafts(drafts);
      }

      // 3. Compliance Queue (submitted / in_review items with advisor names)
      const pendingReqs = requests.filter(r => r.status === 'submitted' || r.status === 'in_review');
      if (pendingReqs.length > 0) {
        const advisorIds = [...new Set(pendingReqs.map(r => r.advisor_id).filter(Boolean))];
        let advisorMap: Record<string, string> = {};
        if (advisorIds.length > 0) {
          const { data: advisors } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', advisorIds);
          (advisors || []).forEach((a: any) => { advisorMap[a.id] = a.name; });
        }

        const queueItems: ComplianceItem[] = pendingReqs.slice(0, 10).map(r => ({
          id: r.id,
          title: r.topic_text || 'Untitled',
          advisor: advisorMap[r.advisor_id] || 'Unknown',
          type: getContentTypeLabel(r.content_type),
          submitted: formatRelativeTime(r.updated_at),
        }));
        setComplianceQueue(queueItems);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const completionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            {userRole === UserRole.ADVISOR ? 'Advisor Dashboard' : 'Compliance Overview'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}. You have <span className="font-semibold text-slate-900">{pendingCount} items</span> requiring attention.
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
            {pendingCount > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">{pendingCount} pending</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Review</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">{pendingCount}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ShieldCheck size={20} className="text-emerald-600" />
            </div>
            {approvedCount > 0 && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{approvedCount} approved</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Approved Content</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">{approvedCount}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${completionRate >= 80 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
              {completionRate}% rate
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Completion Rate</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 mt-1">{completionRate}%</h3>
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
              <Link to="/library" className="text-sm font-medium text-primary-600 hover:text-primary-700">View All</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentItems.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText size={48} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">No content yet</p>
                  <p className="text-sm text-slate-400">Create your first piece of content to see it here.</p>
                </div>
              ) : (
                recentItems.map(item => (
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
                      <div className="mt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.mode === 'Visual' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                          item.mode === 'Full Article' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                            'bg-slate-50 text-slate-600 border border-slate-100'
                          }`}>
                          {item.mode}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))
              )}
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
              {complianceQueue.length === 0 ? (
                <div className="p-12 text-center">
                  <ShieldCheck size={48} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">All caught up!</p>
                  <p className="text-sm text-slate-400">No items pending review.</p>
                </div>
              ) : (
                complianceQueue.map(item => (
                  <Link key={item.id} to={`/content/${item.id}`} className="block p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group cursor-pointer">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {item.advisor.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-xs font-medium text-slate-700">{item.advisor}</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-400">{item.submitted}</span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors truncate">{item.title}</h4>
                    </div>
                    <span className="p-2 text-slate-400 group-hover:text-primary-600 transition-all">
                      <ArrowRight size={20} />
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* All My Drafts — Full Width (hidden for Compliance) */}
      {userRole !== UserRole.COMPLIANCE && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-400" />
              <h3 className="font-semibold text-slate-900">All My Drafts</h3>
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">{allDrafts.length}</span>
            </div>
            <Link to="/library" className="text-sm font-medium text-primary-600 hover:text-primary-700">Open Library</Link>
          </div>
          {allDrafts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">No drafts yet</p>
              <p className="text-sm text-slate-400 mb-4">Content you create will appear here.</p>
              <Link to="/topics" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm">
                <Plus size={16} />
                Create your first draft
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {allDrafts.map(item => (
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
                    <div className="mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.mode === 'Visual' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        item.mode === 'Full Article' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          'bg-slate-50 text-slate-600 border border-slate-100'
                        }`}>
                        {item.mode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} />
                    <Link to={`/content/${item.id}`} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;