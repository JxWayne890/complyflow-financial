import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { triggerContentGeneration, supabase } from '../services/supabaseClient';
import { UserRole, ContentStatus, ContentVersion, ComplianceReview, Profile, Client } from '../types';
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
  ArrowLeft,
  BookOpen,
  ArrowRight,
  Search,
  UserPlus,
  Building2
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
type ImageProvider = 'gemini' | 'chatgpt';

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
  const [error, setError] = useState<string | null>(null);

  // Save to Client state
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isSavingToClient, setIsSavingToClient] = useState(false);
  const [savedClientName, setSavedClientName] = useState<string | null>(null);

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
  const selectionRafRef = useRef<number | null>(null);

  // Content State
  const [content, setContent] = useState<ContentVersion | null>(null);
  const [status, setStatus] = useState<ContentStatus>(ContentStatus.DRAFT);
  const [reviews, setReviews] = useState<ComplianceReview[]>([]);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

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
    const targetId = id || existingId;
    if (!targetId) return;
    void loadRequestData(targetId);
  }, [id, existingId, loadRequestData]);

  const [generationMode, setGenerationMode] = useState<'text' | 'image' | 'both'>('text');
  const [textProvider, setTextProvider] = useState<TextProvider>('claude');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('gemini');
  const [contentLength, setContentLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [variationCount, setVariationCount] = useState<number>(1);
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

    try {
      const currentRequestId = await ensureRequestId();

      if (generationMode === 'image') {
        // IMAGE-ONLY mode: use the image provider directly
        const imageResponse: any = await triggerContentGeneration({
          topic,
          contentType,
          instructions: finalInstructions || 'Generate a high-quality financial illustration.',
          provider: imageProvider,
          count: variationCount,
        });

        // Always create/reset content to image-only (clear any previous text body)
        const placeholderVersion = await createContentVersion(currentRequestId, {
          generated_by: 'ai',
          title: `Visual Asset: ${topic}`,
          body: '',
          disclaimers: imageResponse.data?.disclaimers || '',
        });
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
          });
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
          });
        }

        let savedVersion: any = null;

        if (generateResponse.data && generateResponse.data.options && generateResponse.data.options.length > 1) {
          setGeneratedTextOptions(generateResponse.data.options);
          setShowTextSelection(true);

          const firstOption = generateResponse.data.options[0];
          savedVersion = await createContentVersion(currentRequestId, {
            generated_by: 'ai',
            title: firstOption.title,
            body: firstOption.body,
            disclaimers: firstOption.disclaimers,
          });
          setContent(savedVersion);
        } else if (generateResponse.data) {
          savedVersion = await createContentVersion(currentRequestId, {
            generated_by: 'ai',
            title: generateResponse.data.title,
            body: generateResponse.data.body,
            disclaimers: generateResponse.data.disclaimers,
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
            });

            if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 1) {
              setGeneratedImages(imageResponse.data.images);
              setShowImageSelection(true);
            } else if (imageResponse.data) {
              const imgHtml = imageResponse.data.body;
              const newBody = `${imgHtml}<br/><hr/><br/>${savedVersion.body}`;
              const updatedVersion = await createContentVersion(currentRequestId, {
                generated_by: 'ai',
                title: savedVersion.title,
                body: newBody,
                disclaimers: savedVersion.disclaimers,
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
      const savedVersion = await createContentVersion(requestId, {
        generated_by: 'ai',
        title: option.title,
        body: option.body,
        disclaimers: option.disclaimers,
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
        body: newBody,
        disclaimers: content.disclaimers,
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
        currentContent: currentBodyText
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
          body: response.data.body || content.body,
          disclaimers: content.disclaimers,
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

  const clearSelectionToolbar = useCallback((preserveComplianceInput = false) => {
    if (preserveComplianceInput) return;
    setShowToolbar(false);
    setSelectedText('');
    setSelectionRange(null);
    setToolbarPosition(null);
    setShowComplianceInput(false);
    setComplianceNote('');
  }, []);

  const getSelectionRect = useCallback((range: Range) => {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }

    const rects = range.getClientRects();
    if (rects.length > 0) {
      return rects[rects.length - 1] as DOMRect;
    }

    return null;
  }, []);

  const calculateToolbarPosition = useCallback((range: Range, complianceOpen: boolean) => {
    const rect = getSelectionRect(range);
    if (!rect) return null;

    const estimatedWidth = complianceOpen ? 300 : 440;
    const estimatedHeight = complianceOpen ? 56 : 44;
    const viewportPadding = 8;

    const centeredLeft = rect.left + (rect.width / 2) - (estimatedWidth / 2);
    const maxLeft = window.innerWidth - estimatedWidth - viewportPadding;
    const left = Math.max(viewportPadding, Math.min(centeredLeft, maxLeft));

    let top = rect.top - estimatedHeight - 12;
    if (top < viewportPadding) {
      top = rect.bottom + 12;
    }

    return {
      top: Math.max(viewportPadding, top),
      left,
    };
  }, [getSelectionRect]);

  const syncSelectionToolbar = useCallback(() => {
    if (isRewriting) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
      clearSelectionToolbar(showComplianceInput);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      clearSelectionToolbar(showComplianceInput);
      return;
    }

    const text = selection.toString().trim();
    const position = calculateToolbarPosition(range, showComplianceInput);

    if (!position) {
      clearSelectionToolbar(showComplianceInput);
      return;
    }

    setSelectedText(text);
    setSelectionRange(range.cloneRange());
    setToolbarPosition(position);
    setShowToolbar(true);

    if (!showComplianceInput) {
      setComplianceNote('');
    }
  }, [calculateToolbarPosition, clearSelectionToolbar, isRewriting, showComplianceInput]);

  const queueSelectionSync = useCallback(() => {
    if (selectionRafRef.current !== null) {
      cancelAnimationFrame(selectionRafRef.current);
    }

    selectionRafRef.current = requestAnimationFrame(() => {
      selectionRafRef.current = null;
      syncSelectionToolbar();
    });
  }, [syncSelectionToolbar]);

  // --- Select & Fix: Selection Detection ---
  const handleTextSelection = useCallback(() => {
    queueSelectionSync();
  }, [queueSelectionSync]);

  useEffect(() => {
    document.addEventListener('selectionchange', queueSelectionSync);
    return () => {
      document.removeEventListener('selectionchange', queueSelectionSync);
      if (selectionRafRef.current !== null) {
        cancelAnimationFrame(selectionRafRef.current);
        selectionRafRef.current = null;
      }
    };
  }, [queueSelectionSync]);

  // Click outside to dismiss toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        clearSelectionToolbar();
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
  }, [clearSelectionToolbar, showToolbar]);

  useEffect(() => {
    if (!showToolbar || !selectionRange) return;

    const updatePosition = () => {
      const position = calculateToolbarPosition(selectionRange, showComplianceInput);
      if (position) {
        setToolbarPosition(position);
      }
    };

    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [calculateToolbarPosition, selectionRange, showComplianceInput, showToolbar]);

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
      setToolbarPosition(null);
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
                  <button
                    onClick={() => handleStatusChange(ContentStatus.SUBMITTED)}
                    disabled={!content}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    {status === ContentStatus.CHANGES_REQUESTED ? 'Resubmit for Review' : 'Submit for Review'} <Send size={16} />
                  </button>
                </>
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

                  {/* Save to Client Button */}
                  {!isGenerating && content && (
                    savedClientName ? (
                      <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium rounded-lg flex justify-center items-center gap-2 text-sm">
                        <CheckCircle2 size={16} />
                        Saved to {savedClientName}
                      </div>
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
                        className="w-full py-2.5 bg-white border border-primary-200 text-primary-700 font-medium rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors shadow-sm flex justify-center items-center gap-2"
                      >
                        <UserPlus size={16} /> Save to Client
                      </button>
                    )
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
                  onKeyUp={handleTextSelection}
                  onTouchEnd={handleTextSelection}
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
                            <p className="text-sm font-bold">Generate Header Image</p>
                            <p className="text-[10px] text-primary-500 font-medium">Powered by {imageProviderLabel}</p>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Floating Selection Toolbar */}
                {showToolbar && toolbarPosition && (
                  <div
                    ref={toolbarRef}
                    className="selection-toolbar"
                    style={{ top: toolbarPosition.top, left: Math.max(0, toolbarPosition.left) }}
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName !== 'INPUT') {
                        e.preventDefault();
                      }
                    }}
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
    </div>
  );
};

export default ContentEditor;
