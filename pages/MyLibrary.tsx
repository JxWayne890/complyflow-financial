import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ContentStatus, ContentType } from '../types';
import StatusBadge from '../components/StatusBadge';
import { 
  Search, 
  Grid3X3, 
  List, 
  Plus,
  FileText,
  Linkedin,
  Facebook,
  Video,
  Megaphone,
  Calendar,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Filter
} from 'lucide-react';

// Mock data for demonstration
const mockContent = [
  {
    id: '1',
    title: 'Navigating Fixed Income in 2024',
    topic_text: 'How rising rates impact bond portfolios',
    content_type: ContentType.BLOG,
    status: ContentStatus.IN_REVIEW,
    updated_at: '2024-01-15T10:30:00Z',
    excerpt: 'Bond yields are attractive again after years of near-zero rates. Here is what investors should know...'
  },
  {
    id: '2',
    title: 'Retirement Planning Essentials',
    topic_text: 'Retirement planning 101 for professionals',
    content_type: ContentType.LINKEDIN,
    status: ContentStatus.APPROVED,
    updated_at: '2024-01-12T14:20:00Z',
    excerpt: 'Planning for retirement is one of the most important financial decisions you will make...'
  },
  {
    id: '3',
    title: 'Tax Harvesting Strategies',
    topic_text: 'Year-end tax loss harvesting tips',
    content_type: ContentType.VIDEO_SCRIPT,
    status: ContentStatus.DRAFT,
    updated_at: '2024-01-10T09:15:00Z',
    excerpt: 'Tax-loss harvesting can be a powerful tool in your investment strategy...'
  },
  {
    id: '4',
    title: 'Market Volatility Update',
    topic_text: 'Managing client expectations during volatility',
    content_type: ContentType.FACEBOOK,
    status: ContentStatus.CHANGES_REQUESTED,
    updated_at: '2024-01-08T16:45:00Z',
    excerpt: 'Market fluctuations are normal. Here is how to stay focused on long-term goals...'
  },
  {
    id: '5',
    title: 'Estate Planning Basics',
    topic_text: 'Introduction to estate planning',
    content_type: ContentType.BLOG,
    status: ContentStatus.APPROVED,
    updated_at: '2024-01-05T11:00:00Z',
    excerpt: 'Estate planning ensures your assets are distributed according to your wishes...'
  },
  {
    id: '6',
    title: 'Alternative Investments Overview',
    topic_text: 'Understanding alternative investment options',
    content_type: ContentType.BLOG,
    status: ContentStatus.SUBMITTED,
    updated_at: '2024-01-03T08:30:00Z',
    excerpt: 'Alternative investments can provide portfolio diversification beyond traditional stocks and bonds...'
  }
];

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'draft' | 'in_review' | 'approved';

const getContentTypeIcon = (type: ContentType) => {
  switch (type) {
    case ContentType.BLOG:
      return <FileText size={16} />;
    case ContentType.LINKEDIN:
      return <Linkedin size={16} />;
    case ContentType.FACEBOOK:
      return <Facebook size={16} />;
    case ContentType.VIDEO_SCRIPT:
      return <Video size={16} />;
    case ContentType.AD:
      return <Megaphone size={16} />;
    default:
      return <FileText size={16} />;
  }
};

const getContentTypeLabel = (type: ContentType) => {
  switch (type) {
    case ContentType.BLOG:
      return 'Blog Article';
    case ContentType.LINKEDIN:
      return 'LinkedIn Post';
    case ContentType.FACEBOOK:
      return 'Facebook Post';
    case ContentType.VIDEO_SCRIPT:
      return 'Video Script';
    case ContentType.AD:
      return 'Advertisement';
    default:
      return 'Content';
  }
};

const getContentTypeColor = (type: ContentType) => {
  switch (type) {
    case ContentType.BLOG:
      return 'bg-blue-50 text-blue-600';
    case ContentType.LINKEDIN:
      return 'bg-sky-50 text-sky-600';
    case ContentType.FACEBOOK:
      return 'bg-indigo-50 text-indigo-600';
    case ContentType.VIDEO_SCRIPT:
      return 'bg-purple-50 text-purple-600';
    case ContentType.AD:
      return 'bg-orange-50 text-orange-600';
    default:
      return 'bg-slate-50 text-slate-600';
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const MyLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const filteredContent = useMemo(() => {
    return mockContent.filter(item => {
      // Search filter
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.topic_text.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      let matchesStatus = true;
      if (filterStatus === 'draft') {
        matchesStatus = item.status === ContentStatus.DRAFT || item.status === ContentStatus.CHANGES_REQUESTED;
      } else if (filterStatus === 'in_review') {
        matchesStatus = item.status === ContentStatus.IN_REVIEW || item.status === ContentStatus.SUBMITTED;
      } else if (filterStatus === 'approved') {
        matchesStatus = item.status === ContentStatus.APPROVED;
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, filterStatus]);

  const statusCounts = useMemo(() => ({
    all: mockContent.length,
    draft: mockContent.filter(i => i.status === ContentStatus.DRAFT || i.status === ContentStatus.CHANGES_REQUESTED).length,
    in_review: mockContent.filter(i => i.status === ContentStatus.IN_REVIEW || i.status === ContentStatus.SUBMITTED).length,
    approved: mockContent.filter(i => i.status === ContentStatus.APPROVED).length
  }), []);

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All Content', count: statusCounts.all },
    { key: 'draft', label: 'Drafts', count: statusCounts.draft },
    { key: 'in_review', label: 'In Review', count: statusCounts.in_review },
    { key: 'approved', label: 'Approved', count: statusCounts.approved }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">My Library</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage all your content in one place
          </p>
        </div>
        <Link 
          to="/topics" 
          className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus size={18} />
          Create New
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filterStatus === tab.key 
                  ? 'bg-primary-50 text-primary-700 border border-primary-200' 
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                filterStatus === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid/List */}
      {filteredContent.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No content found</h3>
          <p className="text-slate-500 text-sm mb-6">
            {searchQuery ? 'Try adjusting your search or filters' : 'Get started by creating your first piece of content'}
          </p>
          {!searchQuery && (
            <Link 
              to="/topics"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              <Plus size={16} />
              Create your first content
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredContent.map(item => (
            <div 
              key={item.id} 
              className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300"
            >
              {/* Card Header */}
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getContentTypeColor(item.content_type)}`}>
                    {getContentTypeIcon(item.content_type)}
                    {getContentTypeLabel(item.content_type)}
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === item.id ? null : item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeDropdown === item.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 min-w-[140px]">
                        <Link 
                          to={`/content/${item.id}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={14} /> View
                        </Link>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left">
                          <Pencil size={14} /> Edit
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <Link to={`/content/${item.id}`}>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                </Link>
                
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                  {item.excerpt}
                </p>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={12} />
                  {formatDate(item.updated_at)}
                </div>
                <StatusBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredContent.map(item => (
              <div 
                key={item.id} 
                className="group p-4 hover:bg-slate-50 transition-colors flex items-center gap-4"
              >
                {/* Type Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getContentTypeColor(item.content_type)}`}>
                  {getContentTypeIcon(item.content_type)}
                </div>

                {/* Content Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link 
                      to={`/content/${item.id}`}
                      className="text-base font-semibold text-slate-900 group-hover:text-primary-600 transition-colors truncate"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{getContentTypeLabel(item.content_type)}</span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(item.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={item.status} />

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link 
                    to={`/content/${item.id}`}
                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Eye size={18} />
                  </Link>
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Pencil size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLibrary;
