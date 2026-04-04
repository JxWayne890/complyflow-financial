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

// --- Brand Voice Card ---

const BrandVoiceCard: React.FC<{
    client: ClientDetailData;
    onSave: (updates: Partial<ClientDetailData>) => void;
}> = ({ client, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [writingStyle, setWritingStyle] = useState(client.writing_style || '');
    const [brandTone, setBrandTone] = useState(client.brand_tone || '');
    const [businessDescription, setBusinessDescription] = useState(client.business_description || '');

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = {
                writing_style: writingStyle || null,
                brand_tone: brandTone || null,
                business_description: businessDescription || null,
            };
            const { error } = await supabase
                .from('clients')
                .update(updates)
                .eq('id', client.id);

            if (error) throw error;
            onSave(updates as Partial<ClientDetailData>);
            setEditing(false);
        } catch (err) {
            console.error('Error saving brand voice:', err);
        } finally {
            setSaving(false);
        }
    };

    const hasVoice = !!(client.writing_style || client.brand_tone || client.business_description);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Pencil size={16} className="text-slate-400" />Brand Voice
                </h3>
                {!editing && (
                    <button onClick={() => setEditing(true)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                        {hasVoice ? 'Edit' : 'Set up'}
                    </button>
                )}
            </div>
            <div className="p-5 space-y-4">
                {editing ? (
                    <>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Writing Style</label>
                            <input
                                type="text"
                                value={writingStyle}
                                onChange={e => setWritingStyle(e.target.value)}
                                placeholder="e.g., Professional, conversational, data-driven"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Brand Tone</label>
                            <input
                                type="text"
                                value={brandTone}
                                onChange={e => setBrandTone(e.target.value)}
                                placeholder="e.g., Authoritative yet approachable"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Business Description</label>
                            <textarea
                                value={businessDescription}
                                onChange={e => setBusinessDescription(e.target.value)}
                                placeholder="Brief description of the client's business, services, and target market..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </>
                ) : hasVoice ? (
                    <div className="space-y-3">
                        {client.writing_style && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Style</p>
                                <p className="text-sm text-slate-700 mt-0.5">{client.writing_style}</p>
                            </div>
                        )}
                        {client.brand_tone && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tone</p>
                                <p className="text-sm text-slate-700 mt-0.5">{client.brand_tone}</p>
                            </div>
                        )}
                        {client.business_description && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Business</p>
                                <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{client.business_description}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No brand voice configured. Set up writing style and tone to personalize AI-generated content.</p>
                )}
            </div>
        </div>
    );
};

// --- Social Accounts Tab ---

const PLATFORMS = ['linkedin', 'facebook', 'twitter', 'instagram'] as const;
const platformIcons: Record<string, React.ReactNode> = {
    linkedin: <Linkedin size={16} />,
    facebook: <Facebook size={16} />,
    twitter: <Twitter size={16} />,
    instagram: <Instagram size={16} />,
};

const SocialAccountsTab: React.FC<{ clientId: string; orgId: string }> = ({ clientId, orgId }) => {
    const [accounts, setAccounts] = useState<{ id: string; platform: string; account_name: string; blotato_connection_id: string | null; connected: boolean }[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPlatform, setNewPlatform] = useState<string>('linkedin');
    const [newConnectionId, setNewConnectionId] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, [clientId]);

    const fetchAccounts = async () => {
        setLoadingAccounts(true);
        const { data } = await supabase
            .from('client_social_accounts')
            .select('*')
            .eq('client_id', clientId);
        setAccounts(data || []);
        setLoadingAccounts(false);
    };

    const handleAdd = async () => {
        if (!newConnectionId.trim() || !newAccountName.trim()) return;
        setSaving(true);
        const { error } = await supabase
            .from('client_social_accounts')
            .insert({
                client_id: clientId,
                platform: newPlatform,
                account_name: newAccountName.trim(),
                blotato_connection_id: newConnectionId.trim(),
                connected: true,
                posting_preference: 'manual',
            });
        if (!error) {
            setShowAddForm(false);
            setNewConnectionId('');
            setNewAccountName('');
            await fetchAccounts();
        }
        setSaving(false);
    };

    if (loadingAccounts) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <Loader2 size={24} className="mx-auto animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Share2 size={16} className="text-slate-400" />
                        Connected Social Accounts
                    </h3>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                        <Plus size={14} /> Connect Account
                    </button>
                </div>
                <div className="divide-y divide-slate-100">
                    {accounts.length > 0 ? accounts.map(account => (
                        <div key={account.id} className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    {platformIcons[account.platform] || <Share2 size={16} />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 capitalize">{account.platform}</p>
                                    <p className="text-xs text-slate-500">{account.account_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {account.blotato_connection_id ? (
                                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Wifi size={12} /> Connected</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-slate-400 font-medium"><WifiOff size={12} /> No Blotato ID</span>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center">
                            <Share2 size={32} className="mx-auto text-slate-200 mb-2" />
                            <p className="text-sm text-slate-500">No social accounts connected yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {showAddForm && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800">Connect a Blotato Account</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Platform</label>
                            <select
                                value={newPlatform}
                                onChange={e => setNewPlatform(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                                {PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Account Name</label>
                            <input
                                type="text"
                                value={newAccountName}
                                onChange={e => setNewAccountName(e.target.value)}
                                placeholder="e.g. Legacy Wealth LinkedIn"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Blotato Connection ID</label>
                            <input
                                type="text"
                                value={newConnectionId}
                                onChange={e => setNewConnectionId(e.target.value)}
                                placeholder="Paste from Blotato"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={saving || !newConnectionId.trim() || !newAccountName.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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

            if (clientData) {
                setClient({
                    ...clientData,
                    contentCount: 0,
                    socialAccounts: []
                });
            }

            // 2. Fetch Shared Content (separate try/catch so client still shows)
            try {
                const { data: sharesData, error: sharesError } = await supabase
                    .from('client_content_shares')
                    .select(`
                        id, shared_at, status,
                        content_versions (
                            id, created_at, title, body,
                            content_requests!request_id (
                                id, topic_text, status, content_type
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

                    let title = version?.title || request?.topic_text || 'Untitled Content';
                    let type = request?.content_type || ContentType.BLOG;

                    return {
                        id: share.id,
                        content_id: request?.id,
                        title: title,
                        content_type: type,
                        status: share.status as ContentStatus,
                        updated_at: request?.updated_at || share.shared_at,
                        shared_at: share.shared_at
                    };
                });

                setSharedContent(formattedShares);
                setClient(prev => prev ? { ...prev, contentCount: formattedShares.length } : prev);
            } catch (shareError) {
                console.error("Error fetching shared content:", shareError);
                // Client still renders; shares section will just be empty
            }

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
                        to={`/topics?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`}
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

                        {/* Brand Voice */}
                        <BrandVoiceCard client={client} onSave={(updates) => {
                            setClient(prev => prev ? { ...prev, ...updates } : prev);
                        }} />

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
                            <Link key={item.id} to={`/content/${item.content_id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
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
                <SocialAccountsTab clientId={id!} orgId={profile?.org_id || ''} />
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
