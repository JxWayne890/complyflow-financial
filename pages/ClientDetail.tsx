import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Client, ClientStatus, AudienceType, ContentStatus, ContentType, Profile } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
    ChevronLeft,
    Mail,
    Phone,
    Building2,
    FileText,
    Share2,
    Activity,
    User,
    Plus,
    Calendar,
    Linkedin,
    Facebook,
    Twitter,
    Instagram,
    Wifi,
    WifiOff,
    ExternalLink,
    Clock,
    Check,
    Send,
    Eye,
    Pencil,
    StickyNote,
    Loader2
} from 'lucide-react';

// Extended Client Interface for this view
interface ClientDetailData extends Client {
    contentCount: number;
    socialAccounts: { platform: string; account_name: string; connected: boolean; posting_preference: string }[];
}

interface SharedContentItem {
    id: string; // share id
    content_id: string; // request id
    title: string;
    content_type: ContentType;
    status: ContentStatus;
    updated_at: string;
    shared_at: string;
}

// Mock Activity for now (until we have an activity log table)
const mockActivity = [
    { id: 'a1', action: 'Client Created', detail: 'Client profile added to system', date: new Date().toISOString(), icon: 'onboarded' },
];

// --- Helpers ---

type TabKey = 'overview' | 'content' | 'social' | 'activity';

const getAudienceBadge = (type: AudienceType) => {
    switch (type) {
        case AudienceType.GENERAL_PUBLIC: return { label: 'General Public', className: 'bg-slate-100 text-slate-600 ring-slate-500/10' };
        case AudienceType.ACCREDITED: return { label: 'Accredited Investor', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
        case AudienceType.QUALIFIED: return { label: 'Qualified Purchaser', className: 'bg-purple-50 text-purple-700 ring-purple-600/20' };
        default: return { label: type, className: 'bg-slate-100 text-slate-600' };
    }
};

const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
        case ClientStatus.ACTIVE: return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' };
        case ClientStatus.ONBOARDING: return { label: 'Onboarding', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
        case ClientStatus.INACTIVE: return { label: 'Inactive', className: 'bg-slate-100 text-slate-500 ring-slate-500/10' };
        default: return { label: status, className: 'bg-slate-100 text-slate-600' };
    }
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500', 'bg-sky-500', 'bg-teal-500'];
const getAvatarColor = (id: string) => { const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0); return avatarColors[hash % avatarColors.length]; };

const getPlatformIcon = (platform: string, size: number = 18) => {
    switch (platform) {
        case 'linkedin': return <Linkedin size={size} />;
        case 'facebook': return <Facebook size={size} />;
        case 'twitter': return <Twitter size={size} />;
        case 'instagram': return <Instagram size={size} />;
        default: return <Share2 size={size} />;
    }
};

const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
        case ContentType.BLOG: return 'Blog Article';
        case ContentType.LINKEDIN: return 'LinkedIn Post';
        case ContentType.FACEBOOK: return 'Facebook Post';
        case ContentType.VIDEO_SCRIPT: return 'Video Script';
        case ContentType.AD: return 'Advertisement';
        default: return 'Content';
    }
};

const getActivityIcon = (type: string) => {
    switch (type) {
        case 'approved': return <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><Check size={16} className="text-emerald-600" /></div>;
        case 'posted': return <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center"><ExternalLink size={16} className="text-purple-600" /></div>;
        case 'submitted': return <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Send size={16} className="text-blue-600" /></div>;
        case 'draft': return <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center"><Pencil size={16} className="text-slate-500" /></div>;
        case 'onboarded': return <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center"><User size={16} className="text-amber-600" /></div>;
        default: return <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center"><Activity size={16} className="text-slate-500" /></div>;
    }
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateTime = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// --- Component ---

interface ClientDetailProps {
    profile: Profile | null;
}

const ClientDetail: React.FC<ClientDetailProps> = ({ profile }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    const [client, setClient] = useState<ClientDetailData | null>(null);
    const [sharedContent, setSharedContent] = useState<SharedContentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchClientData(id);
    }, [id]);

    const fetchClientData = async (clientId: string) => {
        setLoading(true);
        try {
            // 1. Fetch Client Details
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('*')
                .eq('id', clientId)
                .single();

            if (clientError) throw clientError;

            // 2. Fetch Shared Content
            const { data: sharesData, error: sharesError } = await supabase
                .from('client_content_shares')
                .select(`
                    id, shared_at, status,
                    content_versions (
                        id, created_at, content,
                        content_requests (
                            id, topic, status
                        )
                    )
                `)
                .eq('client_id', clientId)
                .order('shared_at', { ascending: false });

            if (sharesError) throw sharesError;

            // Transform Shared Content
            const formattedShares: SharedContentItem[] = (sharesData || []).map((share: any) => {
                const version = share.content_versions;
                const request = version?.content_requests;

                let title = request?.topic || 'Untitled Content';
                let type = ContentType.BLOG;

                // Try to extract title/type from JSON content
                if (version?.content) {
                    try {
                        const json = typeof version.content === 'string' ? JSON.parse(version.content) : version.content;
                        if (json.title) title = json.title;
                        if (json.type) type = json.type as ContentType;
                    } catch (e) { }
                }

                return {
                    id: share.id, // Share ID
                    content_id: request?.id, // Original Request ID
                    title: title,
                    content_type: type,
                    status: share.status as ContentStatus, // unread/read map to status? Or use request status?
                    // Actually, 'unread'/'read' is the share status. 
                    // But we might want to show the content status (e.g. Approved) or just 'Shared'.
                    // For now, let's use the share status as a proxy or just 'Shared'
                    updated_at: request?.updated_at || share.shared_at,
                    shared_at: share.shared_at
                };
            });

            setSharedContent(formattedShares);

            // Set Client Data
            setClient({
                ...clientData,
                contentCount: formattedShares.length,
                socialAccounts: [] // Mock for now
            });

        } catch (error) {
            console.error("Error fetching client details:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <User size={48} className="mb-4" />
                <p className="font-medium text-slate-600">Client not found</p>
                <button onClick={() => navigate('/clients')} className="mt-4 text-primary-600 text-sm font-medium hover:underline">
                    Back to Clients
                </button>
            </div>
        );
    }

    const audienceBadge = getAudienceBadge(client.audience_type);
    const statusBadge = getStatusBadge(client.status);

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'overview', label: 'Overview', icon: <User size={16} /> },
        { key: 'content', label: 'Content', icon: <FileText size={16} /> },
        { key: 'social', label: 'Social Accounts', icon: <Share2 size={16} /> },
        { key: 'activity', label: 'Activity', icon: <Activity size={16} /> }
    ];

    return (
        <div className="space-y-6">
            {/* Back + Header */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate('/clients')} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium transition-colors">
                    <ChevronLeft size={16} /> Clients
                </button>
            </div>

            {/* Client Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl ${getAvatarColor(client.id)} shadow-md`}>
                        {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <h1 className="text-2xl font-display font-bold text-slate-900">{client.name}</h1>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${audienceBadge.className}`}>
                                    {audienceBadge.label}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge.className}`}>
                                    {statusBadge.label}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
                            {client.company && <span className="flex items-center gap-1.5"><Building2 size={14} />{client.company}</span>}
                            <span className="flex items-center gap-1.5"><Mail size={14} />{client.contact_email}</span>
                            {client.contact_phone && <span className="flex items-center gap-1.5"><Phone size={14} />{client.contact_phone}</span>}
                        </div>
                    </div>
                    <Link
                        to={`/create?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`}
                        className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        Create Content
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex gap-1 -mb-px overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key
                                ? 'border-primary-600 text-primary-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Stats */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <p className="text-sm text-slate-500 font-medium">Shared Content</p>
                                <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">{client.contentCount}</h3>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <p className="text-sm text-slate-500 font-medium">Connected</p>
                                <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">{client.socialAccounts.filter(s => s.connected).length} accounts</h3>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <p className="text-sm text-slate-500 font-medium">Since</p>
                                <h3 className="text-lg font-display font-bold text-slate-900 mt-1">{formatDate(client.created_at || new Date().toISOString())}</h3>
                            </div>
                        </div>

                        {/* Recent Content */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={16} className="text-slate-400" />Recent Shared Content</h3>
                                <button onClick={() => setActiveTab('content')} className="text-sm font-medium text-primary-600 hover:text-primary-700">View All</button>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {sharedContent.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-slate-400">No content shared yet.</div>
                                ) : (
                                    sharedContent.slice(0, 3).map(item => (
                                        <Link key={item.id} to={`/create?Topic=${encodeURIComponent(item.title)}&existingId=${item.content_id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                            <div className="min-w-0 flex-1 pr-4">
                                                <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">{item.title}</p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                    <span>{getContentTypeLabel(item.content_type)}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>Shared: {formatDate(item.shared_at)}</span>
                                                </div>
                                            </div>
                                            <div className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded uppercase font-semibold">
                                                {item.status}
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Notes & Info */}
                    <div className="space-y-6">
                        {/* Notes */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><StickyNote size={16} className="text-slate-400" />Notes</h3>
                            </div>
                            <div className="p-5">
                                {client.notes ? (
                                    <p className="text-sm text-slate-600 leading-relaxed">{client.notes}</p>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No notes added yet</p>
                                )}
                            </div>
                        </div>

                        {/* Connected Accounts Summary */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Share2 size={16} className="text-slate-400" />Social Accounts</h3>
                            </div>
                            <div className="p-3">
                                <div className="p-4 text-center">
                                    <p className="text-sm text-slate-400">Social integrations coming soon.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'content' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">All Content Shared with {client.name}</h3>
                        <Link
                            to={`/create?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                            <Plus size={14} /> Create New
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {sharedContent.length > 0 ? sharedContent.map(item => (
                            <Link key={item.id} to={`/create?Topic=${encodeURIComponent(item.title)}&existingId=${item.content_id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="min-w-0 flex-1 pr-4">
                                    <p className="text-base font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">{item.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                        <span>{getContentTypeLabel(item.content_type)}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} />Shared: {formatDate(item.shared_at)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded uppercase font-semibold">
                                        {item.status}
                                    </div>
                                    <Eye size={16} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                                </div>
                            </Link>
                        )) : (
                            <div className="p-16 text-center">
                                <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-slate-500 font-medium">No content shared yet</p>
                                <p className="text-sm text-slate-400">Publish content to {client.name} from the Content Editor.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'social' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                    <Share2 size={48} className="mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-900">Social Integrations</h3>
                    <p className="mt-2">Connecting social accounts for auto-posting is coming in the next update.</p>
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Clock size={16} className="text-slate-400" />Activity Timeline</h3>
                    </div>
                    <div className="p-5">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

                            <div className="space-y-6">
                                {mockActivity.map((event, idx) => (
                                    <div key={event.id} className="relative flex items-start gap-4 pl-1">
                                        <div className="relative z-10 bg-white">
                                            {getActivityIcon(event.icon)}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                                            <p className="text-sm text-slate-500 mt-0.5">{event.detail}</p>
                                            <p className="text-xs text-slate-400 mt-1">{formatDateTime(event.date)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetail;
