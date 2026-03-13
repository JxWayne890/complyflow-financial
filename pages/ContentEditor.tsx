import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { createRoot, Root } from 'react-dom/client';
import { triggerContentGeneration, triggerReviewNotification, supabase } from '../services/supabaseClient';
import { UserRole, ContentStatus, ContentVersion, ComplianceReview, ComplianceHighlight, Profile, Client, CitationPayloadItem, CitationSourceItem } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  Wand2,
  Send,
  AlertTriangle,
  History,
  FileText,
  ChevronLeft,
  Check,
  XCircle,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Sparkles,
  Brain,
  PenTool,
  FileCheck,
  RefreshCw,
  Maximize2,
  Clipboard,
  X,
  Users,
  BookOpen,
  ArrowRight,
  Search,
  UserPlus,
  Building2,
  BarChart3,
  ShieldCheck,
  Lock,
  Unlock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const GENERATION_STEPS = [
  { id: 0, label: 'Connecting to AI Engine', icon: Sparkles, duration: 1500 },
  { id: 1, label: 'Analyzing Topic & Context', icon: Brain, duration: 2500 },
  { id: 2, label: 'Crafting Your Draft', icon: PenTool, duration: 8000 },
  { id: 3, label: 'Formatting & Polishing', icon: FileCheck, duration: 3000 },
];

const EXTENSION_STEPS = [
  { id: 0, label: 'Reading Current Draft', icon: Brain, duration: 2000 },
  { id: 1, label: 'Identifying Expansion Points', icon: Sparkles, duration: 3000 },
  { id: 2, label: 'Writing New Sections', icon: PenTool, duration: 8000 },
  { id: 3, label: 'Seamlessly Integrating', icon: FileCheck, duration: 3000 },
];
const NO_EM_DASH_INSTRUCTION =
  'Do not use em dashes (—), en dashes (–), or HTML dash entities (&mdash; or &ndash;). Use standard hyphen (-) or other punctuation instead.';
const REWRITE_PLAIN_TEXT_INSTRUCTION =
  'Return only the rewritten passage as plain text. Do not use Markdown syntax (such as #, *, **, _, `, lists), and do not wrap the answer in quotes or code fences.';
const BLOG_CHART_SLOT_SELECTOR = '[data-cf-chart-slot="true"]';
const INLINE_IMAGE_SELECTOR = 'figure[data-cf-inline-image="true"]';

interface ContentEditorProps {
  userRole: UserRole;
  profile: Profile | null;
}

type TextProvider = 'claude' | 'kimi';
type ImageProvider = 'gemini' | 'chatgpt';
type InlineHighlight = ComplianceHighlight & {
  local_state?: 'saving' | 'error';
  local_error?: string | null;
};

type GroundedGenerationOption = {
  id?: number;
  title: string;
  body: string;
  disclaimers?: string;
  chart_data?: any;
  chartData?: any;
  citations?: CitationPayloadItem[];
  sources?: CitationSourceItem[];
  source_limitations?: string;
  grounding_status?: 'grounded' | 'limited' | 'ungrounded';
};

const getChartHeight = (data: any) => (
  data?.type === 'horizontalBar'
    ? Math.max(300, (data.data?.length || 5) * 55)
    : 360
);

const getChartMinimumWidth = (data: any) => {
  switch (data?.type) {
    case 'horizontalBar':
      return 720;
    case 'pie':
      return 360;
    default:
      return 520;
  }
};

const ChartCard: React.FC<{ data: any; inline?: boolean }> = ({ data, inline = false }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const chartInstanceIdRef = useRef(`chart-${Math.random().toString(36).slice(2, 10)}`);
  const minimumWidth = getChartMinimumWidth(data);
  const chartHeight = getChartHeight(data);
  const lastValidWidthRef = useRef(minimumWidth);
  const [viewportWidth, setViewportWidth] = useState(minimumWidth);

  useEffect(() => {
    lastValidWidthRef.current = Math.max(lastValidWidthRef.current, minimumWidth);
    setViewportWidth((prev) => Math.max(prev, minimumWidth));
  }, [minimumWidth]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const updateWidth = () => {
      const measuredWidth = Math.floor(node.getBoundingClientRect().width);
      if (measuredWidth >= 240) {
        lastValidWidthRef.current = measuredWidth;
        setViewportWidth((prev) => (prev === measuredWidth ? prev : measuredWidth));
        return;
      }

      if (lastValidWidthRef.current > 0) {
        setViewportWidth((prev) => (
          prev === lastValidWidthRef.current ? prev : lastValidWidthRef.current
        ));
      }
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = window.requestAnimationFrame(updateWidth);
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [minimumWidth]);

  const renderWidth = Math.max(viewportWidth, minimumWidth);
  const areaFillId = `${chartInstanceIdRef.current}-area`;
  const multiLineFill1Id = `${chartInstanceIdRef.current}-ml-1`;
  const multiLineFill2Id = `${chartInstanceIdRef.current}-ml-2`;
  const multiLineFill3Id = `${chartInstanceIdRef.current}-ml-3`;

  if (!data) return null;

  return (
    <div
      className={inline ? 'not-prose my-10' : 'shrink-0 mt-12 pt-8 border-t border-slate-100'}
      contentEditable={false}
      suppressContentEditableWarning
    >
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <h3 style={{ fontFamily: "'Georgia', serif", fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
          {data.title || 'Data Overview'}
        </h3>

        {data.subtitle && (
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {data.subtitle}
          </p>
        )}

        <div className="overflow-x-auto overflow-y-hidden">
          <div ref={viewportRef} className="w-full min-w-0">
            <div style={{ width: `${renderWidth}px`, minWidth: `${minimumWidth}px`, height: `${chartHeight}px` }}>
              {data.type === 'stackedBar' ? (
                <BarChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                  {(data.stackKeys || ['value', 'value2', 'value3']).map((key: string, i: number) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={['#1a365f', '#b3822f', '#a2bbc3', '#4c6b36', '#7a2828', '#1f5c7a'][i % 6]} name={data.stackLabels?.[i] || key} />
                  ))}
                </BarChart>
              ) : data.type === 'horizontalBar' ? (
                <BarChart width={renderWidth} height={chartHeight} data={data.data} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155' }} width={160} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name={data.dataLabel || 'Value'}>
                    {(data.data || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#1a365f', '#1f2758', '#7a2828', '#b3822f', '#4c6b36', '#1f5c7a', '#83a762'][index % 7]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : data.type === 'areaLine' ? (
                <AreaChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                  <defs>
                    <linearGradient id={areaFillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7a2828" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7a2828" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#7a2828" strokeWidth={2.5} fill={`url(#${areaFillId})`} dot={{ r: 4, fill: '#7a2828', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={data.dataLabel || 'Value'} />
                  {data.dataKey2 && <Area type="monotone" dataKey="value2" stroke="#b3822f" strokeWidth={2.5} fill="transparent" dot={{ r: 4, fill: '#b3822f', strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel2 || 'Value 2'} />}
                  {data.dataKey3 && <Area type="monotone" dataKey="value3" stroke="#4c6b36" strokeWidth={2.5} fill="transparent" dot={{ r: 4, fill: '#4c6b36', strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel3 || 'Value 3'} />}
                </AreaChart>
              ) : data.type === 'multiLine' ? (
                <AreaChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                  <defs>
                    <linearGradient id={multiLineFill1Id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1a365f" stopOpacity={0.12} /><stop offset="95%" stopColor="#1a365f" stopOpacity={0.01} /></linearGradient>
                    <linearGradient id={multiLineFill2Id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b3822f" stopOpacity={0.12} /><stop offset="95%" stopColor="#b3822f" stopOpacity={0.01} /></linearGradient>
                    <linearGradient id={multiLineFill3Id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4c6b36" stopOpacity={0.12} /><stop offset="95%" stopColor="#4c6b36" stopOpacity={0.01} /></linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#1a365f" strokeWidth={2.5} fill={`url(#${multiLineFill1Id})`} dot={{ r: 4, fill: '#1a365f', strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel || 'Series 1'} />
                  {data.dataKey2 && <Area type="monotone" dataKey="value2" stroke="#b3822f" strokeWidth={2.5} fill={`url(#${multiLineFill2Id})`} dot={{ r: 4, fill: '#b3822f', strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel2 || 'Series 2'} />}
                  {data.dataKey3 && <Area type="monotone" dataKey="value3" stroke="#4c6b36" strokeWidth={2.5} fill={`url(#${multiLineFill3Id})`} dot={{ r: 4, fill: '#4c6b36', strokeWidth: 2, stroke: '#fff' }} name={data.dataLabel3 || 'Series 3'} />}
                </AreaChart>
              ) : data.type === 'line' ? (
                <LineChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                  <Line type="monotone" dataKey="value" stroke="#1a365f" strokeWidth={2.5} dot={{ r: 4, fill: '#1a365f', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={data.dataLabel || 'Value'} />
                  {data.dataKey2 && <Line type="monotone" dataKey="value2" stroke="#b3822f" strokeWidth={2.5} dot={{ r: 4, fill: '#b3822f', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={data.dataLabel2 || 'Value 2'} />}
                </LineChart>
              ) : data.type === 'pie' ? (
                <PieChart width={renderWidth} height={chartHeight}>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: '13px' }} />
                  <Pie data={data.data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {(data.data || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#1a365f', '#b3822f', '#a2bbc3', '#4c6b36', '#7a2828', '#1f5c7a'][index % 6]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart width={renderWidth} height={chartHeight} data={data.data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={data.yAxisPercent ? ((v: number) => `${v}%`) : undefined} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={data.yAxisPercent ? ((value: number) => `${value}%`) : undefined} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                  <Bar dataKey="value" fill="#1a365f" radius={[4, 4, 0, 0]} name={data.dataLabel || 'Value'} />
                  {data.dataKey2 && <Bar dataKey="value2" fill="#b3822f" radius={[4, 4, 0, 0]} name={data.dataLabel2 || 'Value 2'} />}
                </BarChart>
              )}
            </div>
          </div>
        </div>

        {data.source && (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '16px', lineHeight: 1.5 }}>
            {data.source}
          </p>
        )}
      </div>
    </div>
  );
};

const ContentEditor: React.FC<ContentEditorProps> = ({ userRole, profile }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id } = useParams(); // contentRequestId
  const existingId = searchParams.get('existingId');
  const [requestId, setRequestId] = useState<string | null>(id || existingId || null);
  const clientId = searchParams.get('clientId');

  // State
  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [contentType, setContentType] = useState('blog');
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [savingImageIndex, setSavingImageIndex] = useState<number | null>(null);
  const [generatedTextOptions, setGeneratedTextOptions] = useState<any[]>([]);
  const [showTextSelection, setShowTextSelection] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save to Client state
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isSavingToClient, setIsSavingToClient] = useState(false);
  const [savedClientName, setSavedClientName] = useState<string | null>(null);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);

  // Iframe Select & Fix State
  const [stableIframeSrcDoc, setStableIframeSrcDoc] = useState('');
  const lastIframeBodyRef = useRef('');
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);

  // Content State
  const [content, setContent] = useState<ContentVersion | null>(null);
  const [status, setStatus] = useState<ContentStatus>(ContentStatus.DRAFT);
  const [reviews, setReviews] = useState<ComplianceReview[]>([]);
  const [complianceHighlights, setComplianceHighlights] = useState<InlineHighlight[]>([]);
  const complianceHighlightsRef = useRef<InlineHighlight[]>([]);
  useEffect(() => { complianceHighlightsRef.current = complianceHighlights; }, [complianceHighlights]);
  const [updatingHighlightId, setUpdatingHighlightId] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [isGeneratorExpanded, setIsGeneratorExpanded] = useState(true);
  const [isNotesListExpanded, setIsNotesListExpanded] = useState(true);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [lastReviewerName, setLastReviewerName] = useState<string | null>(null);

  const [complianceTeam, setComplianceTeam] = useState<{ id: string; name: string; email: string }[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isApprovedLocked, setIsApprovedLocked] = useState(false);

  // Auto-lock content when status becomes APPROVED
  useEffect(() => {
    if (status === ContentStatus.APPROVED) {
      setIsApprovedLocked(true);
    }
  }, [status]);

  // Resizable Notes Panel State
  const MIN_NOTES_WIDTH = 250;
  const MAX_NOTES_WIDTH = 600;
  const DEFAULT_NOTES_WIDTH = 380;
  const [notesWidth, setNotesWidth] = useState(DEFAULT_NOTES_WIDTH);
  const [isResizingNotes, setIsResizingNotes] = useState(false);

  const startResizingNotes = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingNotes(true);
  }, []);

  const stopResizingNotes = useCallback(() => {
    setIsResizingNotes(false);
  }, []);

  const resizeNotes = useCallback((e: MouseEvent) => {
    if (isResizingNotes) {
      // Calculate width inversely or directly based on layout. 
      // Assuming it's on the left side, width is just the mouse X position
      // minus whatever the left sidebar width is.
      // But it's easier to use movementX or just bounding client rect.
      // For simplicity, let's just use movement.

      const newWidth = e.clientX - 288; // rough offset of the main sidebar. We'll fine tune this.
      // Better approach: use getBoundingClientRect on a ref if needed, but since it's flush left after sidebar:
      // We can just rely on the mouse position minus sidebar width if sidebar is fixed,
      // But since sidebar is ALSO resizable now, this will break if we hardcode 288.

      // Let's use a ref to the panel itself to get its left position.
    }
  }, [isResizingNotes]);

  // We need a safer way to resize that doesn't depend on the absolute X position 
  // since the main layout sidebar can change widths.
  // Using movementX is safer.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingNotes) return;
      setNotesWidth(prev => {
        const newWidth = prev + e.movementX;
        return Math.min(Math.max(newWidth, MIN_NOTES_WIDTH), MAX_NOTES_WIDTH);
      });
    };

    if (isResizingNotes) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizingNotes);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizingNotes);
    };
  }, [isResizingNotes, stopResizingNotes]);


  const fetchComplianceTeam = useCallback(async () => {
    if (!profile?.org_id) return;
    setComplianceLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('org_id', profile.org_id)
        .eq('role', 'compliance');
      if (error) throw error;
      setComplianceTeam(data || []);
    } catch (err) {
      console.error('Failed to fetch compliance team:', err);
      setComplianceTeam([]);
    } finally {
      setComplianceLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    if (showComplianceModal) {
      fetchComplianceTeam();
    }
  }, [showComplianceModal, fetchComplianceTeam]);

  const loadRequestData = useCallback(async (requestIdToLoad: string) => {
    setIsLoadingRequest(true);
    setError(null);
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('content_requests')
        .select('*')
        .eq('id', requestIdToLoad)
        .single();

      if (requestError) throw requestError;

      setTopic(requestData.topic_text || '');
      setContentType(requestData.content_type || 'blog');
      setInstructions(requestData.instructions || '');
      setStatus((requestData.status as ContentStatus) || ContentStatus.DRAFT);
      setRequestId(requestData.id);
      setSavedClientName(null);
      setSavedClientId(requestData.client_id || null);

      // If a client was already assigned, load their name
      if (requestData.client_id) {
        setSavedClientName('Assigned Client');
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('name')
          .eq('id', requestData.client_id)
          .maybeSingle();
        if (!clientError && clientData?.name) {
          setSavedClientName(clientData.name);
        }
      }

      const { data: latestVersionData, error: latestVersionError } = await supabase
        .from('content_versions')
        .select('*')
        .eq('request_id', requestIdToLoad)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersionError) throw latestVersionError;
      const loadedChartData = latestVersionData?.chart_data || null;
      const loadedCitations = (latestVersionData?.citation_payload || []) as CitationPayloadItem[];
      const loadedSources = (latestVersionData?.source_payload || []) as CitationSourceItem[];
      setChartData(loadedChartData);
      setCitations(loadedCitations);
      setSources(loadedSources);
      setSourceLimitations(latestVersionData?.source_limitations || '');
      setGroundingStatus((latestVersionData?.grounding_status as 'grounded' | 'limited' | 'ungrounded' | null) || null);
      setContent(
        latestVersionData
          ? {
            ...latestVersionData,
            body: requestData.content_type === 'blog'
              ? ensureBlogChartSlot(sanitizeBlogBodyForStorage(latestVersionData.body || ''), loadedChartData)
              : latestVersionData.body,
          }
          : null
      );

      // Fallback: if request.client_id is missing but this version was shared, derive client from share record.
      if (!requestData.client_id && latestVersionData?.id) {
        const { data: latestShare, error: shareError } = await supabase
          .from('client_content_shares')
          .select('client_id, shared_at, clients:client_id(name)')
          .eq('content_version_id', latestVersionData.id)
          .order('shared_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!shareError && latestShare?.client_id) {
          const fallbackName = (latestShare as any)?.clients?.name || null;
          setSavedClientId(latestShare.client_id);
          setSavedClientName(fallbackName || 'Assigned Client');
        }
      }

      const { data: reviewData, error: reviewError } = await supabase
        .from('compliance_reviews')
        .select('id, decision, notes, reviewer_id, created_at')
        .eq('request_id', requestIdToLoad)
        .order('created_at', { ascending: false });

      if (reviewError) throw reviewError;
      setReviews((reviewData || []) as ComplianceReview[]);

      // Look up the last reviewer's name for the "Resubmit to [Name]" button
      const lastReviewerId = (reviewData || []).find((r: any) => r.reviewer_id)?.reviewer_id;
      if (lastReviewerId) {
        const { data: reviewerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', lastReviewerId)
          .single();
        setLastReviewerName(reviewerProfile?.name || null);
      }

      const { data: highlightData, error: highlightError } = await supabase
        .from('compliance_highlights')
        .select('id, org_id, request_id, version_id, highlight_id, selected_text, note, status, created_by, resolved_by, resolution_note, resolved_at, created_at')
        .eq('request_id', requestIdToLoad)
        .order('created_at', { ascending: false });

      if (highlightError) throw highlightError;
      setComplianceHighlights((highlightData || []) as InlineHighlight[]);
    } catch (e: any) {
      console.error("Failed to load content request:", e);
      if (e?.code === '42P01') {
        setComplianceHighlights([]);
        setError('`compliance_highlights` table is missing. Run the new migration before using inline compliance notes.');
      } else {
        setError(e.message || 'Failed to load content request.');
      }
    } finally {
      setIsLoadingRequest(false);
    }
  }, []);

  useEffect(() => {
    const targetId = id || existingId;
    if (!targetId) return;
    void loadRequestData(targetId);
  }, [id, existingId, loadRequestData]);

  const [generationMode, setGenerationMode] = useState<'text' | 'image' | 'both'>('text');
  const [textProvider, setTextProvider] = useState<TextProvider>('claude');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('gemini');
  const [contentLength, setContentLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [shortDuration, setShortDuration] = useState<1 | 2 | 3>(1);
  const [variationCount, setVariationCount] = useState<number>(1);
  const [chartData, setChartData] = useState<any | null>(null);
  const [citations, setCitations] = useState<CitationPayloadItem[]>([]);
  const [sources, setSources] = useState<CitationSourceItem[]>([]);
  const [sourceLimitations, setSourceLimitations] = useState<string>('');
  const [groundingStatus, setGroundingStatus] = useState<'grounded' | 'limited' | 'ungrounded' | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitationPayloadItem | null>(null);
  const [sourceUrlsInput, setSourceUrlsInput] = useState('');
  const [generationStep, setGenerationStep] = useState(0);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVideoScript = contentType === 'video_script';
  const isBlogArticle = contentType === 'blog';
  const inlineChartRootsRef = useRef<Map<HTMLElement, Root>>(new Map());
  const inlineChartSyncFrameRef = useRef<number | null>(null);
  const isInlineChartSyncingRef = useRef(false);

  const [extensionStep, setExtensionStep] = useState(0);
  const extensionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const parseSourceUrls = (rawValue: string) =>
    rawValue
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('http://') || entry.startsWith('https://'))
      .slice(0, 6);

  const openCitationByMarker = useCallback((marker: string | null | undefined) => {
    if (!marker) return;
    const match = citations.find((citation) => citation.marker === marker);
    if (match) {
      setActiveCitation(match);
    }
  }, [citations]);

  const sanitizeBlogBodyForStorage = useCallback((html: string) => {
    if (!html || html.includes('<!DOCTYPE html>')) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll<HTMLElement>(BLOG_CHART_SLOT_SELECTOR).forEach((slot, index) => {
      if (index > 0) {
        slot.remove();
        return;
      }
      slot.innerHTML = '';
      slot.setAttribute('contenteditable', 'false');
    });

    return doc.body.innerHTML.trim();
  }, []);

  const ensureBlogChartSlot = useCallback((html: string, nextChartData: any | null) => {
    if (!html || html.includes('<!DOCTYPE html>')) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const existingSlots = Array.from(body.querySelectorAll<HTMLElement>(BLOG_CHART_SLOT_SELECTOR));

    if (!nextChartData) {
      existingSlots.forEach((slot) => slot.remove());
      return body.innerHTML.trim();
    }

    let slot = existingSlots[0] || null;
    existingSlots.slice(1).forEach((extraSlot) => extraSlot.remove());

    if (!slot) {
      slot = doc.createElement('div');
      slot.setAttribute('data-cf-chart-slot', 'true');
    }

    slot.innerHTML = '';
    slot.setAttribute('contenteditable', 'false');

    if (!slot.parentElement) {
      const paragraphs = Array.from(body.children).filter((child) => child.tagName === 'P');
      if (paragraphs.length >= 3) {
        body.insertBefore(slot, paragraphs[Math.min(2, paragraphs.length - 1)]);
      } else if (paragraphs.length === 2) {
        body.insertBefore(slot, paragraphs[1]);
      } else if (paragraphs.length === 1) {
        if (paragraphs[0].nextSibling) {
          body.insertBefore(slot, paragraphs[0].nextSibling);
        } else {
          body.appendChild(slot);
        }
      } else if (body.children.length > 1) {
        body.insertBefore(slot, body.children[Math.max(1, body.children.length - 1)]);
      } else {
        body.appendChild(slot);
      }
    }

    return body.innerHTML.trim();
  }, []);

  const normalizeBlogBodyWithChartSlot = useCallback((html: string, nextChartData: any | null) => {
    const sanitized = sanitizeBlogBodyForStorage(html);
    return ensureBlogChartSlot(sanitized, nextChartData);
  }, [ensureBlogChartSlot, sanitizeBlogBodyForStorage]);

  const normalizeInlineImageHtml = useCallback((html: string) => {
    if (!html) return html;
    if (html.includes('data-cf-inline-image="true"')) return html;
    return html.replace(/<figure\b/i, '<figure data-cf-inline-image="true"');
  }, []);

  const insertInlineImageIntoBlogBody = useCallback((html: string, imageHtml: string, nextChartData: any | null) => {
    if (!html || html.includes('<!DOCTYPE html>')) return normalizeInlineImageHtml(imageHtml);

    const parser = new DOMParser();
    const doc = parser.parseFromString(ensureBlogChartSlot(html, nextChartData), 'text/html');
    const body = doc.body;
    const normalizedImageHtml = normalizeInlineImageHtml(imageHtml);
    const imageDoc = parser.parseFromString(normalizedImageHtml, 'text/html');
    const imageElement = imageDoc.body.firstElementChild;

    if (!imageElement) {
      return ensureBlogChartSlot(html, nextChartData);
    }

    const existingInlineImage = body.querySelector(INLINE_IMAGE_SELECTOR);
    if (existingInlineImage) {
      existingInlineImage.replaceWith(imageElement);
      return sanitizeBlogBodyForStorage(body.innerHTML);
    }

    const topLevelFigure = Array.from(body.children).find((child) => child.tagName === 'FIGURE');
    if (topLevelFigure && (topLevelFigure === body.firstElementChild || topLevelFigure === body.lastElementChild)) {
      topLevelFigure.replaceWith(imageElement);
      return sanitizeBlogBodyForStorage(body.innerHTML);
    }

    const paragraphs = Array.from(body.children).filter((child) => child.tagName === 'P');
    const chartSlot = body.querySelector(BLOG_CHART_SLOT_SELECTOR);

    if (paragraphs.length >= 2) {
      body.insertBefore(imageElement, paragraphs[1]);
    } else if (paragraphs.length === 1) {
      if (chartSlot) {
        body.insertBefore(imageElement, chartSlot);
      } else if (paragraphs[0].nextSibling) {
        body.insertBefore(imageElement, paragraphs[0].nextSibling);
      } else {
        body.appendChild(imageElement);
      }
    } else if (chartSlot) {
      body.insertBefore(imageElement, chartSlot);
    } else {
      body.appendChild(imageElement);
    }

    return sanitizeBlogBodyForStorage(body.innerHTML);
  }, [ensureBlogChartSlot, normalizeInlineImageHtml, sanitizeBlogBodyForStorage]);

  // Cycle through generation steps while generating
  useEffect(() => {
    if (isGenerating) {
      setGenerationStep(0);
      let currentStep = 0;

      const advanceStep = () => {
        if (currentStep < GENERATION_STEPS.length - 1) {
          currentStep++;
          setGenerationStep(currentStep);
          stepTimerRef.current = setTimeout(advanceStep, GENERATION_STEPS[currentStep].duration);
        }
      };

      stepTimerRef.current = setTimeout(advanceStep, GENERATION_STEPS[0].duration);

      return () => {
        if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      };
    }
  }, [isGenerating]);

  // Cycle through extension steps
  useEffect(() => {
    if (isExtending) {
      setExtensionStep(0);
      let currentStep = 0;

      const advanceStep = () => {
        if (currentStep < EXTENSION_STEPS.length - 1) {
          currentStep++;
          setExtensionStep(currentStep);
          extensionTimerRef.current = setTimeout(advanceStep, EXTENSION_STEPS[currentStep].duration);
        }
      };

      extensionTimerRef.current = setTimeout(advanceStep, EXTENSION_STEPS[0].duration);

      return () => {
        if (extensionTimerRef.current) clearTimeout(extensionTimerRef.current);
      };
    }
  }, [isExtending]);

  const canAddComplianceHighlights =
    (userRole === UserRole.COMPLIANCE || userRole === UserRole.ADMIN)
    && [ContentStatus.SUBMITTED, ContentStatus.IN_REVIEW, ContentStatus.CHANGES_REQUESTED, ContentStatus.APPROVED].includes(status);

  const isComplianceNoteOnlyPill = userRole === UserRole.COMPLIANCE;

  const canResolveComplianceHighlights =
    (userRole === UserRole.ADVISOR || userRole === UserRole.COMPLIANCE || userRole === UserRole.ADMIN);

  useEffect(() => {
    if (complianceHighlights.length === 0) {
      setExpandedNoteIds(new Set());
      return;
    }
  }, [complianceHighlights]);

  const ensureRequestId = async (): Promise<string> => {
    if (!profile?.id || !profile?.org_id) {
      throw new Error('Missing profile or organization context. Please log in again.');
    }

    const parsedClientId = clientId && clientId !== 'null' ? clientId : null;

    if (requestId) {
      const updates: any = {
        topic_text: topic,
        content_type: contentType,
        instructions,
        updated_at: new Date().toISOString(),
      };

      // Do not clear an existing client assignment when URL has no clientId param.
      // Keep the currently assigned client for this request unless a new one is explicitly provided.
      if (parsedClientId) {
        updates.client_id = parsedClientId;
      } else if (savedClientId) {
        updates.client_id = savedClientId;
      }

      if (status === ContentStatus.CHANGES_REQUESTED) {
        updates.status = ContentStatus.DRAFT;
      }

      const { error: requestUpdateError } = await supabase
        .from('content_requests')
        .update(updates)
        .eq('id', requestId);

      if (requestUpdateError) throw requestUpdateError;
      if (updates.status) setStatus(updates.status);
      if (updates.client_id) setSavedClientId(updates.client_id);
      return requestId;
    }

    console.log("Creating request with:", {
      advisor_id: profile.id,
      org_id: profile.org_id,
      role: profile.role,
      clientId: parsedClientId
    });

    const { data: requestData, error: requestError } = await supabase
      .from('content_requests')
      .insert({
        topic_text: topic,
        content_type: contentType,
        instructions,
        status: ContentStatus.DRAFT,
        advisor_id: profile.id,
        org_id: profile.org_id,
        client_id: parsedClientId,
      })
      .select('id')
      .single();

    if (requestError) {
      if (requestError.code === '42501' || requestError.message?.includes('row-level security')) {
        const errorDetails = `RLS Policy Violation. Your current role is '${profile.role}'. The database requires 'advisor' or 'admin' to create content. ID: ${profile.id}, Org: ${profile.org_id}`;
        throw new Error(errorDetails);
      }
      throw requestError;
    }
    setRequestId(requestData.id);
    if (parsedClientId) setSavedClientId(parsedClientId);
    return requestData.id;
  };

  const createContentVersion = async (targetRequestId: string, payload: {
    generated_by: 'ai' | 'human';
    title: string;
    body: string;
    disclaimers?: string;
    chart_data?: any;
    citation_payload?: CitationPayloadItem[];
    source_payload?: CitationSourceItem[];
    source_limitations?: string;
    grounding_status?: 'grounded' | 'limited' | 'ungrounded' | null;
  }) => {
    const sanitizeNoEmDashes = (input: string | null | undefined): string => {
      if (!input) return '';
      return input
        .replace(/&(m|n)dash;/gi, '-')
        .replace(/&#821[12];/g, '-')
        .replace(/&#x201[34];?/gi, '-')
        .replace(/[—–]/g, '-');
    };

    const sanitizedTitle = sanitizeNoEmDashes(payload.title);
    const normalizedBody = isBlogArticle
      ? normalizeBlogBodyWithChartSlot(payload.body, payload.chart_data ?? null)
      : sanitizeBlogBodyForStorage(payload.body);
    const sanitizedBody = sanitizeNoEmDashes(normalizedBody);
    const sanitizedDisclaimers = sanitizeNoEmDashes(payload.disclaimers);

    const nextVersion = (content?.version_number || 0) + 1;
    const { data: versionData, error: versionError } = await supabase
      .from('content_versions')
      .insert({
        request_id: targetRequestId,
        version_number: nextVersion,
        generated_by: payload.generated_by,
        title: sanitizedTitle,
        body: sanitizedBody,
        disclaimers: sanitizedDisclaimers || null,
        chart_data: payload.chart_data ?? null,
        citation_payload: payload.citation_payload ?? [],
        source_payload: payload.source_payload ?? [],
        source_limitations: payload.source_limitations ?? null,
        grounding_status: payload.grounding_status ?? null,
      })
      .select('*')
      .single();

    if (versionError) throw versionError;

    const { error: requestUpdateError } = await supabase
      .from('content_requests')
      .update({
        current_version_id: versionData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetRequestId);

    if (requestUpdateError) throw requestUpdateError;

    return versionData as ContentVersion;
  };

  const saveCurrentEditorVersion = async (targetRequestId: string) => {
    if (!content) return null;
    const latestBodyRaw = editorRef.current?.innerHTML || content.body || '';
    const latestBody = isBlogArticle
      ? normalizeBlogBodyWithChartSlot(
        latestBodyRaw.replace(/class="new-content-highlight"/g, '').trim(),
        chartData,
      )
      : sanitizeBlogBodyForStorage(
        latestBodyRaw.replace(/class="new-content-highlight"/g, '').trim()
      );
    const latestTitle = (content.title || '').trim();
    const existingBody = isBlogArticle
      ? normalizeBlogBodyWithChartSlot(
        (content.body || '').replace(/class="new-content-highlight"/g, '').trim(),
        chartData,
      )
      : sanitizeBlogBodyForStorage(
        (content.body || '').replace(/class="new-content-highlight"/g, '').trim()
      );
    const existingTitle = (content.title || '').trim();

    if (latestBody === existingBody && latestTitle === existingTitle) {
      return content;
    }

    const savedVersion = await createContentVersion(targetRequestId, {
      generated_by: 'human',
      title: latestTitle,
      body: latestBody,
      disclaimers: content.disclaimers,
      chart_data: chartData,
      citation_payload: citations,
      source_payload: sources,
      source_limitations: sourceLimitations,
      grounding_status: groundingStatus,
    });

    setContent(savedVersion);
    return savedVersion;
  };

  const handleComplianceDecision = async (decision: 'approved' | 'changes_requested' | 'rejected') => {
    if (!requestId || !profile?.id) {
      setError('Missing content request or profile context.');
      return;
    }

    const notePrompt = decision === 'approved'
      ? 'Optional approval note:'
      : decision === 'changes_requested'
        ? 'Enter requested changes for the advisor:'
        : 'Enter rejection reason:';

    // If inline highlights exist for changes_requested, auto-populate the note
    const openHighlightCount = complianceHighlights.filter(h => h.status === 'open').length;
    let noteValue: string;
    if (decision === 'changes_requested' && openHighlightCount > 0) {
      noteValue = window.prompt(
        notePrompt + `\n\n(${openHighlightCount} inline note(s) are already attached to this blog.)`,
        `See ${openHighlightCount} inline highlight note(s) for specific changes.`
      ) ?? '';
    } else {
      noteValue = window.prompt(notePrompt) ?? '';
    }
    if (decision !== 'approved' && !noteValue.trim() && openHighlightCount === 0) {
      return;
    }

    try {
      setError(null);
      await saveCurrentEditorVersion(requestId);

      const { data: reviewData, error: reviewError } = await supabase
        .from('compliance_reviews')
        .insert({
          request_id: requestId,
          reviewer_id: profile.id,
          decision,
          notes: noteValue.trim() || null,
        })
        .select('id, decision, notes, reviewer_id, created_at')
        .single();

      if (reviewError) throw reviewError;

      const nextStatus =
        decision === 'approved'
          ? ContentStatus.APPROVED
          : decision === 'changes_requested'
            ? ContentStatus.CHANGES_REQUESTED
            : ContentStatus.REJECTED;

      const { error: requestUpdateError } = await supabase
        .from('content_requests')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestUpdateError) throw requestUpdateError;

      setStatus(nextStatus);
      setReviews(prev => [reviewData as ComplianceReview, ...prev]);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to record compliance decision.');
    }
  };

  const extractChartData = (htmlBody: string): { body: string; chartData: any | null } => {
    try {
      const regex = /<script[^>]*id=["']chart-data["'][^>]*>([\s\S]*?)<\/script>/i;
      const match = htmlBody.match(regex);

      if (!match) return { body: htmlBody, chartData: null };

      let jsonString = match[1].trim();
      // Remove markdown formatting if the AI added it inside or around the script tag
      jsonString = jsonString.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();

      const parsedData = JSON.parse(jsonString);

      let cleanedBody = htmlBody.replace(match[0], '');
      // Clean up stray markdown artifacts and empty paragraphs left behind
      cleanedBody = cleanedBody.replace(/<p>\s*```(?:html|json)?\s*<\/p>/gi, '');
      cleanedBody = cleanedBody.replace(/```(?:html|json)?/gi, '');
      cleanedBody = cleanedBody.replace(/<p>\s*<\/p>/gi, '');

      return { body: cleanedBody.trim(), chartData: parsedData };
    } catch (e) {
      console.error("Failed to parse chart data from AI response", e);
      return { body: htmlBody, chartData: null };
    }
  };

  const handleGenerate = async () => {
    if (!profile?.id || !profile?.org_id) {
      alert("Missing profile or organization context. Please ensure you are logged in correctly.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep(0);
    setError(null);

    // Create specific instructions based on content type
    let finalInstructions = instructions;
    if (contentType === 'Social Media Post') {
      finalInstructions += " Format specifically for LinkedIn/Twitter with engaging hooks and hashtags.";
    } else if (contentType === 'Client Email') {
      finalInstructions += " Use a professional email structure with Subject Line.";
    } else if (contentType === 'Video Script') {
      finalInstructions += " Use a two-column script format (Visual | Audio).";
    }
    finalInstructions += ` ${NO_EM_DASH_INSTRUCTION}`;
    const selectedSourceUrls = parseSourceUrls(sourceUrlsInput);

    try {
      const currentRequestId = await ensureRequestId();

      if (generationMode === 'image') {
        setChartData(null);
        // IMAGE-ONLY mode: use the image provider directly
        const imageResponse: any = await triggerContentGeneration({
          topic,
          contentType,
          instructions: finalInstructions || 'Generate a high-quality financial illustration.',
          provider: imageProvider,
          count: variationCount,
          orgId: profile.org_id,
          requestId: currentRequestId,
          sourceUrls: selectedSourceUrls,
        });

        // Always create/reset content to image-only (clear any previous text body)
        const placeholderVersion = await createContentVersion(currentRequestId, {
          generated_by: 'ai',
          title: `Visual Asset: ${topic}`,
          body: '',
          disclaimers: imageResponse.data?.disclaimers || '',
          chart_data: null,
          citation_payload: [],
          source_payload: [],
          source_limitations: '',
          grounding_status: null,
        });
        setCitations([]);
        setSources([]);
        setSourceLimitations('');
        setGroundingStatus(null);
        setContent(placeholderVersion);

        if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 1) {
          setGeneratedImages(imageResponse.data.images);
          setShowImageSelection(true);
        } else if (imageResponse.data) {
          // Single image fallback — image only, no text
          const imgHtml = imageResponse.data.body;
          const savedVersion = await createContentVersion(currentRequestId, {
            generated_by: 'ai',
            title: `Visual Asset: ${topic}`,
            body: imgHtml,
            disclaimers: imageResponse.data.disclaimers || '',
            chart_data: null,
            citation_payload: [],
            source_payload: [],
            source_limitations: '',
            grounding_status: null,
          });
          setCitations([]);
          setSources([]);
          setSourceLimitations('');
          setGroundingStatus(null);
          setContent(savedVersion);
        }
      } else {
        // TEXT or BOTH mode: generate text first
        let generateResponse: any;

        if (textProvider === 'kimi') {
          // Kimi API is slower and times out on Supabase Edge Functions when count is high
          // Workaround: fire separate requests of count: 1 from the client
          const promises = Array(variationCount).fill(null).map((_, i) =>
            triggerContentGeneration({
              topic,
              contentType,
              instructions: finalInstructions + (i > 0 ? `\n\nVARIATION INSTRUCTION: Make this variation distinct.` : ''),
              provider: textProvider,
              contentLength,
              count: 1,
              orgId: profile.org_id,
              requestId: currentRequestId,
              sourceUrls: selectedSourceUrls,
              ...(isVideoScript ? { videoDuration: contentLength === 'Short' ? shortDuration : undefined } : {}),
            }).catch(e => ({ error: true, message: e.message }))
          );

          const results = await Promise.all(promises);
          const successfulResults = results.filter((r: any) => !r.error && r.data);

          if (successfulResults.length === 0) {
            throw new Error((results[0] as any)?.message || 'Failed to generate content with Kimi. Please check compute resources.');
          }

          // Combine the separate calls back into the expected shape
          generateResponse = {
            data: {
              title: successfulResults[0].data.title || successfulResults[0].data.options?.[0]?.title,
              body: successfulResults[0].data.body || successfulResults[0].data.options?.[0]?.body,
              disclaimers: successfulResults[0].data.disclaimers || successfulResults[0].data.options?.[0]?.disclaimers,
              citations: successfulResults[0].data.citations || successfulResults[0].data.options?.[0]?.citations || [],
              sources: successfulResults[0].data.sources || successfulResults[0].data.options?.[0]?.sources || [],
              source_limitations: successfulResults[0].data.source_limitations || successfulResults[0].data.options?.[0]?.source_limitations || '',
              grounding_status: successfulResults[0].data.grounding_status || successfulResults[0].data.options?.[0]?.grounding_status || null,
              chart_data: successfulResults[0].data.chart_data || successfulResults[0].data.options?.[0]?.chart_data || null,
              options: successfulResults.map((r: any, idx: number) => ({
                ...(r.data.options ? r.data.options[0] : r.data),
                id: idx
              }))
            }
          };
        } else {
          // Claude works fine making multiple variations on the edge
          generateResponse = await triggerContentGeneration({
            topic,
            contentType,
            instructions: finalInstructions,
            provider: textProvider,
            contentLength,
            count: variationCount,
            orgId: profile.org_id,
            requestId: currentRequestId,
            sourceUrls: selectedSourceUrls,
            ...(isVideoScript ? { videoDuration: contentLength === 'Short' ? shortDuration : undefined } : {}),
          });
        }

        let savedVersion: any = null;

        if (generateResponse.data && generateResponse.data.options && generateResponse.data.options.length > 1) {
          // Process options for chart data
          const processedOptions = generateResponse.data.options.map((opt: any) => {
            const { body, chartData } = extractChartData(opt.body);
            return { ...opt, body, chartData: chartData ?? opt.chart_data ?? null };
          });

          setGeneratedTextOptions(processedOptions);
          setShowTextSelection(true);

          const firstOption = processedOptions[0];
          setChartData(firstOption.chartData ?? null);
          setCitations((firstOption.citations || []) as CitationPayloadItem[]);
          setSources((firstOption.sources || []) as CitationSourceItem[]);
          setSourceLimitations(firstOption.source_limitations || '');
          setGroundingStatus(firstOption.grounding_status || null);

          savedVersion = await createContentVersion(currentRequestId, {
            generated_by: 'ai',
            title: firstOption.title,
            body: isBlogArticle ? ensureBlogChartSlot(firstOption.body, firstOption.chartData) : firstOption.body,
            disclaimers: firstOption.disclaimers,
            chart_data: firstOption.chartData ?? null,
            citation_payload: firstOption.citations || [],
            source_payload: firstOption.sources || [],
            source_limitations: firstOption.source_limitations || '',
            grounding_status: firstOption.grounding_status || null,
          });
          setContent(savedVersion);
        } else if (generateResponse.data) {
          const { body: cleanedBody, chartData: parsedChartData } = extractChartData(generateResponse.data.body);
          setChartData(parsedChartData ?? generateResponse.data.chart_data ?? null);
          setCitations((generateResponse.data.citations || []) as CitationPayloadItem[]);
          setSources((generateResponse.data.sources || []) as CitationSourceItem[]);
          setSourceLimitations(generateResponse.data.source_limitations || '');
          setGroundingStatus(generateResponse.data.grounding_status || null);

          savedVersion = await createContentVersion(currentRequestId, {
            generated_by: 'ai',
            title: generateResponse.data.title,
            body: isBlogArticle ? ensureBlogChartSlot(cleanedBody, parsedChartData ?? generateResponse.data.chart_data ?? null) : cleanedBody,
            disclaimers: generateResponse.data.disclaimers,
            chart_data: parsedChartData ?? generateResponse.data.chart_data ?? null,
            citation_payload: generateResponse.data.citations || [],
            source_payload: generateResponse.data.sources || [],
            source_limitations: generateResponse.data.source_limitations || '',
            grounding_status: generateResponse.data.grounding_status || null,
          });
          setContent(savedVersion);
        }

        // BOTH mode: after text is saved, automatically generate an image
        if (generationMode === 'both' && savedVersion) {
          try {
            const imageResponse: any = await triggerContentGeneration({
              topic,
              contentType,
              instructions: finalInstructions || 'Generate a high-quality financial illustration.',
              provider: imageProvider,
              currentContent: savedVersion.body,
              count: variationCount,
              orgId: profile.org_id,
              requestId: currentRequestId,
              sourceUrls: selectedSourceUrls,
            });

            if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 1) {
              setGeneratedImages(imageResponse.data.images);
              setShowImageSelection(true);
            } else if (imageResponse.data) {
              const imgHtml = imageResponse.data.body;
              const newBody = isBlogArticle
                ? insertInlineImageIntoBlogBody(savedVersion.body, imgHtml, chartData || (savedVersion as any).chart_data || null)
                : `${imgHtml}<br/><hr/><br/>${savedVersion.body}`;
              const updatedVersion = await createContentVersion(currentRequestId, {
                generated_by: 'ai',
                title: savedVersion.title,
                body: newBody,
                disclaimers: savedVersion.disclaimers,
                chart_data: chartData || (savedVersion as any).chart_data || null,
                citation_payload: citations,
                source_payload: sources,
                source_limitations: sourceLimitations,
                grounding_status: groundingStatus,
              });
              setContent(updatedVersion);
            }
          } catch (imgErr: any) {
            console.error('Image generation failed in Full Article mode:', imgErr);
            // Don't fail the whole generation — text was already saved
            setError(`Text generated successfully, but image generation failed: ${imgErr.message}`);
          }
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectTextOption = async (option: any) => {
    if (!requestId) return;
    try {
      setChartData(option.chartData ?? null);
      setCitations((option.citations || []) as CitationPayloadItem[]);
      setSources((option.sources || []) as CitationSourceItem[]);
      setSourceLimitations(option.source_limitations || '');
      setGroundingStatus(option.grounding_status || null);

      const savedVersion = await createContentVersion(requestId, {
        generated_by: 'ai',
        title: option.title,
        body: isBlogArticle ? ensureBlogChartSlot(option.body, option.chartData ?? null) : option.body,
        disclaimers: option.disclaimers,
        chart_data: option.chartData ?? null,
        citation_payload: option.citations || [],
        source_payload: option.sources || [],
        source_limitations: option.source_limitations || '',
        grounding_status: option.grounding_status || null,
      });
      setContent(savedVersion);
      setShowTextSelection(false);
    } catch (e: any) {
      console.error(e);
      setError("Failed to switch draft.");
    }
  };

  const handleGenerateImage = async () => {
    if (!content || !requestId) return;
    setIsGeneratingImage(true);
    setError(null);
    setGeneratedImages([]); // Clear previous
    setShowImageSelection(false);

    try {
      const imageResponse: any = await triggerContentGeneration({
        topic,
        contentType,
        instructions: instructions || 'Generate a high-quality financial illustration.',
        provider: imageProvider,
        currentContent: content.body,
        count: variationCount,
        orgId: profile?.org_id,
        requestId: requestId || undefined,
        sourceUrls: parseSourceUrls(sourceUrlsInput),
      });

      if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 1) {
        setGeneratedImages(imageResponse.data.images);
        setShowImageSelection(true);
      } else if (imageResponse.data) {
        await selectImage({
          html: imageResponse.data.body,
          caption: "Generated Image"
        });
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const selectImage = async (selectedImage: { html: string, caption?: string }, index?: number) => {
    if (!content || !requestId) return;
    setSavingImageIndex(index ?? null);

    try {
      const effectiveChartData = chartData ?? (content as any).chart_data ?? null;
      const effectiveCitations = citations.length > 0 ? citations : ((content as any).citation_payload || []);
      const effectiveSources = sources.length > 0 ? sources : ((content as any).source_payload || []);
      const effectiveSourceLimitations = sourceLimitations || (content as any).source_limitations || '';
      const effectiveGroundingStatus = groundingStatus || (content as any).grounding_status || null;
      let newBody = content.body;
      if (!newBody || newBody.trim() === '') {
        // Image-only mode: just use the image HTML
        newBody = selectedImage.html;
      } else if (newBody.includes('<figure style="margin:0;">') && newBody.indexOf('<figure') < 50) {
        newBody = newBody.replace(/<figure.*?<\/figure>/s, selectedImage.html);
      } else {
        newBody = `${selectedImage.html}<br/><hr/><br/>${content.body}`;
      }

      const savedVersion = await createContentVersion(requestId, {
        generated_by: 'ai',
        title: content.title,
        body: isBlogArticle ? insertInlineImageIntoBlogBody(content.body, selectedImage.html, effectiveChartData) : newBody,
        disclaimers: content.disclaimers,
        chart_data: effectiveChartData,
        citation_payload: effectiveCitations,
        source_payload: effectiveSources,
        source_limitations: effectiveSourceLimitations,
        grounding_status: effectiveGroundingStatus,
      });

      setContent(savedVersion);
      setShowImageSelection(false);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to save selected image.");
    } finally {
      setSavingImageIndex(null);
    }
  };

  const handleHighlightAnimation = (oldBody: string, newBody: string) => {
    try {
      const parser = new DOMParser();
      const oldDoc = parser.parseFromString(oldBody, 'text/html');
      const newDoc = parser.parseFromString(newBody, 'text/html');
      const oldTextContent = oldDoc.body.textContent || '';
      const newContainer = document.createElement('div');
      newContainer.innerHTML = newBody;

      const children = Array.from(newDoc.body.children);
      let modifiedBody = '';

      if (children.length > 0) {
        children.forEach((child) => {
          const text = child.textContent?.trim() || '';
          if (text.length > 20 && !oldTextContent.includes(text)) {
            child.classList.add('new-content-highlight');
          }
          modifiedBody += child.outerHTML;
        });
      } else {
        modifiedBody = newBody;
      }
      return modifiedBody;
    } catch (e) {
      console.error("Animation prep failed", e);
      return newBody;
    }
  };

  const handleExtend = async () => {
    if (!content) return;
    setIsExtending(true);
    setExtensionStep(0);
    setError(null);
    const previousBody = content.body;

    try {
      const currentBodyText = content.body.replace(/<[^>]*>?/gm, '');

      const response: any = await triggerContentGeneration({
        topic,
        contentType,
        instructions,
        provider: textProvider,
        contentLength,
        action: 'extend',
        currentContent: currentBodyText,
        orgId: profile?.org_id,
        requestId: requestId || undefined,
        sourceUrls: parseSourceUrls(sourceUrlsInput),
      });

      setExtensionStep(EXTENSION_STEPS.length);
      await new Promise(resolve => setTimeout(resolve, 800));

      if (response.data) {
        if (!requestId) {
          throw new Error('No request selected to save extension changes.');
        }

        const savedVersion = await createContentVersion(requestId, {
          generated_by: 'ai',
          title: content.title,
          body: isBlogArticle ? ensureBlogChartSlot(response.data.body || content.body, chartData) : (response.data.body || content.body),
          disclaimers: content.disclaimers,
          chart_data: chartData,
          citation_payload: citations,
          source_payload: sources,
          source_limitations: sourceLimitations,
          grounding_status: groundingStatus,
        });

        const highlightedBody = handleHighlightAnimation(previousBody, savedVersion.body);

        setContent({
          ...savedVersion,
          body: highlightedBody,
        });

        setTimeout(() => {
          setContent(prev => {
            if (!prev) return null;
            return {
              ...savedVersion,
              body: savedVersion.body,
            };
          });
        }, 4500);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to extend content.");
    } finally {
      setIsExtending(false);
    }
  };

  const handleStatusChange = async (newStatus: ContentStatus) => {
    try {
      setError(null);

      const currentRequestId = await ensureRequestId();

      if (newStatus === ContentStatus.SUBMITTED) {
        // If this is a resubmission (status is CHANGES_REQUESTED) and we have a previous reviewer,
        // skip the modal and auto-submit to the same reviewer
        if (status === ContentStatus.CHANGES_REQUESTED && reviews.length > 0) {
          const lastReviewer = reviews.find(r => r.reviewer_id)?.reviewer_id;
          if (lastReviewer) {
            await handleConfirmReviewSubmit(lastReviewer);
            return;
          }
        }
        setShowComplianceModal(true);
        return;
      }

      const persistedStatus = newStatus;

      const { error: requestUpdateError } = await supabase
        .from('content_requests')
        .update({
          status: persistedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRequestId);

      if (requestUpdateError) throw requestUpdateError;

      setStatus(persistedStatus);
      navigate(`/content/${currentRequestId}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to update content status.');
    }
  };

  const handleConfirmReviewSubmit = async (overrideReviewerId?: string) => {
    const reviewerId = overrideReviewerId || selectedReviewer;
    if (!reviewerId) return;

    try {
      setError(null);
      setIsSavingDraft(true); // Reusing as a general loading state

      const currentRequestId = await ensureRequestId();

      // Save the latest content version before submitting
      await saveCurrentEditorVersion(currentRequestId);

      const persistedStatus = ContentStatus.IN_REVIEW;

      // Automatically log a review entry if this is a resubmission
      if (status === ContentStatus.CHANGES_REQUESTED || status === ContentStatus.APPROVED) {
        const { data: reviewData, error: reviewError } = await supabase
          .from('compliance_reviews')
          .insert({
            request_id: currentRequestId,
            reviewer_id: profile?.id,
            decision: 'resubmitted',
            notes: 'Changes made by advisor to address compliance notes.',
          })
          .select('id, decision, notes, reviewer_id, created_at')
          .single();

        if (reviewError) throw reviewError;
        setReviews(prev => [reviewData as unknown as ComplianceReview, ...prev]);
      }

      const { error: requestUpdateError } = await supabase
        .from('content_requests')
        .update({
          status: persistedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRequestId);

      if (requestUpdateError) throw requestUpdateError;

      // Block on the notification call so failures are visible to the user.
      if (profile?.org_id) {
        await triggerReviewNotification({
          request_id: currentRequestId,
          org_id: profile.org_id,
        });
      }

      setShowComplianceModal(false);
      setStatus(persistedStatus);
      navigate(`/content/${currentRequestId}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to submit for review.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Auto-resize title textarea whenever title changes
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [content?.title]);

  const stripIframeEditorInjection = useCallback((html: string): string => {
    if (!html) return '';
    try {
      const hasDoctype = /<!doctype html>/i.test(html);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.getElementById('cf-iframe-edit-style')?.remove();
      doc.getElementById('cf-iframe-edit-script')?.remove();
      doc.getElementById('cfIframePill')?.remove();
      const cleaned = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${cleaned}` : cleaned;
    } catch {
      return html
        .replace(/<!-- CF_IFRAME_EDIT_BRIDGE_START -->[\s\S]*?<!-- CF_IFRAME_EDIT_BRIDGE_END -->/gi, '')
        .replace(/<style[^>]*id=["']cf-iframe-edit-style["'][\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*id=["']cf-iframe-edit-script["'][\s\S]*?<\/script>/gi, '')
        .replace(/<div[^>]*id=["']cfIframePill["'][\s\S]*?<\/div>/gi, '');
    }
  }, []);

  const injectIframeEditorBridge = useCallback((html: string): string => {
    const cleanedHtml = stripIframeEditorInjection(html);
    const bridgeBlock = `
<!-- CF_IFRAME_EDIT_BRIDGE_START -->
<style id="cf-iframe-edit-style">
  .cf-pill {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483646;
    display: none;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border-radius: 999px;
    background: #0f172a;
    border: 1px solid #334155;
    box-shadow: 0 10px 24px rgba(2, 6, 23, 0.35);
    color: #e2e8f0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    user-select: none;
  }
  .cf-pill.cf-visible { display: inline-flex; }
  .cf-pill button {
    border: 0;
    border-radius: 999px;
    padding: 7px 12px;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: background 120ms ease;
  }
  .cf-pill button:hover { background: #334155; }
  .cf-pill button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .cf-pill .cf-divider {
    width: 1px;
    height: 20px;
    background: #475569;
  }
  .cf-pill .cf-note {
    display: none;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
  }
  .cf-pill .cf-prompt {
    display: none;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
  }
  .cf-pill.cf-note-open .cf-note { display: inline-flex; }
  .cf-pill.cf-prompt-open .cf-prompt { display: inline-flex; }
  .cf-pill.cf-highlight-open .cf-highlight-note { display: inline-flex; }
  .cf-pill.cf-note-open #cfComplianceToggle { display: none; }
  .cf-pill.cf-prompt-open #cfPromptToggle { display: none; }
  .cf-pill.cf-highlight-open #cfHighlightToggle { display: none; }
  .cf-pill .cf-note input {
    width: 190px;
    border: 1px solid #475569;
    border-radius: 8px;
    background: #1e293b;
    color: #f8fafc;
    padding: 6px 8px;
    font-size: 12px;
    outline: none;
  }
  .cf-pill .cf-note input:focus { border-color: #64748b; }
  .cf-pill .cf-highlight-note {
    display: none;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
  }
  .cf-pill .cf-highlight-note input {
    width: 250px;
    border: 1px solid #475569;
    border-radius: 8px;
    background: #1e293b;
    color: #f8fafc;
    padding: 6px 8px;
    font-size: 12px;
    outline: none;
  }
  .cf-pill .cf-highlight-note input:focus { border-color: #64748b; }
  .cf-pill .cf-prompt textarea {
    width: 280px;
    min-height: 44px;
    max-height: 120px;
    resize: vertical;
    border: 1px solid #475569;
    border-radius: 8px;
    background: #1e293b;
    color: #f8fafc;
    padding: 8px;
    font-size: 12px;
    line-height: 1.35;
    outline: none;
  }
  .cf-pill .cf-prompt textarea:focus { border-color: #64748b; }
  .cf-manual-edit-target {
    outline: 2px solid #334155;
    outline-offset: 2px;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.06);
  }
  .cf-compliance-highlight {
    background: rgba(245, 158, 11, 0.3);
    border-bottom: 2px solid rgba(245, 158, 11, 0.9);
    border-radius: 3px;
    padding: 0 1px;
  }
  .cf-compliance-highlight[data-cf-highlight-status="resolved"] {
    background: rgba(148, 163, 184, 0.22);
    border-bottom-color: rgba(100, 116, 139, 0.85);
  }
  .cf-compliance-highlight.cf-focus-ring {
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.45);
    transition: box-shadow 200ms ease;
  }
  .cf-compliance-highlight.cf-pulse {
    animation: cfHighlightPulse 1.6s ease-out 1;
  }
  @keyframes cfHighlightPulse {
    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.85); }
    60% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.0); }
    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
  }
  .cf-pill .cf-note-disabled {
    color: #cbd5e1;
    font-size: 12px;
    padding: 2px 4px;
  }
</style>
<div id="cfIframePill" class="cf-pill" role="toolbar" aria-label="Select and fix toolbar">
  ${isComplianceNoteOnlyPill ? `
  ${canAddComplianceHighlights ? `
  <button type="button" id="cfHighlightToggle">Add Note</button>
  <form class="cf-highlight-note" id="cfHighlightForm">
    <input type="text" id="cfHighlightInput" placeholder="Note for advisor..." />
    <button type="submit" id="cfHighlightSave">Save</button>
  </form>
  ` : '<span class="cf-note-disabled">Highlights are unavailable for this status.</span>'}
  ` : `
  <button type="button" data-mode="rewrite">Rewrite</button>
  <button type="button" data-mode="shorten">Shorten</button>
  <button type="button" data-mode="expand">Expand</button>
  <button type="button" id="cfManualToggle">Edit Text Manually</button>
  <button type="button" id="cfPromptToggle">Prompt AI</button>
  <div class="cf-divider"></div>
  <button type="button" id="cfComplianceToggle">Fix Compliance</button>
  <form class="cf-note" id="cfComplianceForm">
    <input type="text" id="cfComplianceInput" placeholder="Compliance note..." />
    <button type="submit">Fix</button>
  </form>
  ${canAddComplianceHighlights ? `
  <button type="button" id="cfHighlightToggle">Add Note</button>
  <form class="cf-highlight-note" id="cfHighlightForm">
    <input type="text" id="cfHighlightInput" placeholder="Note for advisor..." />
    <button type="submit" id="cfHighlightSave">Save</button>
  </form>
  ` : ''}
  <form class="cf-prompt" id="cfPromptForm">
    <textarea id="cfPromptInput" placeholder="Tell AI exactly what to change in this selected text only..."></textarea>
    <button type="submit">Run</button>
  </form>
  `}
</div>
<!-- CF_IFRAME_EDIT_BRIDGE_END -->
`.trim();

    if (cleanedHtml.includes('</body>')) {
      return cleanedHtml.replace('</body>', `${bridgeBlock}</body>`);
    }

    return `${cleanedHtml}${bridgeBlock}`;
  }, [canAddComplianceHighlights, isComplianceNoteOnlyPill, stripIframeEditorInjection]);

  useEffect(() => {
    if (!content?.body || !content.body.includes('<!DOCTYPE html>')) {
      lastIframeBodyRef.current = '';
      setStableIframeSrcDoc(prev => (prev ? '' : prev));
      return;
    }

    const cleanedBody = stripIframeEditorInjection(content.body);
    if (cleanedBody === lastIframeBodyRef.current) {
      return;
    }

    lastIframeBodyRef.current = cleanedBody;
    const nextSrcDoc = injectIframeEditorBridge(cleanedBody);
    setStableIframeSrcDoc(prev => (prev === nextSrcDoc ? prev : nextSrcDoc));
  }, [content?.body, injectIframeEditorBridge, stripIframeEditorInjection]);

  const latestContentRef = useRef<ContentVersion | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const rewriteContextRef = useRef({
    topic: '',
    contentType: '',
    instructions: '',
    textProvider: 'claude' as TextProvider,
  });

  useEffect(() => {
    latestContentRef.current = content;
    latestRequestIdRef.current = requestId;
    rewriteContextRef.current = {
      topic,
      contentType,
      instructions,
      textProvider,
    };
  }, [content, requestId, topic, contentType, instructions, textProvider]);

  const normalizeRewriteText = useCallback((input: string): string => {
    if (!input) return '';
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const parsedText = doc.body.textContent
      ?.replace(/&(m|n)dash;/gi, '-')
      .replace(/&#821[12];/g, '-')
      .replace(/&#x201[34];?/gi, '-')
      .replace(/[—–]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || '';
    return parsedText;
  }, []);

  const stripMarkdownSyntax = useCallback((input: string): string => {
    if (!input) return '';
    return input
      // Keep code content while removing code fence markers.
      .replace(/```([\s\S]*?)```/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/_([^_\n]+)_/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*[-*+]\s+/g, '')
      .replace(/^\s*\d+\.\s+/g, '');
  }, []);

  const mainIframeRuntimeCleanupRef = useRef<(() => void) | null>(null);
  const fullscreenIframeRuntimeCleanupRef = useRef<(() => void) | null>(null);
  const mainBindRetryTimeoutsRef = useRef<number[]>([]);
  const fullscreenBindRetryTimeoutsRef = useRef<number[]>([]);
  const pendingScrollRestoreRef = useRef<{
    main: { x: number; y: number } | null;
    fullscreen: { x: number; y: number } | null;
  }>({
    main: null,
    fullscreen: null,
  });
  const pendingSelectionRestoreRef = useRef<{
    main: { start: number; end: number } | null;
    fullscreen: { start: number; end: number } | null;
  }>({
    main: null,
    fullscreen: null,
  });
  const mainContentEditableRuntimeRef = useRef<HTMLDivElement | null>(null);

  const bindIframeRuntime = useCallback((
    frameOrElement: HTMLIFrameElement | HTMLDivElement,
    cleanupRef: React.MutableRefObject<(() => void) | null>,
    runtimeKey: 'main' | 'fullscreen'
  ) => {
    const editableRoot = frameOrElement instanceof HTMLDivElement ? frameOrElement : null;
    const isContentEditableRuntime = Boolean(editableRoot);
    let frameWindow: Window;
    let frameDocument: Document;

    if (frameOrElement instanceof HTMLIFrameElement) {
      // iframe mode
      const fw = frameOrElement.contentWindow;
      const fd = frameOrElement.contentDocument;
      if (!fw || !fd) return;
      frameWindow = fw;
      frameDocument = fd;
    } else {
      // contentEditable div mode — use main window/document
      frameWindow = window;
      frameDocument = document;
    }
    if (!frameWindow || !frameDocument) return;

    const contentRoot = editableRoot || frameDocument.body || frameDocument.documentElement;
    if (!contentRoot) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const ensureBridgeNodes = () => {
      const pillStyles = `
          .cf-pill {
            position: fixed;
            top: 0;
            left: 0;
            z-index: 2147483646;
            display: none;
            align-items: center;
            gap: 6px;
            padding: 6px;
            border-radius: 999px;
            background: #0f172a;
            border: 1px solid #334155;
            box-shadow: 0 10px 24px rgba(2, 6, 23, 0.35);
            color: #e2e8f0;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
            user-select: none;
          }
          .cf-pill.cf-visible { display: inline-flex; }
          .cf-pill button {
            border: 0;
            border-radius: 999px;
            padding: 7px 12px;
            background: transparent;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 600;
            line-height: 1;
            cursor: pointer;
            transition: background 120ms ease;
          }
          .cf-pill button:hover { background: #334155; }
          .cf-pill button:disabled { opacity: 0.6; cursor: wait; }
          .cf-pill .cf-divider { width: 1px; height: 20px; background: #475569; }
          .cf-pill .cf-note { display: none; align-items: center; gap: 6px; margin-left: 4px; }
          .cf-pill .cf-highlight-note { display: none; align-items: center; gap: 6px; margin-left: 4px; }
          .cf-pill .cf-prompt { display: none; align-items: center; gap: 6px; margin-left: 4px; }
          .cf-pill.cf-note-open .cf-note { display: inline-flex; }
          .cf-pill.cf-highlight-open .cf-highlight-note { display: inline-flex; }
          .cf-pill.cf-prompt-open .cf-prompt { display: inline-flex; }
          .cf-pill.cf-note-open #cfComplianceToggle { display: none; }
          .cf-pill.cf-highlight-open #cfHighlightToggle { display: none; }
          .cf-pill.cf-prompt-open #cfPromptToggle { display: none; }
          .cf-pill .cf-note input {
            width: 190px;
            border: 1px solid #475569;
            border-radius: 8px;
            background: #1e293b;
            color: #f8fafc;
            padding: 6px 8px;
            font-size: 12px;
            outline: none;
          }
          .cf-pill .cf-note input:focus { border-color: #64748b; }
          .cf-pill .cf-highlight-note input {
            width: 250px;
            border: 1px solid #475569;
            border-radius: 8px;
            background: #1e293b;
            color: #f8fafc;
            padding: 6px 8px;
            font-size: 12px;
            outline: none;
          }
          .cf-pill .cf-highlight-note input:focus { border-color: #64748b; }
          .cf-pill .cf-prompt textarea {
            width: 280px;
            min-height: 44px;
            max-height: 120px;
            resize: vertical;
            border: 1px solid #475569;
            border-radius: 8px;
            background: #1e293b;
            color: #f8fafc;
            padding: 8px;
            font-size: 12px;
            line-height: 1.35;
            outline: none;
          }
          .cf-pill .cf-prompt textarea:focus { border-color: #64748b; }
          .cf-manual-edit-target {
            outline: 2px solid #334155;
            outline-offset: 2px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.06);
          }
          .cf-compliance-highlight {
            background: rgba(245, 158, 11, 0.3);
            border-bottom: 2px solid rgba(245, 158, 11, 0.9);
            border-radius: 3px;
            padding: 0 1px;
          }
          .cf-compliance-highlight[data-cf-highlight-status="resolved"] {
            background: rgba(148, 163, 184, 0.22);
            border-bottom-color: rgba(100, 116, 139, 0.85);
          }
          .cf-compliance-highlight.cf-focus-ring {
            box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.45);
            transition: box-shadow 200ms ease;
          }
          .cf-compliance-highlight.cf-pulse {
            animation: cfHighlightPulse 1.6s ease-out 1;
          }
          @keyframes cfHighlightPulse {
            0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.85); }
            60% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.0); }
            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
          }
          .cf-pill .cf-note-disabled {
            color: #cbd5e1;
            font-size: 12px;
            padding: 2px 4px;
          }
      `;
      const pillMarkup = `
          ${isComplianceNoteOnlyPill ? `
          ${canAddComplianceHighlights ? `
          <button type="button" id="cfHighlightToggle">Add Note</button>
          <form class="cf-highlight-note" id="cfHighlightForm">
            <input type="text" id="cfHighlightInput" placeholder="Note for advisor..." />
            <button type="submit" id="cfHighlightSave">Save</button>
          </form>
          ` : '<span class="cf-note-disabled">Highlights are unavailable for this status.</span>'}
          ` : `
          <button type="button" data-mode="rewrite">Rewrite</button>
          <button type="button" data-mode="shorten">Shorten</button>
          <button type="button" data-mode="expand">Expand</button>
          <button type="button" id="cfManualToggle">Edit Text Manually</button>
          <button type="button" id="cfPromptToggle">Prompt AI</button>
          <div class="cf-divider"></div>
          <button type="button" id="cfComplianceToggle">Fix Compliance</button>
          <form class="cf-note" id="cfComplianceForm">
            <input type="text" id="cfComplianceInput" placeholder="Compliance note..." />
            <button type="submit">Fix</button>
          </form>
          ${canAddComplianceHighlights ? `
          <button type="button" id="cfHighlightToggle">Add Note</button>
          <form class="cf-highlight-note" id="cfHighlightForm">
            <input type="text" id="cfHighlightInput" placeholder="Note for advisor..." />
            <button type="submit" id="cfHighlightSave">Save</button>
          </form>
          ` : ''}
          <form class="cf-prompt" id="cfPromptForm">
            <textarea id="cfPromptInput" placeholder="Tell AI exactly what to change in this selected text only..."></textarea>
            <button type="submit">Run</button>
          </form>
          `}
      `.trim();

      let styleElement = frameDocument.getElementById('cf-iframe-edit-style') as HTMLStyleElement | null;
      if (!styleElement) {
        styleElement = frameDocument.createElement('style');
        styleElement.id = 'cf-iframe-edit-style';
        (frameDocument.head || frameDocument.body || frameDocument.documentElement).appendChild(styleElement);
      }
      styleElement.textContent = pillStyles;

      let pillElement = frameDocument.getElementById('cfIframePill') as HTMLDivElement | null;
      if (!pillElement) {
        pillElement = frameDocument.createElement('div');
        pillElement.id = 'cfIframePill';
        pillElement.className = 'cf-pill';
        pillElement.setAttribute('role', 'toolbar');
        pillElement.setAttribute('aria-label', 'Select and fix toolbar');
        (frameDocument.body || frameDocument.documentElement).appendChild(pillElement);
      }
      pillElement.innerHTML = pillMarkup;

      return pillElement;
    };

    const pill = ensureBridgeNodes();
    if (!pill) return;

    const complianceToggle = frameDocument.getElementById('cfComplianceToggle') as HTMLButtonElement | null;
    const complianceForm = frameDocument.getElementById('cfComplianceForm') as HTMLFormElement | null;
    const complianceInput = frameDocument.getElementById('cfComplianceInput') as HTMLInputElement | null;
    const highlightToggle = frameDocument.getElementById('cfHighlightToggle') as HTMLButtonElement | null;
    const highlightForm = frameDocument.getElementById('cfHighlightForm') as HTMLFormElement | null;
    const highlightInput = frameDocument.getElementById('cfHighlightInput') as HTMLInputElement | null;
    const highlightSaveButton = frameDocument.getElementById('cfHighlightSave') as HTMLButtonElement | null;
    const manualToggle = frameDocument.getElementById('cfManualToggle') as HTMLButtonElement | null;
    const promptToggle = frameDocument.getElementById('cfPromptToggle') as HTMLButtonElement | null;
    const promptForm = frameDocument.getElementById('cfPromptForm') as HTMLFormElement | null;
    const promptInput = frameDocument.getElementById('cfPromptInput') as HTMLTextAreaElement | null;
    const actionButtons = Array.from(pill.querySelectorAll<HTMLButtonElement>('button[data-mode]'));

    let savedRange: Range | null = null;
    let selectedText = '';
    let noteDraftRange: Range | null = null;
    let noteDraftText = '';
    let suppressCaptureUntil = 0;
    let isBusy = false;
    let manualEditTarget: HTMLSpanElement | null = null;
    let manualOriginalText = '';
    let selectionRafId: number | null = null;
    const timeoutIds: number[] = [];
    const unbindFns: Array<() => void> = [];

    const addEvent = (
      target: Document | Window | HTMLElement,
      event: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      target.addEventListener(event, handler, options);
      unbindFns.push(() => target.removeEventListener(event, handler, options));
    };

    const suppressCaptureFor = (ms = 260) => {
      suppressCaptureUntil = Date.now() + ms;
    };

    const hidePill = (force = false) => {
      if (isBusy && !force) return;
      pill.classList.remove('cf-visible', 'cf-note-open', 'cf-highlight-open', 'cf-prompt-open');
      if (complianceInput) {
        complianceInput.value = '';
      }
      if (highlightInput) {
        highlightInput.value = '';
      }
      if (promptInput) {
        promptInput.value = '';
      }
      savedRange = null;
      selectedText = '';
    };

    const setBusyState = (nextBusy: boolean) => {
      isBusy = nextBusy;
      const buttons = pill.querySelectorAll<HTMLButtonElement>('button');
      buttons.forEach(button => {
        button.disabled = nextBusy;
      });
      if (complianceInput) {
        complianceInput.disabled = nextBusy;
      }
      if (highlightInput) {
        highlightInput.disabled = nextBusy;
      }
      if (promptInput) {
        promptInput.disabled = nextBusy;
      }
    };

    const normalizeNodeForContains = (node: Node | null) => (
      node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node
    );

    const isNodeInsideContentRoot = (node: Node | null) => {
      if (!node) return false;
      if (!isContentEditableRuntime || !editableRoot) return true;
      const normalized = normalizeNodeForContains(node);
      return !!normalized && editableRoot.contains(normalized);
    };

    const isRangeInsideContentRoot = (range: Range) => (
      isNodeInsideContentRoot(range.startContainer) && isNodeInsideContentRoot(range.endContainer)
    );

    const getRangeRect = (range: Range) => {
      const directRect = range.getBoundingClientRect();
      if (directRect.width > 0 || directRect.height > 0) {
        return directRect;
      }
      const rects = range.getClientRects();
      if (!rects.length) return null;
      return rects[rects.length - 1] as DOMRect;
    };

    const positionPill = (range: Range) => {
      const rect = getRangeRect(range);
      if (!rect) return;

      const pillWidth = Math.max(pill.offsetWidth || 0, 360);
      const pillHeight = Math.max(pill.offsetHeight || 0, 42);
      const pad = 8;
      let top = rect.top - pillHeight - 12;
      if (top < pad) top = rect.bottom + 12;
      let left = rect.left + (rect.width / 2) - (pillWidth / 2);
      left = Math.max(pad, Math.min(left, frameWindow.innerWidth - pillWidth - pad));

      pill.style.top = `${top}px`;
      pill.style.left = `${left}px`;
      pill.classList.add('cf-visible');
    };

    const getTextOffset = (container: Node, targetNode: Text, localOffset: number): number | null => {
      const walker = frameDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let count = 0;
      let current = walker.nextNode() as Text | null;
      while (current) {
        if (current === targetNode) {
          return count + Math.max(0, Math.min(localOffset, current.textContent?.length || 0));
        }
        count += current.textContent?.length || 0;
        current = walker.nextNode() as Text | null;
      }
      return null;
    };

    const resolveTextPosition = (container: Node, absoluteOffset: number): { node: Text; offset: number } | null => {
      const clampedOffset = Math.max(0, absoluteOffset);
      const walker = frameDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let traversed = 0;
      let current = walker.nextNode() as Text | null;
      let lastTextNode: Text | null = null;

      while (current) {
        lastTextNode = current;
        const length = current.textContent?.length || 0;
        if (traversed + length >= clampedOffset) {
          return {
            node: current,
            offset: Math.max(0, Math.min(clampedOffset - traversed, length)),
          };
        }
        traversed += length;
        current = walker.nextNode() as Text | null;
      }

      if (!lastTextNode) return null;
      return {
        node: lastTextNode,
        offset: lastTextNode.textContent?.length || 0,
      };
    };

    const restorePendingSelection = () => {
      const pendingSelection = pendingSelectionRestoreRef.current[runtimeKey];
      if (!pendingSelection) return;

      const selection = frameWindow.getSelection();
      if (!selection) return;

      const startPos = resolveTextPosition(contentRoot, pendingSelection.start);
      const endPos = resolveTextPosition(contentRoot, pendingSelection.end);
      if (!startPos || !endPos) return;

      const range = frameDocument.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      selection.removeAllRanges();
      selection.addRange(range);
      pendingSelectionRestoreRef.current[runtimeKey] = null;
    };

    const replaceSavedRange = (replacementText: string): Text | null => {
      if (!savedRange) return null;
      const selection = frameWindow.getSelection();
      if (!selection) return null;

      selection.removeAllRanges();
      selection.addRange(savedRange);
      const activeRange = selection.getRangeAt(0);
      activeRange.deleteContents();

      const insertedTextNode = frameDocument.createTextNode(replacementText);
      activeRange.insertNode(insertedTextNode);

      const highlightRange = frameDocument.createRange();
      highlightRange.setStart(insertedTextNode, 0);
      highlightRange.setEnd(insertedTextNode, replacementText.length);
      selection.removeAllRanges();
      selection.addRange(highlightRange);

      savedRange = null;
      selectedText = '';
      return insertedTextNode;
    };

    const pulseHighlightNodes = (highlightId: string) => {
      const nodes = frameDocument.querySelectorAll<HTMLElement>(`[data-cf-highlight-id="${highlightId}"]`);
      nodes.forEach((node) => {
        node.classList.remove('cf-pulse');
        void node.offsetWidth;
        node.classList.add('cf-pulse');
        frameWindow.setTimeout(() => node.classList.remove('cf-pulse'), 1800);
      });
    };

    const unwrapHighlightNodes = (highlightId: string) => {
      const nodes = Array.from(
        frameDocument.querySelectorAll<HTMLElement>(`[data-cf-highlight-id="${highlightId}"]`)
      );
      nodes.forEach((node) => {
        const parent = node.parentNode;
        if (!parent) return;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
        (parent as HTMLElement).normalize();
      });
    };

    const applyHighlightToRange = (range: Range, highlightId: string): boolean => {
      const walker = frameDocument.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const textNode = node as Text;
          if (!(textNode.textContent || '').trim()) return NodeFilter.FILTER_REJECT;
          const parent = textNode.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#cfIframePill')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[data-cf-highlight-id]')) return NodeFilter.FILTER_REJECT;
          try {
            return range.intersectsNode(textNode) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      });

      const textNodes: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        textNodes.push(current as Text);
        current = walker.nextNode();
      }
      if (textNodes.length === 0) return false;

      let wrappedCount = 0;
      textNodes.forEach((textNode) => {
        const fullLength = textNode.textContent?.length || 0;
        const startOffset = textNode === range.startContainer ? range.startOffset : 0;
        const endOffset = textNode === range.endContainer ? range.endOffset : fullLength;
        if (endOffset <= startOffset) return;

        let targetNode = textNode;
        if (startOffset > 0) {
          targetNode = targetNode.splitText(startOffset);
        }

        const targetLength = targetNode.textContent?.length || 0;
        const highlightLength = Math.min(Math.max(endOffset - startOffset, 0), targetLength);
        if (highlightLength <= 0) return;
        if (highlightLength < targetLength) {
          targetNode.splitText(highlightLength);
        }

        const wrapper = frameDocument.createElement('span');
        wrapper.className = 'cf-compliance-highlight';
        wrapper.setAttribute('data-cf-highlight-id', highlightId);
        wrapper.setAttribute('data-cf-highlight-status', 'open');
        const parent = targetNode.parentNode;
        if (!parent) return;
        parent.replaceChild(wrapper, targetNode);
        wrapper.appendChild(targetNode);
        wrappedCount += 1;
      });

      return wrappedCount > 0;
    };

    const saveIframeHtml = async (): Promise<ContentVersion | null> => {
      const currentRequestId = latestRequestIdRef.current;
      const currentContent = latestContentRef.current;
      if (!currentRequestId || !currentContent) return null;

      const cleanedHtml = isContentEditableRuntime
        ? sanitizeBlogBodyForStorage((editableRoot?.innerHTML || '').trim())
        : stripIframeEditorInjection(`<!DOCTYPE html>\n${frameDocument.documentElement.outerHTML}`);
      const currentBody = isContentEditableRuntime
        ? sanitizeBlogBodyForStorage((currentContent.body || '').trim())
        : stripIframeEditorInjection(currentContent.body || '');
      if (!cleanedHtml || cleanedHtml === currentBody) return currentContent;

      const savedVersion = await createContentVersion(currentRequestId, {
        generated_by: 'human',
        title: currentContent.title,
        body: cleanedHtml,
        disclaimers: currentContent.disclaimers,
        chart_data: chartData,
        citation_payload: citations,
        source_payload: sources,
        source_limitations: sourceLimitations,
        grounding_status: groundingStatus,
      });

      const scrollingElement = frameDocument.scrollingElement || frameDocument.documentElement || frameDocument.body;
      pendingScrollRestoreRef.current[runtimeKey] = {
        x: frameWindow.scrollX ?? scrollingElement.scrollLeft ?? 0,
        y: frameWindow.scrollY ?? scrollingElement.scrollTop ?? 0,
      };
      setContent(savedVersion);
      return savedVersion;
    };

    const createComplianceHighlight = async (noteText: string) => {
      if (isBusy || !profile?.id || !profile?.org_id) return;
      const currentRequestId = latestRequestIdRef.current;
      const currentContent = latestContentRef.current;
      if (!currentRequestId || !currentContent) {
        setError('Missing request/content context. Reload this draft and try again.');
        return;
      }

      const rangeForNote = savedRange || noteDraftRange;
      const selectedTextForNote = (selectedText || noteDraftText || '').trim();
      if (!rangeForNote || !selectedTextForNote || !isRangeInsideContentRoot(rangeForNote)) {
        setError('Highlight text first, then click Add Note and Save.');
        return;
      }

      const note = noteText.trim();
      if (!note) return;
      const extractedText = selectedTextForNote.replace(/\s+/g, ' ').trim();
      if (!extractedText) return;

      const highlightId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const optimisticId = `pending-${highlightId}`;
      const optimisticHighlight: InlineHighlight = {
        id: optimisticId,
        org_id: profile.org_id,
        request_id: currentRequestId,
        version_id: currentContent.id || null,
        highlight_id: highlightId,
        selected_text: extractedText,
        note,
        status: 'open',
        created_by: profile.id,
        resolved_by: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
        local_state: 'saving',
        local_error: null,
      };

      setBusyState(true);
      try {
        const applied = applyHighlightToRange(rangeForNote, highlightId);
        if (!applied) {
          throw new Error('Could not apply highlight for this selection. Try selecting text inside one paragraph and save again.');
        }

        pulseHighlightNodes(highlightId);
        setComplianceHighlights(prev => [optimisticHighlight, ...prev]);
        setExpandedNoteIds(prev => new Set(prev).add(optimisticId));
        hidePill(true);

        const savedVersion = await saveIframeHtml();
        const targetVersionId = savedVersion?.id || currentContent.id;

        const { data: insertedHighlight, error: insertHighlightError } = await supabase
          .from('compliance_highlights')
          .insert({
            org_id: profile.org_id,
            request_id: currentRequestId,
            version_id: targetVersionId,
            highlight_id: highlightId,
            selected_text: extractedText,
            note,
            status: 'open',
            created_by: profile.id,
          })
          .select('id, org_id, request_id, version_id, highlight_id, selected_text, note, status, created_by, resolved_by, resolution_note, resolved_at, created_at')
          .single();

        if (insertHighlightError) {
          unwrapHighlightNodes(highlightId);
          await saveIframeHtml().catch(() => undefined);
          throw insertHighlightError;
        }

        const finalHighlight = insertedHighlight as InlineHighlight;
        setComplianceHighlights(prev => prev.map(item => (
          item.id === optimisticId ? finalHighlight : item
        )));
        setExpandedNoteIds(prev => {
          const next = new Set(prev);
          next.delete(optimisticId);
          next.add(finalHighlight.id);
          return next;
        });
        frameWindow.setTimeout(() => {
          scrollToHighlight(finalHighlight.highlight_id, { pulse: true });
        }, 180);
        noteDraftRange = null;
        noteDraftText = '';
      } catch (e: any) {
        console.error(e);
        unwrapHighlightNodes(highlightId);
        setComplianceHighlights(prev => {
          const hasOptimistic = prev.some(item => item.id === optimisticId);
          if (!hasOptimistic) {
            return [{
              ...optimisticHighlight,
              local_state: 'error',
              local_error: e.message || 'Failed to save inline note.',
            }, ...prev];
          }
          return prev.map(item => (
            item.id === optimisticId
              ? { ...item, local_state: 'error', local_error: e.message || 'Failed to save inline note.' }
              : item
          ));
        });
        setExpandedNoteIds(prev => new Set(prev).add(optimisticId));
        setError(e.message || 'Failed to save compliance highlight.');
      } finally {
        noteDraftRange = null;
        noteDraftText = '';
        setBusyState(false);
      }
    };

    const runRewrite = async (mode: 'rewrite' | 'shorten' | 'expand' | 'fix_compliance', complianceNote?: string) => {
      if (isBusy || !savedRange || !selectedText) return;
      if (!isRangeInsideContentRoot(savedRange)) {
        setError('Highlight text inside the editor, then try again.');
        return;
      }

      const fallbackText = selectedText;
      setBusyState(true);
      try {
        const rewriteContext = rewriteContextRef.current;
        const response: any = await triggerContentGeneration({
          topic: rewriteContext.topic,
          contentType: rewriteContext.contentType,
          instructions: `${rewriteContext.instructions || ''} ${NO_EM_DASH_INSTRUCTION} ${REWRITE_PLAIN_TEXT_INSTRUCTION}`.trim(),
          provider: rewriteContext.textProvider,
          action: 'rewrite',
          currentContent: fallbackText,
          rewriteMode: mode,
          complianceNote: complianceNote || undefined,
          orgId: profile?.org_id,
          requestId: latestRequestIdRef.current || undefined,
          sourceUrls: parseSourceUrls(sourceUrlsInput),
        });

        const rawRewrite = response?.data?.body || response?.data?.title || fallbackText;
        const rewrittenText = normalizeRewriteText(stripMarkdownSyntax(rawRewrite)) || fallbackText;
        const insertedTextNode = replaceSavedRange(rewrittenText);
        hidePill(true);
        if (!insertedTextNode) return;

        const start = getTextOffset(contentRoot, insertedTextNode, 0);
        const end = getTextOffset(contentRoot, insertedTextNode, rewrittenText.length);
        if (start !== null && end !== null) {
          pendingSelectionRestoreRef.current[runtimeKey] = { start, end };
        }

        await saveIframeHtml();
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to rewrite selection.');
      } finally {
        setBusyState(false);
      }
    };

    const runPromptInstruction = async (promptInstruction: string) => {
      if (isBusy || !savedRange || !selectedText) return;
      if (!isRangeInsideContentRoot(savedRange)) {
        setError('Highlight text inside the editor, then try again.');
        return;
      }
      const instructionText = promptInstruction.trim();
      if (!instructionText) return;

      const fallbackText = selectedText;
      setBusyState(true);
      try {
        const rewriteContext = rewriteContextRef.current;
        const promptScopedInstructions = [
          rewriteContext.instructions || '',
          NO_EM_DASH_INSTRUCTION,
          REWRITE_PLAIN_TEXT_INSTRUCTION,
          'Apply ONLY the user instruction to the selected text. Keep all other wording unchanged.',
          'Do not add explanations, commentary, or extra content.',
          `User instruction: ${instructionText}`,
        ].filter(Boolean).join(' ');

        const response: any = await triggerContentGeneration({
          topic: rewriteContext.topic,
          contentType: rewriteContext.contentType,
          instructions: promptScopedInstructions,
          provider: rewriteContext.textProvider,
          action: 'rewrite',
          currentContent: fallbackText,
          rewriteMode: 'rewrite',
          orgId: profile?.org_id,
          requestId: latestRequestIdRef.current || undefined,
          sourceUrls: parseSourceUrls(sourceUrlsInput),
        });

        const rawRewrite = response?.data?.body || response?.data?.title || fallbackText;
        const rewrittenText = normalizeRewriteText(stripMarkdownSyntax(rawRewrite)) || fallbackText;
        const insertedTextNode = replaceSavedRange(rewrittenText);
        hidePill(true);
        if (!insertedTextNode) return;

        const start = getTextOffset(contentRoot, insertedTextNode, 0);
        const end = getTextOffset(contentRoot, insertedTextNode, rewrittenText.length);
        if (start !== null && end !== null) {
          pendingSelectionRestoreRef.current[runtimeKey] = { start, end };
        }

        await saveIframeHtml();
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to apply prompt instruction.');
      } finally {
        setBusyState(false);
      }
    };

    const finalizeManualEdit = async (saveChanges: boolean) => {
      if (!manualEditTarget || isBusy) return;
      const activeTarget = manualEditTarget;
      manualEditTarget = null;
      const normalizedText = normalizeRewriteText(activeTarget.textContent || manualOriginalText || '');
      const finalText = saveChanges ? (normalizedText || manualOriginalText || '') : (manualOriginalText || '');
      manualOriginalText = '';

      const parent = activeTarget.parentNode;
      if (!parent) return;
      const insertedTextNode = frameDocument.createTextNode(finalText);
      parent.replaceChild(insertedTextNode, activeTarget);
      insertedTextNode.parentElement?.normalize();

      if (!saveChanges) return;

      const start = getTextOffset(contentRoot, insertedTextNode, 0);
      const end = getTextOffset(contentRoot, insertedTextNode, finalText.length);
      if (start !== null && end !== null) {
        pendingSelectionRestoreRef.current[runtimeKey] = { start, end };
      }

      setBusyState(true);
      try {
        await saveIframeHtml();
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to apply manual edit.');
      } finally {
        setBusyState(false);
      }
    };

    const beginManualEditInPlace = () => {
      if (isBusy || !savedRange || !selectedText || manualEditTarget) return;
      const selection = frameWindow.getSelection();
      if (!selection) return;

      selection.removeAllRanges();
      selection.addRange(savedRange);
      const activeRange = selection.getRangeAt(0);
      activeRange.deleteContents();

      const editableSpan = frameDocument.createElement('span');
      editableSpan.className = 'cf-manual-edit-target';
      editableSpan.contentEditable = 'true';
      editableSpan.spellcheck = true;
      editableSpan.textContent = selectedText;
      activeRange.insertNode(editableSpan);

      const editRange = frameDocument.createRange();
      editRange.selectNodeContents(editableSpan);
      editRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(editRange);

      manualOriginalText = selectedText;
      manualEditTarget = editableSpan;
      savedRange = null;
      selectedText = '';
      hidePill(true);

      addEvent(editableSpan, 'blur', () => {
        void finalizeManualEdit(true);
      });
      addEvent(editableSpan, 'keydown', (event: Event) => {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key === 'Escape') {
          keyEvent.preventDefault();
          void finalizeManualEdit(false);
          return;
        }
        if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
          keyEvent.preventDefault();
          void finalizeManualEdit(true);
        }
      });
      editableSpan.focus();
    };

    const captureSelection = () => {
      if (isBusy) return;
      if (Date.now() < suppressCaptureUntil) return;
      if (manualEditTarget) return;
      const activeElement = frameDocument.activeElement;
      if (activeElement && pill.contains(activeElement)) return;

      const selection = frameWindow.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hidePill();
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        hidePill();
        return;
      }

      const range = selection.getRangeAt(0);
      if (!isRangeInsideContentRoot(range)) {
        hidePill();
        return;
      }
      const ancestor = range.commonAncestorContainer;
      if (ancestor && pill.contains(ancestor.nodeType === Node.ELEMENT_NODE ? ancestor as Node : (ancestor.parentElement as Node))) {
        return;
      }

      selectedText = text;
      savedRange = range.cloneRange();
      pill.classList.remove('cf-note-open', 'cf-highlight-open', 'cf-prompt-open');
      if (complianceInput) complianceInput.value = '';
      if (highlightInput) highlightInput.value = '';
      if (promptInput) promptInput.value = '';
      positionPill(savedRange);
    };

    const scheduleCaptureSelection = () => {
      if (selectionRafId !== null) {
        frameWindow.cancelAnimationFrame(selectionRafId);
      }
      selectionRafId = frameWindow.requestAnimationFrame(() => {
        selectionRafId = null;
        captureSelection();
      });
    };

    actionButtons.forEach(button => {
      addEvent(button, 'click', (event: Event) => {
        event.preventDefault();
        const mode = button.getAttribute('data-mode');
        if (!mode) return;
        void runRewrite(mode as 'rewrite' | 'shorten' | 'expand');
      });
    });

    if (complianceToggle) {
      addEvent(complianceToggle, 'click', (event: Event) => {
        event.preventDefault();
        pill.classList.remove('cf-highlight-open');
        pill.classList.remove('cf-prompt-open');
        pill.classList.add('cf-note-open');
        if (savedRange) {
          positionPill(savedRange);
        }
        complianceInput?.focus();
      });
    }

    if (complianceForm) {
      addEvent(complianceForm, 'submit', (event: Event) => {
        event.preventDefault();
        const note = complianceInput?.value?.trim() || '';
        if (!note) return;
        void runRewrite('fix_compliance', note);
      });
    }

    if (highlightToggle) {
      addEvent(highlightToggle, 'click', (event: Event) => {
        event.preventDefault();
        if (!savedRange || !selectedText) {
          setError('Highlight text first, then click Add Note.');
          return;
        }
        noteDraftRange = savedRange.cloneRange();
        noteDraftText = selectedText;
        pill.classList.remove('cf-note-open', 'cf-prompt-open');
        pill.classList.add('cf-highlight-open');
        if (savedRange) {
          positionPill(savedRange);
        }
        highlightInput?.focus();
      });
    }

    if (highlightForm) {
      addEvent(highlightForm, 'submit', (event: Event) => {
        event.preventDefault();
        suppressCaptureFor(520);
        const note = highlightInput?.value?.trim() || '';
        if (!note) {
          setError('Enter a note before saving.');
          return;
        }
        void createComplianceHighlight(note);
      });
      if (highlightInput) {
        addEvent(highlightInput, 'keydown', (event: Event) => {
          const keyEvent = event as KeyboardEvent;
          if (keyEvent.key === 'Enter') {
            keyEvent.preventDefault();
            suppressCaptureFor(520);
            const note = highlightInput.value?.trim() || '';
            if (!note) {
              setError('Enter a note before saving.');
              return;
            }
            void createComplianceHighlight(note);
          }
        });
      }
    }

    if (highlightSaveButton) {
      addEvent(highlightSaveButton, 'pointerdown', (event: Event) => {
        // Prevent pointerdown from collapsing iframe selection before click/submit.
        event.preventDefault();
        suppressCaptureFor(520);
      });
      addEvent(highlightSaveButton, 'click', (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressCaptureFor(520);
        const note = highlightInput?.value?.trim() || '';
        if (!note) {
          setError('Enter a note before saving.');
          return;
        }
        void createComplianceHighlight(note);
      });
    }

    if (manualToggle) {
      addEvent(manualToggle, 'click', (event: Event) => {
        event.preventDefault();
        beginManualEditInPlace();
      });
    }

    if (promptToggle) {
      addEvent(promptToggle, 'click', (event: Event) => {
        event.preventDefault();
        pill.classList.remove('cf-note-open', 'cf-highlight-open');
        pill.classList.add('cf-prompt-open');
        if (savedRange) {
          positionPill(savedRange);
        }
        promptInput?.focus();
      });
    }

    if (promptForm) {
      addEvent(promptForm, 'submit', (event: Event) => {
        event.preventDefault();
        const promptText = promptInput?.value || '';
        void runPromptInstruction(promptText);
      });
      if (promptInput) {
        addEvent(promptInput, 'keydown', (event: Event) => {
          const keyEvent = event as KeyboardEvent;
          if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
            keyEvent.preventDefault();
            const promptText = promptInput.value || '';
            void runPromptInstruction(promptText);
          }
        });
      }
    }

    const handlePillPointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Keep mouse interactions inside the pill from triggering selection recapture/hide races.
      suppressCaptureFor(280);
      // In contentEditable mode, prevent focus from leaving the editor for button clicks.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (isContentEditableRuntime || target.tagName !== 'BUTTON') {
        event.preventDefault();
      }
    };
    addEvent(pill, 'pointerdown', handlePillPointerDown);
    addEvent(pill, 'mousedown', handlePillPointerDown);

    // Click on a compliance highlight span → auto-select its text and show pill
    addEvent(frameDocument, 'click', (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const highlightSpan = target.closest('[data-cf-highlight-id]') as HTMLElement | null;
      if (!highlightSpan) return;

      const highlightId = highlightSpan.getAttribute('data-cf-highlight-id');
      if (!highlightId) return;

      // Find all spans sharing this highlight ID
      const allSpans = Array.from(
        frameDocument.querySelectorAll<HTMLElement>(`[data-cf-highlight-id="${highlightId}"]`)
      );
      if (allSpans.length === 0) return;

      const firstSpan = allSpans[0];
      const lastSpan = allSpans[allSpans.length - 1];

      // Build a range spanning the entire highlight
      const range = frameDocument.createRange();
      range.setStartBefore(firstSpan.firstChild || firstSpan);
      range.setEndAfter(lastSpan.lastChild || lastSpan);

      const selection = frameWindow.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      selectedText = range.toString().trim();
      savedRange = range.cloneRange();

      // Show the pill at this highlight
      suppressCaptureFor(500);
      pill.classList.remove('cf-note-open', 'cf-highlight-open', 'cf-prompt-open');
      positionPill(savedRange);

      // Also expand this note in the sidebar
      const highlightData = complianceHighlightsRef.current?.find(
        (h: any) => h.highlight_id === highlightId
      );
      if (highlightData) {
        setExpandedNoteIds(prev => new Set(prev).add(highlightData.id));
      }
    });

    addEvent(frameDocument, 'mouseup', scheduleCaptureSelection);
    addEvent(frameDocument, 'pointerup', scheduleCaptureSelection);
    const touchOptions: AddEventListenerOptions = { passive: true };
    addEvent(frameDocument, 'touchend', scheduleCaptureSelection, touchOptions);
    addEvent(frameDocument, 'keyup', (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Shift' || keyEvent.key.startsWith('Arrow') || keyEvent.key === 'a') {
        scheduleCaptureSelection();
      }
    });
    addEvent(frameDocument, 'focusin', scheduleCaptureSelection);
    addEvent(frameDocument, 'visibilitychange', () => {
      if (!frameDocument.hidden) {
        scheduleCaptureSelection();
      }
    });
    addEvent(frameWindow, 'resize', () => {
      if (savedRange && pill.classList.contains('cf-visible')) {
        positionPill(savedRange);
      }
    });
    addEvent(frameWindow, 'scroll', () => {
      if (savedRange && pill.classList.contains('cf-visible')) {
        positionPill(savedRange);
      }
    }, true);

    timeoutIds.push(frameWindow.setTimeout(scheduleCaptureSelection, 0));
    timeoutIds.push(frameWindow.setTimeout(scheduleCaptureSelection, 80));

    const pendingScroll = pendingScrollRestoreRef.current[runtimeKey];
    if (pendingScroll) {
      const applyPendingScroll = () => {
        frameWindow.scrollTo(pendingScroll.x, pendingScroll.y);
      };
      const applyPendingSelection = () => {
        restorePendingSelection();
      };

      frameWindow.requestAnimationFrame(() => {
        applyPendingScroll();
        frameWindow.requestAnimationFrame(() => {
          applyPendingScroll();
          applyPendingSelection();
        });
      });
      [80, 160, 320, 640].forEach(delay => {
        timeoutIds.push(frameWindow.setTimeout(applyPendingScroll, delay));
      });
      [160, 360, 680].forEach(delay => {
        timeoutIds.push(frameWindow.setTimeout(applyPendingSelection, delay));
      });
      pendingScrollRestoreRef.current[runtimeKey] = null;
    } else {
      const applyPendingSelection = () => {
        restorePendingSelection();
      };
      frameWindow.requestAnimationFrame(applyPendingSelection);
      timeoutIds.push(frameWindow.setTimeout(applyPendingSelection, 80));
    }

    cleanupRef.current = () => {
      if (selectionRafId !== null) {
        frameWindow.cancelAnimationFrame(selectionRafId);
        selectionRafId = null;
      }
      timeoutIds.forEach(id => frameWindow.clearTimeout(id));
      unbindFns.forEach(unbind => unbind());
      hidePill(true);
    };
  }, [canAddComplianceHighlights, createContentVersion, isComplianceNoteOnlyPill, normalizeRewriteText, profile?.id, profile?.org_id, stripIframeEditorInjection, stripMarkdownSyntax]);

  const syncHighlightStatusInFrame = useCallback((doc: Document | null) => {
    if (!doc || complianceHighlights.length === 0) return;
    complianceHighlights.forEach((item) => {
      const nodes = doc.querySelectorAll<HTMLElement>(`[data-cf-highlight-id="${item.highlight_id}"]`);
      nodes.forEach((node) => {
        node.classList.add('cf-compliance-highlight');
        node.setAttribute('data-cf-highlight-status', item.status || 'open');
      });
    });
  }, [complianceHighlights]);

  const syncHighlightStatusAcrossFrames = useCallback(() => {
    syncHighlightStatusInFrame(iframeRef.current?.contentDocument || null);
    syncHighlightStatusInFrame(fullscreenIframeRef.current?.contentDocument || null);
  }, [syncHighlightStatusInFrame]);

  const handleMainIframeLoad = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    mainBindRetryTimeoutsRef.current.forEach(id => window.clearTimeout(id));
    mainBindRetryTimeoutsRef.current = [];

    const expectedWindow = frame.contentWindow;
    const attemptBind = () => {
      if (!iframeRef.current || iframeRef.current.contentWindow !== expectedWindow) return;
      bindIframeRuntime(iframeRef.current, mainIframeRuntimeCleanupRef, 'main');
      syncHighlightStatusAcrossFrames();
    };

    attemptBind();
    [80, 220, 500].forEach(delay => {
      const timeoutId = window.setTimeout(attemptBind, delay);
      mainBindRetryTimeoutsRef.current.push(timeoutId);
    });
  }, [bindIframeRuntime, syncHighlightStatusAcrossFrames]);

  // Bind the editing pill to the plain-text contentEditable editor (when no iframe is used)
  useEffect(() => {
    const editor = editorRef.current;
    const shouldUseContentEditableRuntime = Boolean(
      editor && content?.body && !content.body.includes('<!DOCTYPE html>')
    );

    if (!shouldUseContentEditableRuntime) {
      if (mainContentEditableRuntimeRef.current && mainIframeRuntimeCleanupRef.current) {
        mainIframeRuntimeCleanupRef.current();
        mainIframeRuntimeCleanupRef.current = null;
      }
      mainContentEditableRuntimeRef.current = null;
      return;
    }

    if (mainContentEditableRuntimeRef.current === editor) {
      return;
    }

    bindIframeRuntime(editor, mainIframeRuntimeCleanupRef, 'main');
    mainContentEditableRuntimeRef.current = editor;
  }, [content?.body, bindIframeRuntime]);

  const handleFullscreenIframeLoad = useCallback(() => {
    const frame = fullscreenIframeRef.current;
    if (!frame) return;
    fullscreenBindRetryTimeoutsRef.current.forEach(id => window.clearTimeout(id));
    fullscreenBindRetryTimeoutsRef.current = [];

    const expectedWindow = frame.contentWindow;
    const attemptBind = () => {
      if (!fullscreenIframeRef.current || fullscreenIframeRef.current.contentWindow !== expectedWindow) return;
      bindIframeRuntime(fullscreenIframeRef.current, fullscreenIframeRuntimeCleanupRef, 'fullscreen');
      syncHighlightStatusAcrossFrames();
    };

    attemptBind();
    [80, 220, 500].forEach(delay => {
      const timeoutId = window.setTimeout(attemptBind, delay);
      fullscreenBindRetryTimeoutsRef.current.push(timeoutId);
    });
  }, [bindIframeRuntime, syncHighlightStatusAcrossFrames]);

  useEffect(() => {
    return () => {
      mainBindRetryTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      mainBindRetryTimeoutsRef.current = [];
      if (mainIframeRuntimeCleanupRef.current) {
        mainIframeRuntimeCleanupRef.current();
        mainIframeRuntimeCleanupRef.current = null;
      }
      mainContentEditableRuntimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!showFullPreview) {
      fullscreenBindRetryTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      fullscreenBindRetryTimeoutsRef.current = [];
      if (fullscreenIframeRuntimeCleanupRef.current) {
        fullscreenIframeRuntimeCleanupRef.current();
        fullscreenIframeRuntimeCleanupRef.current = null;
      }
      return;
    }

    return () => {
      fullscreenBindRetryTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      fullscreenBindRetryTimeoutsRef.current = [];
      if (fullscreenIframeRuntimeCleanupRef.current) {
        fullscreenIframeRuntimeCleanupRef.current();
        fullscreenIframeRuntimeCleanupRef.current = null;
      }
    };
  }, [showFullPreview]);

  useEffect(() => {
    syncHighlightStatusAcrossFrames();
  }, [syncHighlightStatusAcrossFrames, stableIframeSrcDoc]);

  const scrollToHighlight = useCallback((highlightId: string, options?: { pulse?: boolean }) => {
    const frames = [iframeRef.current, fullscreenIframeRef.current].filter(Boolean) as HTMLIFrameElement[];
    for (const frame of frames) {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) continue;
      const node = doc.querySelector<HTMLElement>(`[data-cf-highlight-id="${highlightId}"]`);
      if (!node) continue;
      node.classList.add('cf-focus-ring');
      if (options?.pulse) {
        node.classList.remove('cf-pulse');
        void node.offsetWidth;
        node.classList.add('cf-pulse');
      }
      node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      win.setTimeout(() => {
        node.classList.remove('cf-focus-ring');
        node.classList.remove('cf-pulse');
      }, 1800);
      return true;
    }
    return false;
  }, []);



  const handleHighlightStatusChange = async (highlight: InlineHighlight, nextStatus: 'open' | 'resolved') => {
    if (highlight.local_state || highlight.id.startsWith('pending-')) return;
    if (!profile?.id) return;

    let resNote: string | null = null;
    if (nextStatus === 'resolved') {
      // Automatically capture the current text inside the highlight spans
      const frameDoc = document.querySelector('iframe')?.contentDocument;
      if (frameDoc) {
        const nodes = Array.from(frameDoc.querySelectorAll(`[data-cf-highlight-id="${highlight.highlight_id}"]`));
        if (nodes.length > 0) {
          const currentText = nodes.map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
          resNote = `Changed to: "${currentText}"`;
        } else {
          resNote = "Text was replaced or removed.";
        }
      } else {
        resNote = "Changes applied.";
      }
    }

    try {
      setUpdatingHighlightId(highlight.id);
      const payload =
        nextStatus === 'resolved'
          ? { status: 'resolved', resolved_by: profile.id, resolution_note: resNote, resolved_at: new Date().toISOString() }
          : { status: 'open', resolved_by: null, resolution_note: null, resolved_at: null };

      const { error: updateError } = await supabase
        .from('compliance_highlights')
        .update(payload)
        .eq('id', highlight.id);

      if (updateError) throw updateError;

      setComplianceHighlights(prev => prev.map(item => (
        item.id === highlight.id
          ? {
            ...item,
            status: nextStatus,
            resolved_by: nextStatus === 'resolved' ? profile.id : null,
            resolution_note: nextStatus === 'resolved' ? resNote : null,
            resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null
          }
          : item
      )));
      syncHighlightStatusAcrossFrames();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to update highlight status.');
    } finally {
      setUpdatingHighlightId(null);
    }
  };

  const handlePublishToPortal = async () => {
    // In a real app, this would open a modal to select clients
    // For this demo, we'll simulate publishing to all active clients
    // We would need the content ID to link it in the database
    // For this UI mockup, we'll just show a success message
    try {
      // Simulation of API call
      await new Promise(resolve => setTimeout(resolve, 800));
      alert("Content published to Client Portal successfully!");
    } catch (e) {
      console.error("Error publishing:", e);
      alert("Failed to publish content.");
    }
  };

  const renderChartCard = useCallback((data: any, inline = false) => {
    if (!data) return null;
    return <ChartCard data={data} inline={inline} />;
  }, []);



  const syncInlineCharts = useCallback((options?: { ensureSlot?: boolean }) => {
    const roots = inlineChartRootsRef.current;
    const editorNode = editorRef.current;
    const hasHtmlDocument = (content?.body || '').includes('<!DOCTYPE html>');

    if (!editorNode || !isBlogArticle || !chartData || hasHtmlDocument) {
      roots.forEach((root) => root.unmount());
      roots.clear();
      return;
    }

    const findSlotNodes = () => Array.from(editorNode.querySelectorAll<HTMLElement>(BLOG_CHART_SLOT_SELECTOR));
    let slotNodes = findSlotNodes();

    if (slotNodes.length === 0 && options?.ensureSlot) {
      const slot = document.createElement('div');
      slot.setAttribute('data-cf-chart-slot', 'true');
      slot.setAttribute('contenteditable', 'false');

      const paragraphs = Array.from(editorNode.children).filter((child) => child.tagName === 'P');
      if (paragraphs.length >= 3) {
        editorNode.insertBefore(slot, paragraphs[Math.min(2, paragraphs.length - 1)]);
      } else if (paragraphs.length === 2) {
        editorNode.insertBefore(slot, paragraphs[1]);
      } else if (paragraphs.length === 1) {
        if (paragraphs[0].nextSibling) {
          editorNode.insertBefore(slot, paragraphs[0].nextSibling);
        } else {
          editorNode.appendChild(slot);
        }
      } else if (editorNode.children.length > 1) {
        editorNode.insertBefore(slot, editorNode.children[Math.max(1, editorNode.children.length - 1)]);
      } else {
        editorNode.appendChild(slot);
      }

      slotNodes = [slot];

      const normalizedBody = normalizeBlogBodyWithChartSlot(editorNode.innerHTML, chartData);
      setContent((prev) => {
        if (!prev || prev.body === normalizedBody) return prev;
        return { ...prev, body: normalizedBody };
      });
    }

    roots.forEach((root, node) => {
      if (!slotNodes.includes(node)) {
        root.unmount();
        roots.delete(node);
      }
    });

    isInlineChartSyncingRef.current = true;
    slotNodes.forEach((node) => {
      node.setAttribute('contenteditable', 'false');
      let root = roots.get(node);
      if (!root) {
        node.innerHTML = '';
        root = createRoot(node);
        roots.set(node, root);
      }
      root.render(renderChartCard(chartData, true));
    });

    window.setTimeout(() => {
      isInlineChartSyncingRef.current = false;
    }, 0);
  }, [chartData, content?.body, isBlogArticle, normalizeBlogBodyWithChartSlot, renderChartCard]);

  const scheduleInlineChartSync = useCallback((options?: { ensureSlot?: boolean }) => {
    if (inlineChartSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(inlineChartSyncFrameRef.current);
    }
    inlineChartSyncFrameRef.current = window.requestAnimationFrame(() => {
      inlineChartSyncFrameRef.current = null;
      syncInlineCharts(options);
    });
  }, [syncInlineCharts]);

  useEffect(() => {
    scheduleInlineChartSync({ ensureSlot: true });
  }, [chartData, content?.body, isBlogArticle, scheduleInlineChartSync]);

  useEffect(() => {
    const editorNode = editorRef.current;
    if (!editorNode || !isBlogArticle || !chartData) return;

    const nodeTouchesChartSlot = (node: Node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.matches(BLOG_CHART_SLOT_SELECTOR)) return true;
      return Boolean(node.querySelector(BLOG_CHART_SLOT_SELECTOR));
    };

    const observer = new MutationObserver((mutations) => {
      if (isInlineChartSyncingRef.current) {
        return;
      }

      let shouldSync = false;
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        const target = mutation.target;
        if (target instanceof HTMLElement && target.matches(BLOG_CHART_SLOT_SELECTOR) && target.childNodes.length === 0) {
          shouldSync = true;
          break;
        }
        if (Array.from(mutation.addedNodes).some(nodeTouchesChartSlot) || Array.from(mutation.removedNodes).some(nodeTouchesChartSlot)) {
          shouldSync = true;
          break;
        }
      }

      if (shouldSync) {
        scheduleInlineChartSync({ ensureSlot: true });
      }
    });

    observer.observe(editorNode, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [chartData, isBlogArticle, scheduleInlineChartSync]);

  useEffect(() => {
    if (!isResizingNotes) return;
    scheduleInlineChartSync({ ensureSlot: true });
  }, [isResizingNotes, scheduleInlineChartSync]);

  useEffect(() => {
    return () => {
      if (inlineChartSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(inlineChartSyncFrameRef.current);
        inlineChartSyncFrameRef.current = null;
      }
      inlineChartRootsRef.current.forEach((root) => root.unmount());
      inlineChartRootsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!content || !isBlogArticle || content.body.includes('<!DOCTYPE html>')) return;

    const normalizedBody = normalizeBlogBodyWithChartSlot(content.body || '', chartData);
    if (normalizedBody === content.body) return;

    setContent((prev) => {
      if (!prev) return prev;
      if (prev.body === normalizedBody) return prev;
      return { ...prev, body: normalizedBody };
    });
  }, [chartData, content, isBlogArticle, normalizeBlogBodyWithChartSlot]);

  const textProviderLabel = textProvider === 'kimi' ? 'Kimi K2.5 (NVIDIA NIM)' : 'Claude';
  const imageProviderLabel = imageProvider === 'chatgpt' ? 'ChatGPT Image' : 'Gemini Image (Nano Banana)';
  const imageProviderShortLabel = imageProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Back & Status Header */}
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium transition-colors">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {status !== ContentStatus.DRAFT && (
            <div className="flex items-center gap-2 mr-4 text-sm text-slate-500">
              <History size={16} />
              <span>v{content?.version_number || 1}</span>
            </div>
          )}

          {userRole === UserRole.COMPLIANCE && [ContentStatus.SUBMITTED, ContentStatus.IN_REVIEW, ContentStatus.APPROVED].includes(status) ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleComplianceDecision('changes_requested')}
                className="flex items-center gap-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <MessageSquare size={16} /> Request Changes
              </button>
              <button
                onClick={() => handleComplianceDecision('rejected')}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <XCircle size={16} /> Reject
              </button>
              {status !== ContentStatus.APPROVED && (
                <button
                  onClick={() => handleComplianceDecision('approved')}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Check size={16} /> Approve
                </button>
              )}
            </div>
          ) : (status === ContentStatus.DRAFT || status === ContentStatus.CHANGES_REQUESTED || status === ContentStatus.APPROVED) && (userRole === UserRole.ADVISOR || userRole === UserRole.ADMIN) ? (
            <div className="flex gap-2">
              {/* Only Advisors should see Publish button */}
              <button
                onClick={handlePublishToPortal}
                disabled={!content}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users size={18} />
                Publish to Portal
              </button>
              {content && content.body.includes('<!DOCTYPE html>') && (
                <button
                  onClick={() => {
                    const blob = new Blob([content.body], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${content.title || 'blog-post'}.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <FileText size={18} />
                  Export HTML
                </button>
              )}
              {isApprovedLocked ? (
                /* When approved+locked, only show Unlock & Edit in the toolbar */
                <button
                  onClick={() => {
                    if (window.confirm('Editing this document will remove its Approved status and require re-submission to Compliance. Continue?')) {
                      setIsApprovedLocked(false);
                      setStatus(ContentStatus.DRAFT);
                      if (requestId) {
                        supabase
                          .from('content_requests')
                          .update({ status: 'draft', updated_at: new Date().toISOString() })
                          .eq('id', requestId)
                          .then(() => { });
                      }
                    }
                  }}
                  className="flex items-center gap-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Unlock size={16} />
                  Unlock & Edit
                </button>
              ) : (status === ContentStatus.DRAFT || status === ContentStatus.CHANGES_REQUESTED || status === ContentStatus.APPROVED) && (
                <>
                  <button
                    onClick={async () => {
                      if (!requestId) return;
                      setIsSavingDraft(true);
                      try {
                        await saveCurrentEditorVersion(requestId);
                      } catch (err) {
                        console.error('Failed to save draft:', err);
                      } finally {
                        setIsSavingDraft(false);
                      }
                    }}
                    disabled={!content || isSavingDraft}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSavingDraft ? <Loader2 size={16} className="animate-spin" /> : <Clipboard size={16} />}
                    Save Draft
                  </button>

                  {savedClientName ? (
                    <button
                      onClick={() => handleStatusChange(ContentStatus.SUBMITTED)}
                      disabled={!content}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      {status === ContentStatus.CHANGES_REQUESTED && lastReviewerName
                        ? `Resubmit to ${lastReviewerName}`
                        : status === ContentStatus.CHANGES_REQUESTED || status === ContentStatus.APPROVED
                          ? 'Resubmit for Review'
                          : 'Submit for Review'} <Send size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setShowClientPicker(true);
                        setClientsLoading(true);
                        try {
                          const { data, error: fetchError } = await supabase
                            .from('clients')
                            .select('*')
                            .eq('org_id', profile?.org_id)
                            .order('name');
                          if (fetchError) throw fetchError;
                          setClientsList(data || []);
                        } catch (e: any) {
                          console.error(e);
                          setError('Failed to load clients.');
                        } finally {
                          setClientsLoading(false);
                        }
                      }}
                      disabled={!content}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      Assign to Client <UserPlus size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <StatusBadge status={status} />
          )}

          {/* Optional display for saved client name right next to status */}
          {content && savedClientName && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm ml-2">
              <CheckCircle2 size={16} />
              Saved to {savedClientName}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 relative">
        {/* Left Panel: Controls */}
        <div
          className="flex flex-col gap-6 overflow-y-auto pr-4 relative flex-shrink-0"
          style={{ width: `${notesWidth}px` }}
        >
          {/* System Error Message — Visible to Everyone */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2 shadow-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">System Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {userRole !== UserRole.COMPLIANCE && (
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm transition-all duration-200">
              <div
                className={`flex items-center justify-between cursor-pointer group ${isGeneratorExpanded ? 'mb-6' : ''}`}
                onClick={() => setIsGeneratorExpanded(!isGeneratorExpanded)}
              >
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-lg">
                  <Wand2 size={20} className="text-primary-600" />
                  Content Generator
                </h3>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft
                    size={20}
                    className={`transition-transform duration-200 ${isGeneratorExpanded ? '-rotate-90' : ''}`}
                  />
                </button>
              </div>

              {isGeneratorExpanded && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Topic</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Enter content topic..."
                      disabled={status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Generation Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setGenerationMode('text')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${generationMode === 'text'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        Written Content
                      </button>
                      <button
                        onClick={() => setGenerationMode('image')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${generationMode === 'image'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        Visual Asset
                      </button>
                      <button
                        onClick={() => setGenerationMode('both')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${generationMode === 'both'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        Full Article
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {isVideoScript ? 'Video Length' : 'Length'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setContentLength('Short')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Short'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        {isVideoScript ? 'Short (1-3 min)' : 'Short'}
                      </button>
                      <button
                        onClick={() => setContentLength('Medium')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Medium'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        {isVideoScript ? 'Medium (~8 min)' : 'Medium'}
                      </button>
                      <button
                        onClick={() => setContentLength('Long')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Long'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        {isVideoScript ? 'Long (10+ min)' : 'Long'}
                      </button>
                    </div>

                    {/* Sub-duration selector for Video Script + Short */}
                    {isVideoScript && contentLength === 'Short' && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Duration (minutes)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([1, 2, 3] as const).map((min) => (
                            <button
                              key={min}
                              onClick={() => setShortDuration(min)}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${shortDuration === min
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              {min} min
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Perfect for YouTube Shorts, Reels & TikTok</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Format</label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      disabled={isApprovedLocked || (status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED && status !== ContentStatus.APPROVED)}
                    >
                      <option value="blog">Blog Article</option>
                      <option value="linkedin">LinkedIn Post</option>
                      <option value="facebook">Facebook Post</option>
                      <option value="video_script">Video Script</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Instructions</label>
                    <textarea
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all h-32 resize-none"
                      placeholder="E.g. Target audience is retirees. Tone should be reassuring."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      disabled={isApprovedLocked || (status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED && status !== ContentStatus.APPROVED)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Approved Source URLs (Optional)</label>
                    <textarea
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all h-24 resize-none"
                      placeholder="One URL per line. Only official sources will be used."
                      value={sourceUrlsInput}
                      onChange={(e) => setSourceUrlsInput(e.target.value)}
                      disabled={isApprovedLocked || (status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED && status !== ContentStatus.APPROVED)}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Retrieval uses stored chunks plus these official URLs. Unsupported pages are skipped.
                    </p>
                  </div>

                  {(status === ContentStatus.DRAFT || status === ContentStatus.CHANGES_REQUESTED) && (
                    <div className="space-y-3">
                      {(generationMode === 'text' || generationMode === 'both') && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Text Engine</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setTextProvider('claude')}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${textProvider === 'claude'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              Claude
                            </button>
                            <button
                              onClick={() => setTextProvider('kimi')}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${textProvider === 'kimi'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              Kimi K2.5
                            </button>
                          </div>
                        </div>
                      )}
                      {(generationMode === 'image' || generationMode === 'both' || !!content) && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Image Engine</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setImageProvider('gemini')}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${imageProvider === 'gemini'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              Gemini
                            </button>
                            <button
                              onClick={() => setImageProvider('chatgpt')}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${imageProvider === 'chatgpt'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              ChatGPT
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Number of Variations</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <button
                              key={num}
                              onClick={() => setVariationCount(num)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${variationCount === num
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isExtending}
                        className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2"
                      >
                        {isGenerating ? (
                          <>Generating...</>
                        ) : (
                          <>Generate Draft</>
                        )}
                      </button>

                      {!isGenerating && content && (
                        <button
                          onClick={handleExtend}
                          disabled={isExtending}
                          className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                          {isExtending ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Extending...
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} className="text-violet-600" /> Extend Content
                            </>
                          )}
                        </button>
                      )}


                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Compliance Feedback Card */}
          {reviews.length > 0 && (
            <div className={`rounded-xl p-5 border shadow-sm ${reviews[0].decision === 'approved' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              {reviews[0].decision === 'approved' ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                      <ShieldCheck size={18} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">Compliance Approved</h4>
                      <p className="text-[11px] text-emerald-600">
                        {lastReviewerName || 'Compliance Officer'}
                        {reviews[0].created_at
                          ? ` · ${new Date(reviews[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  {reviews[0].notes && (
                    <div className="bg-white/60 p-3 rounded-lg text-sm mb-2 border text-emerald-800 border-emerald-100/50">
                      "{reviews[0].notes}"
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Check size={10} strokeWidth={3} /> Approved
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-amber-900">
                    <MessageSquare size={16} /> Compliance Notes
                  </h4>
                  <div className="bg-white/60 p-3 rounded-lg text-sm mb-2 border text-amber-800 border-amber-100/50">
                    "{reviews[0].notes}"
                  </div>
                  <div className="flex justify-between items-center text-xs mt-3">
                    <span className="font-medium text-amber-700">
                      Reviewer: {lastReviewerName || 'Compliance Officer'}
                    </span>
                    <StatusBadge status={ContentStatus.CHANGES_REQUESTED} />
                  </div>
                </>
              )}
            </div>
          )}

          {(complianceHighlights.length > 0 || canAddComplianceHighlights) && (
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm transition-all duration-200">
              <div
                className={`flex items-center justify-between cursor-pointer group ${isNotesListExpanded ? 'mb-2' : ''}`}
                onClick={() => setIsNotesListExpanded(!isNotesListExpanded)}
              >
                <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <MessageSquare size={16} /> Inline Highlight Notes
                  {complianceHighlights.filter(h => h.status === 'open').length > 0 && (
                    <span className="ml-5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      {complianceHighlights.filter(h => h.status === 'open').length} open
                    </span>
                  )}
                </h4>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <ChevronLeft
                    size={18}
                    className={`transition-transform duration-200 ${isNotesListExpanded ? '-rotate-90' : ''}`}
                  />
                </button>
              </div>

              {isNotesListExpanded && (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    {userRole === UserRole.ADVISOR
                      ? 'Compliance has highlighted text and left notes. Click each note to jump to the highlighted section.'
                      : 'Compliance can highlight text in the draft and leave exact change notes for advisors.'}
                  </p>

                  {complianceHighlights.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      No inline notes yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {complianceHighlights.map((item, index) => {
                        const isActive = expandedNoteIds.has(item.id);
                        const isSaving = item.local_state === 'saving';
                        const isError = item.local_state === 'error';
                        const statusLabel = isError ? 'error' : isSaving ? 'saving' : item.status;
                        const excerpt = item.selected_text.length > 70
                          ? `${item.selected_text.slice(0, 70)}...`
                          : item.selected_text;

                        return (
                          <div key={item.id} className={`bg-white border rounded-lg ${isActive ? 'border-amber-300' : 'border-slate-200'}`}>
                            <button
                              onClick={() => {
                                setExpandedNoteIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) {
                                    next.delete(item.id);
                                  } else {
                                    next.add(item.id);
                                  }
                                  return next;
                                });
                                if (!expandedNoteIds.has(item.id)) {
                                  scrollToHighlight(item.highlight_id, { pulse: true });
                                }
                              }}
                              className="w-full px-3 py-2.5 text-left flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">Note {complianceHighlights.length - index}</p>
                                <p className="text-[11px] text-slate-500 truncate">"{excerpt}"</p>
                              </div>
                              <span className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${statusLabel === 'resolved'
                                ? 'bg-slate-100 text-slate-600'
                                : statusLabel === 'saving'
                                  ? 'bg-blue-100 text-blue-700'
                                  : statusLabel === 'error'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                {statusLabel}
                              </span>
                            </button>

                            {isActive && (
                              <div className="px-3 pb-3 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 mt-2 mb-2">
                                  {new Date(item.created_at).toLocaleString()}
                                </p>
                                {isError && (
                                  <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                                    {item.local_error || 'Failed to save this inline note.'}
                                  </div>
                                )}
                                <p className="text-xs text-slate-500 mb-1">"{item.selected_text}"</p>
                                <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5 leading-relaxed mb-3 select-text">{item.note}</p>

                                {item.status === 'resolved' && item.resolution_note && (
                                  <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-2">
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Advisor Changelog</p>
                                    <p className="text-sm text-emerald-800 leading-relaxed select-text">{item.resolution_note}</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => scrollToHighlight(item.highlight_id, { pulse: true })}
                                    className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                                  >
                                    Jump to Highlight
                                  </button>
                                  {canResolveComplianceHighlights && !isSaving && !isError && (
                                    <button
                                      onClick={() => handleHighlightStatusChange(item, item.status === 'resolved' ? 'open' : 'resolved')}
                                      disabled={updatingHighlightId === item.id}
                                      className={`text-xs font-medium px-2.5 py-1.5 rounded-md border disabled:opacity-60 ${item.status === 'resolved'
                                        ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                        }`}
                                    >
                                      {updatingHighlightId === item.id
                                        ? 'Saving...'
                                        : item.status === 'resolved'
                                          ? 'Reopen'
                                          : 'Mark Resolved'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Document Editor */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative min-w-[300px] pl-4">
          {/* Distinct Visual Drag Handle on the actual square */}
          <div
            className="absolute top-0 left-0 w-4 h-full cursor-col-resize flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 z-30 transition-colors border-r border-slate-200 group"
            onMouseDown={startResizingNotes}
            title="Drag to resize panels"
          >
            <div className="flex flex-col gap-1 items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-1 rounded-full bg-slate-400" />
              <div className="w-1 h-1 rounded-full bg-slate-400" />
              <div className="w-1 h-1 rounded-full bg-slate-400" />
              <div className="w-1 h-1 rounded-full bg-slate-400" />
              <div className="w-1 h-1 rounded-full bg-slate-400" />
            </div>
          </div>

          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              {/* Animated Header */}
              <div className="relative mb-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Loader2 size={36} className="text-white animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
              </div>

              <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Generating Your Content</h3>
              <p className="text-sm text-slate-400 mb-10">
                {generationMode === 'image'
                  ? `Powered by ${imageProviderLabel}`
                  : generationMode === 'both'
                    ? `Powered by ${textProviderLabel} + ${imageProviderLabel}`
                    : `Powered by ${textProviderLabel}`}
              </p>

              {/* Progress Bar */}
              {(() => {
                const allDone = generationStep >= GENERATION_STEPS.length;
                const progressPercent = allDone ? 100 : Math.round((generationStep / GENERATION_STEPS.length) * 100);
                const displayStep = allDone ? GENERATION_STEPS.length : generationStep + 1;
                return (
                  <div className="w-full max-w-md mb-10">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${allDone ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-primary-500 to-indigo-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-slate-400">{allDone ? 'Complete!' : `Step ${displayStep} of ${GENERATION_STEPS.length}`}</span>
                      <span className={`text-xs font-medium ${allDone ? 'text-emerald-500' : 'text-primary-500'}`}>{progressPercent}%</span>
                    </div>
                  </div>
                );
              })()}

              {/* Step List */}
              <div className="w-full max-w-md space-y-3">
                {GENERATION_STEPS.map((step) => {
                  const StepIcon = step.icon;
                  const isComplete = generationStep > step.id;
                  const isActive = generationStep === step.id;
                  const isPending = generationStep < step.id;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-500 ${isActive
                        ? 'bg-primary-50/60 border-primary-200 shadow-sm shadow-primary-100'
                        : isComplete
                          ? 'bg-emerald-50/40 border-emerald-100'
                          : 'bg-slate-50/50 border-slate-100 opacity-50'
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500 ${isActive
                        ? 'bg-primary-500 text-white shadow-sm'
                        : isComplete
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                        }`}>
                        {isComplete ? (
                          <CheckCircle2 size={18} />
                        ) : isActive ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <StepIcon size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium transition-colors duration-500 ${isActive ? 'text-primary-900' : isComplete ? 'text-emerald-700' : 'text-slate-400'
                          }`}>
                          {step.label}
                        </p>
                      </div>
                      {isActive && (
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : isLoadingRequest ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <Loader2 size={30} className="animate-spin mb-3" />
              <p className="text-sm font-medium">Loading saved content...</p>
            </div>
          ) : !content ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-slate-300" />
              </div>
              <p className="font-medium text-slate-500">No content generated yet</p>
              <p className="text-sm">Use the controls on the left to start a draft.</p>
            </div>
          ) : (
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
              <div className="w-full min-w-0 flex flex-col h-full bg-slate-50/50 p-6">
                <textarea
                  ref={titleRef}
                  className="w-full text-5xl font-extrabold mb-6 border-none focus:ring-0 placeholder-slate-300 text-slate-900 p-0 resize-none overflow-hidden bg-transparent leading-tight tracking-tight"
                  style={{ fontWeight: 800, fontSize: '2.8rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}
                  value={content.title}
                  onChange={(e) => {
                    setContent({ ...content, title: e.target.value });
                    // Auto-resize height
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  rows={1}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Untitled Document"
                />

                {/* Approval Banner */}
                {status === ContentStatus.APPROVED && isApprovedLocked && (
                  <div className="mt-4 flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-5 py-3.5 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                      <ShieldCheck size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-800">
                        Compliance Approved
                      </p>
                      <p className="text-xs text-emerald-600">
                        {lastReviewerName ? `Approved by ${lastReviewerName}` : 'Approved by Compliance'}
                        {reviews.length > 0 && reviews[0].decision === 'approved' && reviews[0].created_at
                          ? ` on ${new Date(reviews[0].created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                          : ''
                        }
                        . Ready to publish.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Editing this document will remove its Approved status and require re-submission to Compliance. Continue?')) {
                          setIsApprovedLocked(false);
                          setStatus(ContentStatus.DRAFT);
                          // Update in DB
                          if (requestId) {
                            supabase
                              .from('content_requests')
                              .update({ status: 'draft', updated_at: new Date().toISOString() })
                              .eq('id', requestId)
                              .then(() => { });
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                    >
                      <Unlock size={13} />
                      Unlock & Edit
                    </button>
                  </div>
                )}

                <div
                  ref={editorRef}
                  className="shrink-0 min-w-0 prose prose-slate prose-lg max-w-none focus:outline-none min-h-[300px] bg-white rounded-xl border border-slate-200 p-8 shadow-sm flow-root [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-4"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: content.body }}
                  onClick={(event) => {
                    const target = event.target as HTMLElement | null;
                    const markerNode = target?.closest?.('[data-cf-citation-marker]') as HTMLElement | null;
                    const marker = markerNode?.getAttribute('data-cf-citation-marker');
                    if (!marker) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openCitationByMarker(marker);
                  }}
                  onBlur={(e) => {
                    const nextFocused = e.relatedTarget as HTMLElement | null;
                    if (nextFocused?.closest('#cfIframePill')) {
                      return;
                    }
                    const nextBody = isBlogArticle
                      ? normalizeBlogBodyWithChartSlot(e.currentTarget.innerHTML, chartData)
                      : sanitizeBlogBodyForStorage(e.currentTarget.innerHTML);
                    if (isBlogArticle && chartData) {
                      scheduleInlineChartSync({ ensureSlot: true });
                    }
                    if (nextBody === content.body) {
                      return;
                    }
                    setContent({ ...content, body: nextBody });
                  }}
                />

                {/* Generate Image Button (Only if no image present or as an option) */}
                {(generationMode === 'text' || generationMode === 'both') && !isExtending && !isGenerating && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="group flex items-center gap-3 px-6 py-3 bg-white border-2 border-primary-100 text-primary-700 rounded-2xl font-semibold hover:border-primary-500 hover:bg-primary-50 transition-all duration-300 shadow-sm shadow-primary-50/50 disabled:opacity-50"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 size={20} className="animate-spin text-primary-500" />
                          <span>{imageProviderShortLabel} is Visualizing...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors duration-300">
                            <Sparkles size={18} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold">Generate Inline Image</p>
                            <p className="text-[10px] text-primary-500 font-medium">Powered by {imageProviderLabel}</p>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {content.disclaimers && (
                  <div className="shrink-0 mt-12 pt-8 border-t border-slate-100">
                    <h5 className="text-xs font-semibold uppercase text-slate-400 mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} /> Required Disclaimers
                    </h5>
                    <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed">
                      {content.disclaimers}
                    </div>
                  </div>
                )}

                {chartData && !content.body.includes('data-cf-chart-slot="true"') && renderChartCard(chartData, false)}

                {(groundingStatus || sourceLimitations) && (
                  <div className="shrink-0 mt-10 pt-6 border-t border-slate-100">
                    <div className={`rounded-xl border px-4 py-3 text-sm ${groundingStatus === 'grounded'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : groundingStatus === 'limited'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                      <p className="font-semibold">
                        {groundingStatus === 'grounded'
                          ? 'Grounded citations attached'
                          : groundingStatus === 'limited'
                            ? 'Limited grounding confidence'
                            : 'Ungrounded response'}
                      </p>
                      {sourceLimitations && <p className="mt-1">{sourceLimitations}</p>}
                    </div>
                  </div>
                )}

                {citations.length > 0 && (
                  <div className="shrink-0 mt-10 pt-6 border-t border-slate-100">
                    <h5 className="text-xs font-semibold uppercase text-slate-400 mb-3">Citations</h5>
                    <div className="space-y-2">
                      {citations.map((citation) => (
                        <button
                          key={`${citation.marker}-${citation.source_id}-${citation.chunk_index}`}
                          onClick={() => setActiveCitation(citation)}
                          className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800">{citation.marker} {citation.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{citation.quoted_span}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="shrink-0 mt-10 pt-6 border-t border-slate-100">
                    <h5 className="text-xs font-semibold uppercase text-slate-400 mb-3">Sources</h5>
                    <div className="space-y-2">
                      {sources.map((source) => (
                        <div key={source.source_id} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                          <p className="text-sm font-semibold text-slate-800">{source.title}</p>
                          <p className="text-xs text-slate-500">{source.source_type}</p>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary-600 hover:text-primary-700 underline break-all"
                            >
                              {source.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Extension Progress Overlay */}
              {isExtending && (
                <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 p-6 shadow-[-10px_-10px_30px_rgba(0,0,0,0.05)] transition-all animate-in slide-in-from-bottom-5">
                  <div className="max-w-xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-500 animate-pulse" />
                        Extending Article...
                      </h4>
                      <span className="text-xs font-medium text-slate-500">
                        {EXTENSION_STEPS[Math.min(extensionStep, EXTENSION_STEPS.length - 1)].label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(((extensionStep + 1) / EXTENSION_STEPS.length) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      {EXTENSION_STEPS.map((step, idx) => (
                        <div key={idx} className={`flex items-center gap-1 transition-colors duration-300 ${extensionStep >= idx ? 'text-violet-600 font-medium' : ''}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${extensionStep >= idx ? 'bg-violet-500' : 'bg-slate-200'}`} />
                          <span className="hidden sm:inline">{step.label.split(' ')[0]}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image Selection Modal */}
        {showImageSelection && generatedImages.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <h3 className="text-xl font-display font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles size={20} className="text-primary-500" /> Select a Visual
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{imageProviderShortLabel} generated {generatedImages.length} variations based on your content.</p>
                </div>
                <button
                  onClick={() => setShowImageSelection(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {generatedImages.map((img, idx) => {
                    const isSaving = savingImageIndex === idx;
                    const isOtherSaving = savingImageIndex !== null && savingImageIndex !== idx;
                    return (
                      <div
                        key={idx}
                        className={`group relative bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isSaving
                          ? 'border-primary-400 ring-2 ring-primary-200 shadow-md'
                          : isOtherSaving
                            ? 'border-slate-200 opacity-40 cursor-not-allowed'
                            : 'border-slate-200 hover:shadow-md hover:border-primary-300 cursor-pointer'
                          }`}
                        onClick={() => !savingImageIndex && selectImage(img, idx)}
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                          <div
                            className="w-full h-full [&>figure]:m-0 [&>figure>img]:w-full [&>figure>img]:h-full [&>figure>img]:object-cover [&>figure>img]:rounded-none [&>figure>figcaption]:hidden pointer-events-none"
                            dangerouslySetInnerHTML={{ __html: img.html }}
                          />
                          {isSaving ? (
                            <div className="absolute inset-0 bg-primary-900/30 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 animate-in fade-in duration-200">
                              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <Loader2 size={24} className="text-primary-600 animate-spin" />
                              </div>
                              <span className="bg-white/90 text-primary-700 px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                                Saving...
                              </span>
                            </div>
                          ) : !isOtherSaving && (
                            <div className="absolute inset-0 bg-primary-900/0 group-hover:bg-primary-900/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="bg-white text-primary-600 px-4 py-2 rounded-full font-medium shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                Select This Image
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-white">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Variation {idx + 1}</p>
                          <p className="text-sm text-slate-700 line-clamp-2" title={img.caption || "Generated concept"}>
                            {img.caption || "Visual concept focusing on key themes."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button
                  onClick={() => setShowImageSelection(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Generate New Variations
                </button>
              </div>
            </div>
          </div>
        )}

        {activeCitation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display font-semibold text-slate-900">{activeCitation.marker} Citation Detail</h3>
                  <p className="text-sm text-slate-500">{activeCitation.title}</p>
                </div>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {activeCitation.url && (
                  <a
                    href={activeCitation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-700 underline break-all"
                  >
                    {activeCitation.url}
                  </a>
                )}
                <p className="text-sm text-slate-600">
                  {activeCitation.page ? `Page: ${activeCitation.page}` : 'Page: n/a'}
                  {' · '}
                  {activeCitation.section ? `Section: ${activeCitation.section}` : 'Section: n/a'}
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Supporting Excerpt</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{activeCitation.quoted_span}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Text Selection Modal */}
        {showTextSelection && generatedTextOptions.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <h3 className="text-xl font-display font-semibold text-slate-900 flex items-center gap-2">
                    <BookOpen size={20} className="text-primary-500" /> Choose a Starting Draft
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">AI generated {generatedTextOptions.length} distinct variations for you.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
                {generatedTextOptions.map((opt, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary-300 transition-all">
                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Variation {idx + 1}</span>
                      <button
                        onClick={() => selectTextOption(opt)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      >
                        Select This Draft <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="p-5">
                      <h4 className="font-semibold text-slate-800 text-lg mb-2">{opt.title}</h4>
                      <div className="text-sm text-slate-600 line-clamp-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: opt.body.replace(/<[^>]*>?/gm, '') }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button
                  onClick={() => setShowTextSelection(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Keep Current Selection
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {showFullPreview && content && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-[1400px] max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
                <Maximize2 size={18} className="text-primary-500" /> Fullscreen Preview
              </h3>
              <button
                onClick={() => setShowFullPreview(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100/50 p-2 md:p-6">
              <iframe
                ref={fullscreenIframeRef}
                srcDoc={stableIframeSrcDoc}
                onLoad={handleFullscreenIframeLoad}
                title="Fullscreen Preview"
                className="w-full h-full border border-slate-200 shadow-sm rounded-lg bg-white"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      {/* Client Picker Modal */}
      {showClientPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-primary-500" /> Save to Client
                </h3>
                <button
                  onClick={() => { setShowClientPicker(false); setClientSearch(''); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {clientsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-primary-500" />
                </div>
              ) : (() => {
                const filtered = clientsList.filter(c =>
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.company && c.company.toLowerCase().includes(clientSearch.toLowerCase()))
                );
                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-medium">No clients found</p>
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-slate-100">
                    {filtered.map((client) => {
                      const initials = client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500', 'bg-sky-500', 'bg-teal-500'];
                      const hash = client.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                      const avatarColor = colors[hash % colors.length];
                      return (
                        <button
                          key={client.id}
                          disabled={isSavingToClient}
                          onClick={async () => {
                            if (!requestId || !content) return;
                            setIsSavingToClient(true);
                            try {
                              // Update content_requests.client_id
                              const { error: updateErr } = await supabase
                                .from('content_requests')
                                .update({ client_id: client.id, updated_at: new Date().toISOString() })
                                .eq('id', requestId);
                              if (updateErr) throw updateErr;

                              // Insert into client_content_shares
                              const { error: shareErr } = await supabase
                                .from('client_content_shares')
                                .upsert({
                                  client_id: client.id,
                                  content_version_id: content.id,
                                  shared_at: new Date().toISOString(),
                                  status: 'unread',
                                }, { onConflict: 'client_id,content_version_id' });
                              if (shareErr) throw shareErr;

                              setSavedClientName(client.name);
                              setSavedClientId(client.id);
                              setShowClientPicker(false);
                              setClientSearch('');
                            } catch (e: any) {
                              console.error(e);
                              setError(e.message || 'Failed to save to client.');
                            } finally {
                              setIsSavingToClient(false);
                            }
                          }}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-primary-50/50 transition-colors text-left disabled:opacity-50"
                        >
                          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${avatarColor} shadow-sm`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{client.name}</p>
                            {client.company && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                <Building2 size={11} /> {client.company}
                              </p>
                            )}
                          </div>
                          {isSavingToClient ? (
                            <Loader2 size={16} className="animate-spin text-primary-500 shrink-0" />
                          ) : (
                            <ArrowRight size={16} className="text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {showComplianceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowComplianceModal(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Submit for Review</h3>
                <p className="text-xs text-slate-500">Select a compliance team member</p>
              </div>
              <button
                onClick={() => setShowComplianceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {complianceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-primary-600" />
                </div>
              ) : complianceTeam.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">No compliance team members found</p>
                  <p className="text-xs text-slate-400 mt-1">Sign up a user with the Compliance role to see them here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {complianceTeam.map((member, idx) => {
                    const initials = (member.name || member.email || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
                    return (
                      <button
                        key={member.id}
                        onClick={() => setSelectedReviewer(member.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedReviewer === member.id
                          ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/10'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${colors[idx % colors.length]}`}>
                          {initials}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-slate-800 leading-none mb-1">{member.name || 'Unnamed'}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                        {selectedReviewer === member.id && (
                          <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={() => setShowComplianceModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReviewSubmit()}
                disabled={!selectedReviewer || isSavingDraft}
                className="flex-[2] px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isSavingDraft ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentEditor;
