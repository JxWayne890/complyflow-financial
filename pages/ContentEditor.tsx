import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { triggerContentGeneration, supabase } from '../services/supabaseClient';
import { UserRole, ContentStatus, ContentVersion, ComplianceReview, Profile } from '../types';
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
  Minimize2,
  Maximize2,
  ShieldCheck,
  Clipboard,
  X,
  Users,
  ArrowLeft
} from 'lucide-react';

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

interface ContentEditorProps {
  userRole: UserRole;
  profile: Profile | null;
}

type TextProvider = 'claude' | 'kimi';

const ContentEditor: React.FC<ContentEditorProps> = ({ userRole, profile }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id } = useParams(); // contentRequestId
  const [requestId, setRequestId] = useState<string | null>(id || null);
  const clientId = searchParams.get('clientId');

  // State
  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [contentType, setContentType] = useState('blog');
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Select & Fix State
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showComplianceInput, setShowComplianceInput] = useState(false);
  const [complianceNote, setComplianceNote] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Content State
  const [content, setContent] = useState<ContentVersion | null>(null);
  const [status, setStatus] = useState<ContentStatus>(ContentStatus.DRAFT);
  const [reviews, setReviews] = useState<ComplianceReview[]>([]);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);

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

      const { data: latestVersionData, error: latestVersionError } = await supabase
        .from('content_versions')
        .select('*')
        .eq('request_id', requestIdToLoad)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersionError) throw latestVersionError;
      setContent(latestVersionData || null);

      const { data: reviewData, error: reviewError } = await supabase
        .from('compliance_reviews')
        .select('id, decision, notes, reviewer_id, created_at')
        .eq('request_id', requestIdToLoad)
        .order('created_at', { ascending: false });

      if (reviewError) throw reviewError;
      setReviews((reviewData || []) as ComplianceReview[]);
    } catch (e: any) {
      console.error("Failed to load content request:", e);
      setError(e.message || 'Failed to load content request.');
    } finally {
      setIsLoadingRequest(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    void loadRequestData(id);
  }, [id, loadRequestData]);

  const [generationMode, setGenerationMode] = useState<'text' | 'image' | 'both'>('text');
  const [textProvider, setTextProvider] = useState<TextProvider>('claude');
  const [contentLength, setContentLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [generationStep, setGenerationStep] = useState(0);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [extensionStep, setExtensionStep] = useState(0);
  const extensionTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        client_id: parsedClientId,
        updated_at: new Date().toISOString(),
      };

      if (status === ContentStatus.CHANGES_REQUESTED) {
        updates.status = ContentStatus.DRAFT;
      }

      const { error: requestUpdateError } = await supabase
        .from('content_requests')
        .update(updates)
        .eq('id', requestId);

      if (requestUpdateError) throw requestUpdateError;
      if (updates.status) setStatus(updates.status);
      return requestId;
    }

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

    if (requestError) throw requestError;
    setRequestId(requestData.id);
    return requestData.id;
  };

  const createContentVersion = async (targetRequestId: string, payload: {
    generated_by: 'ai' | 'human';
    title: string;
    body: string;
    disclaimers?: string;
  }) => {
    const nextVersion = (content?.version_number || 0) + 1;
    const { data: versionData, error: versionError } = await supabase
      .from('content_versions')
      .insert({
        request_id: targetRequestId,
        version_number: nextVersion,
        generated_by: payload.generated_by,
        title: payload.title,
        body: payload.body,
        disclaimers: payload.disclaimers || null,
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
    const latestBody = latestBodyRaw.replace(/class="new-content-highlight"/g, '').trim();
    const latestTitle = (content.title || '').trim();
    const existingBody = (content.body || '').replace(/class="new-content-highlight"/g, '').trim();
    const existingTitle = (content.title || '').trim();

    if (latestBody === existingBody && latestTitle === existingTitle) {
      return content;
    }

    const savedVersion = await createContentVersion(targetRequestId, {
      generated_by: 'human',
      title: latestTitle,
      body: latestBody,
      disclaimers: content.disclaimers,
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

    const noteValue = window.prompt(notePrompt) ?? '';
    if (decision !== 'approved' && !noteValue.trim()) {
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

  const handleGenerate = async () => {
    if (!profile?.org_id) {
      alert("Missing profile or organization context. Please ensure you are logged in correctly.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep(0);
    setError(null);
    try {
      let result = {
        title: topic,
        body: '',
        disclaimers: '',
        generated_by: 'ai'
      };

      // 1. Generate Text (Claude or Kimi)
      if (generationMode === 'text' || generationMode === 'both') {
        const textResponse: any = await triggerContentGeneration({
          topic,
          contentType,
          instructions,
          provider: textProvider,
          contentLength,
        });

        result.title = textResponse.data.title;
        result.body = textResponse.data.body;
        result.disclaimers = textResponse.data.disclaimers;
      }

      // 2. Generate Image (Gemini)
      if (generationMode === 'image' || generationMode === 'both') {
        const imageResponse: any = await triggerContentGeneration({
          topic,
          contentType,
          instructions,
          provider: 'gemini',
          contentLength,
        });

        // If Image Only, use Title from Topic
        if (generationMode === 'image') {
          result.title = `Visual Asset: ${topic}`;
          result.body = imageResponse.data.body; // Placeholder or description
          result.disclaimers = imageResponse.data.disclaimers;
        } else {
          // If Both, append Image to Body (Top)
          result.body = `${imageResponse.data.body}<br/><hr/><br/>${result.body}`;
        }
      }

      // Mark all steps as complete
      setGenerationStep(GENERATION_STEPS.length);

      const currentRequestId = await ensureRequestId();
      const savedVersion = await createContentVersion(currentRequestId, {
        generated_by: 'ai',
        title: result.title,
        body: result.body,
        disclaimers: result.disclaimers,
      });

      setContent(savedVersion);

      if (!id) {
        window.history.replaceState(null, '', `#/content/${currentRequestId}`);
      }

    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred while generating content. Please check your API keys and try again.");
    } finally {
      setIsGenerating(false);
    }
  };



  const handleHighlightAnimation = (oldBody: string, newBody: string) => {
    try {
      // Create temporary elements to parse HTML
      const parser = new DOMParser();
      const oldDoc = parser.parseFromString(oldBody, 'text/html');
      const newDoc = parser.parseFromString(newBody, 'text/html');

      const oldTextContent = oldDoc.body.textContent || '';
      const newContainer = document.createElement('div');
      newContainer.innerHTML = newBody;

      // Identify and mark new blocks
      const children = Array.from(newDoc.body.children);
      let modifiedBody = '';

      if (children.length > 0) {
        children.forEach((child) => {
          const text = child.textContent?.trim() || '';
          // Simple heuristic: if block text > 20 chars and not found in old text
          // It's likely new content
          if (text.length > 20 && !oldTextContent.includes(text)) {
            child.classList.add('new-content-highlight');
          }
          modifiedBody += child.outerHTML;
        });
      } else {
        // Fallback for simple text or if structure is flat
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

    // Store previous body for diffing
    const previousBody = content.body;

    try {
      // Improve body stripping for context
      const currentBodyText = content.body.replace(/<[^>]*>?/gm, '');

      const response: any = await triggerContentGeneration({
        topic,
        contentType,
        instructions,
        provider: textProvider,
        contentLength,
        action: 'extend',
        currentContent: currentBodyText
      });

      // Mark all steps as complete
      setExtensionStep(EXTENSION_STEPS.length);
      await new Promise(resolve => setTimeout(resolve, 800));

      if (response.data) {
        if (!requestId) {
          throw new Error('No request selected to save extension changes.');
        }

        const savedVersion = await createContentVersion(requestId, {
          generated_by: 'ai',
          title: content.title,
          body: response.data.body || content.body,
          disclaimers: content.disclaimers,
        });

        // Apply highlight animation
        const highlightedBody = handleHighlightAnimation(previousBody, savedVersion.body);

        setContent({
          ...savedVersion,
          body: highlightedBody,
        });

        // Remove highlights after animation plays (4s)
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
        await saveCurrentEditorVersion(currentRequestId);
      }

      const persistedStatus =
        newStatus === ContentStatus.SUBMITTED ? ContentStatus.IN_REVIEW : newStatus;

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

  // --- Select & Fix: Selection Detection ---
  const handleTextSelection = useCallback(() => {
    if (isRewriting) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      // Only hide if not showing compliance input
      if (!showComplianceInput) {
        setShowToolbar(false);
        setSelectedText('');
        setSelectionRange(null);
      }
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) return;

    // Check if selection is inside our editor
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;

    setSelectedText(text);
    setSelectionRange(range.cloneRange());

    // Position toolbar above selection
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current?.closest('.lg\\:col-span-8')?.getBoundingClientRect();
    if (editorRect) {
      setToolbarPosition({
        top: rect.top - editorRect.top - 55,
        left: rect.left - editorRect.left + (rect.width / 2) - 120,
      });
    }
    setShowToolbar(true);
    setShowComplianceInput(false);
    setComplianceNote('');
  }, [isRewriting, showComplianceInput]);

  // Click outside to dismiss toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowToolbar(false);
        setShowComplianceInput(false);
        setComplianceNote('');
      }
    };
    if (showToolbar) {
      // Slight delay to avoid immediate dismissal
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showToolbar]);

  // --- Select & Fix: Rewrite Handler ---
  const handleRewrite = async (mode: 'rewrite' | 'shorten' | 'expand' | 'fix_compliance') => {
    if (!selectedText || !selectionRange || !content || !requestId) return;

    setIsRewriting(true);
    setError(null);

    try {
      const response: any = await triggerContentGeneration({
        topic,
        contentType,
        instructions,
        provider: textProvider,
        action: 'rewrite',
        currentContent: selectedText,
        rewriteMode: mode,
        complianceNote: mode === 'fix_compliance' ? complianceNote : undefined,
      });

      if (response.data) {
        // Get the raw rewritten text from the response
        let rewrittenText = response.data.body || response.data.title || '';
        // Strip any wrapping HTML if the API returned simple text
        rewrittenText = rewrittenText.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '').trim();

        // Create a highlighted replacement node
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'new-content-highlight';
        highlightSpan.textContent = rewrittenText;

        // Replace selected range
        selectionRange.deleteContents();
        selectionRange.insertNode(highlightSpan);

        if (!requestId) {
          throw new Error('No request selected to save rewrite changes.');
        }

        if (editorRef.current) {
          const newBody = editorRef.current.innerHTML;

          const savedVersion = await createContentVersion(requestId, {
            generated_by: 'ai',
            title: content.title,
            body: newBody.replace(/class="new-content-highlight"/g, ''),
            disclaimers: content.disclaimers,
          });

          setContent({
            ...savedVersion,
            body: newBody,
          });
        }

        // Remove highlight after animation
        setTimeout(() => {
          // Since we might have updated state and re-rendered, highlightSpan might be stale
          // but for simple cases it works. For a truly robust editor we'd use a better approach.
          if (highlightSpan.parentNode) {
            const textNode = document.createTextNode(highlightSpan.textContent || '');
            highlightSpan.parentNode.replaceChild(textNode, highlightSpan);
          }

          setContent(prev => {
            if (!prev) return null;
            return {
              ...prev,
              body: prev.body.replace(/class="new-content-highlight"/g, ''),
            };
          });
        }, 4500);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to rewrite selection.');
    } finally {
      setIsRewriting(false);
      setShowToolbar(false);
      setShowComplianceInput(false);
      setComplianceNote('');
      setSelectedText('');
      setSelectionRange(null);
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

          {userRole === UserRole.COMPLIANCE && [ContentStatus.SUBMITTED, ContentStatus.IN_REVIEW].includes(status) ? (
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
              <button
                onClick={() => handleComplianceDecision('approved')}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Check size={16} /> Approve
              </button>
            </div>
          ) : (status === ContentStatus.DRAFT || status === ContentStatus.CHANGES_REQUESTED || status === ContentStatus.APPROVED) && userRole === UserRole.ADVISOR ? (
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
              {(status === ContentStatus.DRAFT || status === ContentStatus.CHANGES_REQUESTED) && (
                <button
                  onClick={() => handleStatusChange(ContentStatus.SUBMITTED)}
                  disabled={!content}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  {status === ContentStatus.CHANGES_REQUESTED ? 'Resubmit for Review' : 'Submit for Review'} <Send size={16} />
                </button>
              )}
            </div>
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-display font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Wand2 size={18} className="text-primary-500" /> Content Generator
            </h3>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Generation Failed</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-5">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Length</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setContentLength('Short')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Short'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    Short
                  </button>
                  <button
                    onClick={() => setContentLength('Medium')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Medium'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setContentLength('Long')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${contentLength === 'Long'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    Long
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Format</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  disabled={status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED}
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
                  disabled={status !== ContentStatus.DRAFT && status !== ContentStatus.CHANGES_REQUESTED}
                />
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
          </div>

          {/* Compliance Feedback Card */}
          {reviews.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 shadow-sm">
              <h4 className="font-semibold text-amber-900 text-sm flex items-center gap-2 mb-3">
                <MessageSquare size={16} /> Compliance Notes
              </h4>
              <div className="bg-white/60 p-3 rounded-lg text-sm text-amber-800 mb-2 border border-amber-100/50">
                "{reviews[0].notes}"
              </div>
              <div className="flex justify-between items-center text-xs mt-3">
                <span className="text-amber-700 font-medium">Reviewer: Compliance Officer</span>
                <StatusBadge status={ContentStatus.CHANGES_REQUESTED} />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Document Editor */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
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
                  ? 'Powered by Gemini Image (Nano Banana)'
                  : generationMode === 'both'
                    ? `Powered by ${textProvider === 'kimi' ? 'Kimi K2.5' : 'Claude'} + Gemini Image`
                    : `Powered by ${textProvider === 'kimi' ? 'Kimi K2.5 (NVIDIA NIM)' : 'Claude'}`}
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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto py-12 px-8">
                <textarea
                  className="w-full text-4xl font-display font-bold mb-8 border-none focus:ring-0 placeholder-slate-300 text-slate-900 p-0 resize-none overflow-hidden bg-transparent"
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
                <div
                  ref={editorRef}
                  className="prose prose-slate prose-lg max-w-none focus:outline-none min-h-[300px]"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: content.body }}
                  onBlur={(e) => setContent({ ...content, body: e.currentTarget.innerHTML })}
                  onMouseUp={handleTextSelection}
                />

                {/* Floating Selection Toolbar */}
                {showToolbar && toolbarPosition && (
                  <div
                    ref={toolbarRef}
                    className="selection-toolbar"
                    style={{ top: toolbarPosition.top, left: Math.max(0, toolbarPosition.left) }}
                  >
                    {isRewriting ? (
                      <div className="flex items-center gap-2 px-3 py-1">
                        <Loader2 size={14} className="animate-spin text-primary-500" />
                        <span className="text-xs text-slate-500 font-medium">Rewriting...</span>
                      </div>
                    ) : showComplianceInput ? (
                      <div className="compliance-input-wrapper">
                        <input
                          type="text"
                          placeholder="Compliance note..."
                          value={complianceNote}
                          onChange={(e) => setComplianceNote(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && complianceNote.trim()) handleRewrite('fix_compliance'); }}
                          autoFocus
                        />
                        <button onClick={() => complianceNote.trim() && handleRewrite('fix_compliance')}>
                          Fix
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => handleRewrite('rewrite')}>
                          <RefreshCw size={13} /> Rewrite
                        </button>
                        <button onClick={() => handleRewrite('shorten')}>
                          <Minimize2 size={13} /> Shorten
                        </button>
                        <button onClick={() => handleRewrite('expand')}>
                          <Maximize2 size={13} /> Expand
                        </button>
                        <div className="divider" />
                        <button onClick={() => setShowComplianceInput(true)}>
                          <ShieldCheck size={13} className="text-amber-500" /> Fix Compliance
                        </button>
                      </>
                    )}
                  </div>
                )}

                {content.disclaimers && (
                  <div className="mt-12 pt-8 border-t border-slate-100">
                    <h5 className="text-xs font-semibold uppercase text-slate-400 mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} /> Required Disclaimers
                    </h5>
                    <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed">
                      {content.disclaimers}
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
      </div>
    </div>
  );
};

export default ContentEditor;
