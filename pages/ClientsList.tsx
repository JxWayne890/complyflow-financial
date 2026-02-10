import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Client, ClientStatus, AudienceType } from '../types';
import {
    Search,
    Plus,
    Users,
    Building2,
    Mail,
    ChevronRight,
    UserCircle,
    Linkedin,
    Facebook
} from 'lucide-react';

// Mock data
const mockClients: (Client & { contentCount: number; socialAccounts: string[] })[] = [
    {
        id: 'c1',
        org_id: 'org1',
        name: 'Sarah Chen',
        contact_email: 'sarah@meridianwealth.com',
        company: 'Meridian Wealth Partners',
        audience_type: AudienceType.ACCREDITED,
        status: ClientStatus.ACTIVE,
        created_at: '2024-01-05T10:00:00Z',
        contentCount: 14,
        socialAccounts: ['linkedin', 'facebook']
    },
    {
        id: 'c2',
        org_id: 'org1',
        name: 'James Rivera',
        contact_email: 'jrivera@capitalgroup.com',
        company: 'Capital Growth Advisors',
        audience_type: AudienceType.QUALIFIED,
        status: ClientStatus.ACTIVE,
        created_at: '2024-01-10T14:00:00Z',
        contentCount: 8,
        socialAccounts: ['linkedin']
    },
    {
        id: 'c3',
        org_id: 'org1',
        name: 'Dr. Emily Thornton',
        contact_email: 'ethornton@gmail.com',
        company: 'Thornton Family Office',
        audience_type: AudienceType.QUALIFIED,
        status: ClientStatus.ACTIVE,
        created_at: '2024-02-01T09:00:00Z',
        contentCount: 22,
        socialAccounts: ['linkedin', 'facebook']
    },
    {
        id: 'c4',
        org_id: 'org1',
        name: 'Marcus Williams',
        contact_email: 'marcus@eliteadvisors.com',
        company: 'Elite Financial Advisors',
        audience_type: AudienceType.GENERAL_PUBLIC,
        status: ClientStatus.ONBOARDING,
        created_at: '2024-02-10T16:00:00Z',
        contentCount: 0,
        socialAccounts: []
    },
    {
        id: 'c5',
        org_id: 'org1',
        name: 'Patricia Hoffman',
        contact_email: 'phoffman@legacypartners.com',
        company: 'Legacy Planning Partners',
        audience_type: AudienceType.ACCREDITED,
        status: ClientStatus.ACTIVE,
        created_at: '2023-11-15T11:00:00Z',
        contentCount: 31,
        socialAccounts: ['linkedin', 'facebook']
    },
    {
        id: 'c6',
        org_id: 'org1',
        name: 'Robert Nakamura',
        contact_email: 'rnakamura@sunsetwealth.com',
        company: 'Sunset Wealth Management',
        audience_type: AudienceType.GENERAL_PUBLIC,
        status: ClientStatus.INACTIVE,
        created_at: '2023-09-01T08:00:00Z',
        contentCount: 5,
        socialAccounts: ['linkedin']
    }
];

type StatusFilter = 'all' | 'active' | 'onboarding' | 'inactive';

const getAudienceBadge = (type: AudienceType) => {
    switch (type) {
        case AudienceType.GENERAL_PUBLIC:
            return { label: 'General Public', className: 'bg-slate-100 text-slate-600 ring-slate-500/10' };
        case AudienceType.ACCREDITED:
            return { label: 'Accredited', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
        case AudienceType.QUALIFIED:
            return { label: 'Qualified', className: 'bg-purple-50 text-purple-700 ring-purple-600/20' };
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

const ClientsList: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

    const filteredClients = useMemo(() => {
        return mockClients.filter(client => {
            const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.contact_email.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (filterStatus !== 'all') {
                matchesStatus = client.status === filterStatus;
            }

            return matchesSearch && matchesStatus;
        });
    }, [searchQuery, filterStatus]);

    const statusCounts = useMemo(() => ({
        all: mockClients.length,
        active: mockClients.filter(c => c.status === ClientStatus.ACTIVE).length,
        onboarding: mockClients.filter(c => c.status === ClientStatus.ONBOARDING).length,
        inactive: mockClients.filter(c => c.status === ClientStatus.INACTIVE).length
    }), []);

    const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
        { key: 'all', label: 'All Clients', count: statusCounts.all },
        { key: 'active', label: 'Active', count: statusCounts.active },
        { key: 'onboarding', label: 'Onboarding', count: statusCounts.onboarding },
        { key: 'inactive', label: 'Inactive', count: statusCounts.inactive }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Clients</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage your client accounts and their content
                    </p>
                </div>
                <button className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20">
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
                                                <span className="truncate">{client.company}</span>
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
                                            {client.contact_email.split('@')[0]}@...
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
