import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
    StickyNote
} from 'lucide-react';

// --- Mock Data ---

const mockClients: Record<string, Client & { contentCount: number; socialAccounts: { platform: string; account_name: string; connected: boolean; posting_preference: string }[] }> = {
    c1: {
        id: 'c1', org_id: 'org1', name: 'Sarah Chen', contact_email: 'sarah@meridianwealth.com', contact_phone: '(555) 234-5678',
        company: 'Meridian Wealth Partners', audience_type: AudienceType.ACCREDITED, notes: 'Prefers educational content on retirement planning. Quarterly blog posts and monthly LinkedIn updates.',
        status: ClientStatus.ACTIVE, created_at: '2024-01-05T10:00:00Z', contentCount: 14,
        socialAccounts: [
            { platform: 'linkedin', account_name: 'Sarah Chen, CFP', connected: true, posting_preference: 'auto' },
            { platform: 'facebook', account_name: 'Meridian Wealth', connected: true, posting_preference: 'manual' }
        ]
    },
    c2: {
        id: 'c2', org_id: 'org1', name: 'James Rivera', contact_email: 'jrivera@capitalgroup.com',
        company: 'Capital Growth Advisors', audience_type: AudienceType.QUALIFIED, status: ClientStatus.ACTIVE, created_at: '2024-01-10T14:00:00Z', contentCount: 8,
        socialAccounts: [
            { platform: 'linkedin', account_name: 'James Rivera', connected: true, posting_preference: 'scheduled' }
        ]
    },
    c3: {
        id: 'c3', org_id: 'org1', name: 'Dr. Emily Thornton', contact_email: 'ethornton@gmail.com', contact_phone: '(555) 876-5432',
        company: 'Thornton Family Office', audience_type: AudienceType.QUALIFIED, notes: 'High-touch client. All content must go through two rounds of compliance review. Focus on alternative investments and estate planning.',
        status: ClientStatus.ACTIVE, created_at: '2024-02-01T09:00:00Z', contentCount: 22,
        socialAccounts: [
            { platform: 'linkedin', account_name: 'Dr. Emily Thornton', connected: true, posting_preference: 'auto' },
            { platform: 'facebook', account_name: 'Thornton Family Office', connected: true, posting_preference: 'auto' }
        ]
    },
    c4: {
        id: 'c4', org_id: 'org1', name: 'Marcus Williams', contact_email: 'marcus@eliteadvisors.com',
        company: 'Elite Financial Advisors', audience_type: AudienceType.GENERAL_PUBLIC, status: ClientStatus.ONBOARDING, created_at: '2024-02-10T16:00:00Z', contentCount: 0,
        socialAccounts: []
    },
    c5: {
        id: 'c5', org_id: 'org1', name: 'Patricia Hoffman', contact_email: 'phoffman@legacypartners.com', contact_phone: '(555) 345-6789',
        company: 'Legacy Planning Partners', audience_type: AudienceType.ACCREDITED, notes: 'Long-term client. Focused on wealth transfer and estate planning. Prefers conservative tone.',
        status: ClientStatus.ACTIVE, created_at: '2023-11-15T11:00:00Z', contentCount: 31,
        socialAccounts: [
            { platform: 'linkedin', account_name: 'Patricia Hoffman', connected: true, posting_preference: 'manual' },
            { platform: 'facebook', account_name: 'Legacy Planning', connected: false, posting_preference: 'manual' }
        ]
    },
    c6: {
        id: 'c6', org_id: 'org1', name: 'Robert Nakamura', contact_email: 'rnakamura@sunsetwealth.com',
        company: 'Sunset Wealth Management', audience_type: AudienceType.GENERAL_PUBLIC, status: ClientStatus.INACTIVE, created_at: '2023-09-01T08:00:00Z', contentCount: 5,
        socialAccounts: [
            { platform: 'linkedin', account_name: 'Robert Nakamura', connected: false, posting_preference: 'manual' }
        ]
    }
};

const mockContentForClient = [
    { id: '1', title: 'Navigating Fixed Income in 2024', content_type: ContentType.BLOG, status: ContentStatus.APPROVED, updated_at: '2024-01-15T10:30:00Z' },
    { id: '2', title: 'Retirement Planning Essentials', content_type: ContentType.LINKEDIN, status: ContentStatus.POSTED, updated_at: '2024-01-12T14:20:00Z' },
    { id: '3', title: 'Year-End Tax Strategies', content_type: ContentType.BLOG, status: ContentStatus.IN_REVIEW, updated_at: '2024-01-10T09:15:00Z' },
    { id: '4', title: 'Market Volatility Update', content_type: ContentType.FACEBOOK, status: ContentStatus.DRAFT, updated_at: '2024-01-08T16:45:00Z' },
    { id: '5', title: 'Estate Planning Basics', content_type: ContentType.VIDEO_SCRIPT, status: ContentStatus.APPROVED, updated_at: '2024-01-05T11:00:00Z' },
];

const mockActivity = [
    { id: 'a1', action: 'Content approved', detail: '"Navigating Fixed Income in 2024" was approved by Compliance', date: '2024-01-15T10:30:00Z', icon: 'approved' },
    { id: 'a2', action: 'Content posted', detail: '"Retirement Planning Essentials" posted to LinkedIn', date: '2024-01-12T14:20:00Z', icon: 'posted' },
    { id: 'a3', action: 'Content submitted', detail: '"Year-End Tax Strategies" submitted for compliance review', date: '2024-01-10T09:15:00Z', icon: 'submitted' },
    { id: 'a4', action: 'Draft created', detail: '"Market Volatility Update" draft generated with AI', date: '2024-01-08T16:45:00Z', icon: 'draft' },
    { id: 'a5', action: 'Client onboarded', detail: 'Client profile created and LinkedIn account connected', date: '2024-01-05T10:00:00Z', icon: 'onboarded' },
];

// --- Helpers ---

type TabKey = 'overview' | 'content' | 'social' | 'activity';

const getAudienceBadge = (type: AudienceType) => {
    switch (type) {
        case AudienceType.GENERAL_PUBLIC: return { label: 'General Public', className: 'bg-slate-100 text-slate-600 ring-slate-500/10' };
        case AudienceType.ACCREDITED: return { label: 'Accredited Investor', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
        case AudienceType.QUALIFIED: return { label: 'Qualified Purchaser', className: 'bg-purple-50 text-purple-700 ring-purple-600/20' };
    }
};

const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
        case ClientStatus.ACTIVE: return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' };
        case ClientStatus.ONBOARDING: return { label: 'Onboarding', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
        case ClientStatus.INACTIVE: return { label: 'Inactive', className: 'bg-slate-100 text-slate-500 ring-slate-500/10' };
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

    const client = id ? mockClients[id] : null;

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
                            <span className="flex items-center gap-1.5"><Building2 size={14} />{client.company}</span>
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
                                <p className="text-sm text-slate-500 font-medium">Total Content</p>
                                <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">{client.contentCount}</h3>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <p className="text-sm text-slate-500 font-medium">Connected</p>
                                <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">{client.socialAccounts.filter(s => s.connected).length} accounts</h3>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <p className="text-sm text-slate-500 font-medium">Since</p>
                                <h3 className="text-lg font-display font-bold text-slate-900 mt-1">{formatDate(client.created_at)}</h3>
                            </div>
                        </div>

                        {/* Recent Content */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={16} className="text-slate-400" />Recent Content</h3>
                                <button onClick={() => setActiveTab('content')} className="text-sm font-medium text-primary-600 hover:text-primary-700">View All</button>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {mockContentForClient.slice(0, 3).map(item => (
                                    <Link key={item.id} to={`/content/${item.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                <span>{getContentTypeLabel(item.content_type)}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{formatDate(item.updated_at)}</span>
                                            </div>
                                        </div>
                                        <StatusBadge status={item.status} />
                                    </Link>
                                ))}
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
                                {client.socialAccounts.length > 0 ? (
                                    client.socialAccounts.map((account, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
                                            <span className={account.connected ? 'text-primary-600' : 'text-slate-400'}>
                                                {getPlatformIcon(account.platform)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{account.account_name}</p>
                                                <p className="text-xs text-slate-500 capitalize">{account.posting_preference} posting</p>
                                            </div>
                                            {account.connected ? (
                                                <Wifi size={14} className="text-emerald-500" />
                                            ) : (
                                                <WifiOff size={14} className="text-slate-400" />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-sm text-slate-400">No accounts connected</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'content' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">All Content for {client.name}</h3>
                        <Link
                            to={`/create?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                            <Plus size={14} /> Create New
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {mockContentForClient.map(item => (
                            <Link key={item.id} to={`/content/${item.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                <div className="min-w-0 flex-1 pr-4">
                                    <p className="text-base font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">{item.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                        <span>{getContentTypeLabel(item.content_type)}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(item.updated_at)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={item.status} />
                                    <Eye size={16} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                    {mockContentForClient.length === 0 && (
                        <div className="p-16 text-center">
                            <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-slate-500 font-medium">No content yet</p>
                            <p className="text-sm text-slate-400">Create your first piece of content for {client.name}</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'social' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {['linkedin', 'facebook', 'twitter', 'instagram'].map(platform => {
                            const account = client.socialAccounts.find(s => s.platform === platform);
                            const isConnected = account?.connected || false;

                            return (
                                <div key={platform} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isConnected ? 'border-slate-200' : 'border-dashed border-slate-300'}`}>
                                    <div className="p-5">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {getPlatformIcon(platform, 24)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 capitalize">{platform}</h4>
                                                {account ? (
                                                    <p className="text-sm text-slate-500">{account.account_name}</p>
                                                ) : (
                                                    <p className="text-sm text-slate-400">Not connected</p>
                                                )}
                                            </div>
                                            {isConnected ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium ring-1 ring-inset ring-emerald-600/20">
                                                    <Wifi size={12} /> Connected
                                                </span>
                                            ) : (
                                                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                                                    Connect
                                                </button>
                                            )}
                                        </div>

                                        {account && isConnected && (
                                            <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                                                <div className="text-sm">
                                                    <span className="text-slate-500">Posting mode: </span>
                                                    <span className="font-medium text-slate-700 capitalize">{account.posting_preference}</span>
                                                </div>
                                                <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">Change</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-3">
                        <Share2 size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-900">Blotato Integration</p>
                            <p className="text-sm text-blue-700 mt-1">Social account connections are managed through Blotato. Connecting an account here will initiate the OAuth flow for the client to authorize posting on their behalf.</p>
                        </div>
                    </div>
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
