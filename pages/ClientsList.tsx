import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Client, ClientStatus, AudienceType, Profile } from '../types';
import { supabase } from '../services/supabaseClient';
import {
    Search,
    Plus,
    Users,
    Building2,
    Mail,
    ChevronRight,
    UserCircle,
    Linkedin,
    Facebook,
    X,
    Loader2
} from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'onboarding' | 'inactive';

const getAudienceBadge = (type: AudienceType) => {
    switch (type) {
        case AudienceType.GENERAL_PUBLIC:
            return { label: 'General Public', className: 'bg-slate-100 text-slate-600 ring-slate-500/10' };
        case AudienceType.ACCREDITED:
            return { label: 'Accredited', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
        case AudienceType.QUALIFIED:
            return { label: 'Qualified', className: 'bg-purple-50 text-purple-700 ring-purple-600/20' };
        default:
            return { label: type, className: 'bg-slate-100 text-slate-600 ring-slate-500/10' };
    }
};

const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
        case ClientStatus.ACTIVE:
            return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' };
        case ClientStatus.ONBOARDING:
            return { label: 'Onboarding', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
        case ClientStatus.INACTIVE:
            return { label: 'Inactive', className: 'bg-slate-100 text-slate-500 ring-slate-500/10' };
        default:
            return { label: status, className: 'bg-slate-100 text-slate-500 ring-slate-500/10' };
    }
};

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const avatarColors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
    'bg-pink-500', 'bg-rose-500', 'bg-sky-500', 'bg-teal-500'
];

const getAvatarColor = (id: string) => {
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
};

const getSocialIcon = (platform: string) => {
    switch (platform) {
        case 'linkedin': return <Linkedin size={14} />;
        case 'facebook': return <Facebook size={14} />;
        default: return null;
    }
};

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    orgId: string;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSuccess, orgId }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [audienceType, setAudienceType] = useState<AudienceType>(AudienceType.GENERAL_PUBLIC);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("Invoking invite-client with:", { email, name, company, org_id: orgId, audience_type: audienceType });
            const { data, error } = await supabase.functions.invoke('invite-client', {
                body: {
                    email,
                    name,
                    company,
                    org_id: orgId,
                    audience_type: audienceType
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error inviting client:', err);
            setError(err.message || 'Failed to invite client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Add New Client</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            placeholder="Jane Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            placeholder="jane@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                        <input
                            type="text"
                            value={company}
                            onChange={e => setCompany(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            placeholder="Company Name (Optional)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Audience Type</label>
                        <select
                            value={audienceType}
                            onChange={e => setAudienceType(e.target.value as AudienceType)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        >
                            <option value={AudienceType.GENERAL_PUBLIC}>General Public</option>
                            <option value={AudienceType.ACCREDITED}>Accredited Investor</option>
                            <option value={AudienceType.QUALIFIED}>Qualified Purchaser</option>
                        </select>
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Creating...' : 'Create Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ClientsList: React.FC<{ profile: Profile | null }> = ({ profile }) => {
    const [clients, setClients] = useState<(Client & { contentCount: number; socialAccounts: string[] })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const fetchClients = async () => {
        if (!profile?.org_id) return;
        setLoading(true);
        try {
            // Fetch clients
            const { data: clientsData, error: clientsError } = await supabase
                .from('clients')
                .select('*')
                .eq('org_id', profile.org_id)
                .order('created_at', { ascending: false });

            if (clientsError) throw clientsError;

            // Transform data (mocking content count for now or fetching it)
            // Ideally we do a join, but for now we'll just use the client data
            const transformedClients = clientsData.map((client: any) => ({
                ...client,
                contentCount: 0, // Placeholder
                socialAccounts: [] // Placeholder
            }));

            setClients(transformedClients);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [profile?.org_id]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (client.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.contact_email.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (filterStatus !== 'all') {
                matchesStatus = client.status === filterStatus;
            }

            return matchesSearch && matchesStatus;
        });
    }, [clients, searchQuery, filterStatus]);

    const statusCounts = useMemo(() => ({
        all: clients.length,
        active: clients.filter(c => c.status === ClientStatus.ACTIVE).length,
        onboarding: clients.filter(c => c.status === ClientStatus.ONBOARDING).length,
        inactive: clients.filter(c => c.status === ClientStatus.INACTIVE).length
    }), [clients]);

    const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
        { key: 'all', label: 'All Clients', count: statusCounts.all },
        { key: 'active', label: 'Active', count: statusCounts.active },
        { key: 'onboarding', label: 'Onboarding', count: statusCounts.onboarding },
        { key: 'inactive', label: 'Inactive', count: statusCounts.inactive }
    ];

    if (loading && clients.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AddClientModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => {
                    fetchClients();
                }}
                orgId={profile?.org_id || ''}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Clients</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage your client accounts and their content
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
                >
                    <Plus size={18} />
                    Add Client
                </button>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, company, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterStatus === tab.key
                                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                }`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${filterStatus === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Client Cards Grid */}
            {filteredClients.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients found</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        {searchQuery ? 'Try adjusting your search or filters' : 'Add your first client to get started'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-2 text-primary-600 font-medium hover:text-primary-700"
                        >
                            <Plus size={18} /> Add Client
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredClients.map(client => {
                        const audienceBadge = getAudienceBadge(client.audience_type);
                        const statusBadge = getStatusBadge(client.status);

                        return (
                            <Link
                                key={client.id}
                                to={`/clients/${client.id}`}
                                className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300"
                            >
                                {/* Card Top */}
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(client.id)} shadow-sm`}>
                                            {getInitials(client.name)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                                                {client.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                                                <Building2 size={13} className="flex-shrink-0" />
                                                <span className="truncate">{client.company || 'Individual'}</span>
                                            </div>
                                        </div>

                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
                                    </div>

                                    {/* Badges Row */}
                                    <div className="flex items-center gap-2 mt-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${audienceBadge.className}`}>
                                            {audienceBadge.label}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge.className}`}>
                                            {statusBadge.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Mail size={12} />
                                            {client.contact_email}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500 font-medium">{client.contentCount} posts</span>
                                        {client.socialAccounts.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                {client.socialAccounts.map(platform => (
                                                    <span key={platform} className="text-slate-400">
                                                        {getSocialIcon(platform)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClientsList;
