'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { createBrand, updateBrand } from '@/lib/actions/brand';
import { syncDomains } from '@/lib/actions/brand-domain';
import { createTopics } from '@/lib/actions/topic';
import { savePromptSet } from '@/lib/actions/prompt';
import { addCompetitor } from '@/lib/actions/competitor';
import { triggerTrackingCheck } from '@/lib/actions/tracking';
import { usePlanContext } from '@/components/providers/plan-provider';
import { getFaviconUrl } from '@/lib/favicon';
import { useBrandStore } from '@/stores/use-brand-store';
import { REGIONS, LANGUAGES } from '@/config/prompt-options';
import { ALL_MODELS, ALL_SCRAPERS } from '@/config/prompt-options';
import { getPlan, type PlanId } from '@/config/plans';
import type { Brand } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';

const AEO_SERVER_URL = API_BASE_URL;

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i + 1 === current
              ? 'w-6 bg-foreground'
              : i + 1 < current
                ? 'w-1.5 bg-foreground'
                : 'w-1.5 bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

// ── Brand header (Steps 2-5) ───────────────────────────────────────────────────

function BrandHeader({ name, domain }: { name: string; domain: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      {domain && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={getFaviconUrl(domain, 32)} alt="" className="h-6 w-6 rounded" />
      )}
      <span className="text-sm font-medium">{name}</span>
      {domain && <span className="text-sm text-muted-foreground">{domain}</span>}
    </div>
  );
}

// ── Topic Prompt Accordion ─────────────────────────────────────────────────────

interface TopicPromptsData {
  topic: string;
  prompts: string[];
}

function TopicAccordion({
  data,
  defaultOpen = false,
  onRemoveTopic,
  onAddPrompt,
  onRemovePrompt,
}: {
  data: TopicPromptsData;
  defaultOpen?: boolean;
  onRemoveTopic: () => void;
  onAddPrompt: (prompt: string) => void;
  onRemovePrompt: (index: number) => void;
}) {
  const t = useTranslations('onboarding');
  const [open, setOpen] = useState(defaultOpen);
  const [newPrompt, setNewPrompt] = useState('');

  const handleAdd = () => {
    const trimmed = newPrompt.trim();
    if (trimmed.length >= 10) {
      onAddPrompt(trimmed);
      setNewPrompt('');
    }
  };

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-3 py-3 px-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 text-left text-sm"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium">{data.topic}</span>
          <span className="text-xs text-muted-foreground">
            {t('promptCount', { count: data.prompts.length })}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 rounded hover:bg-muted text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemoveTopic}
            >
              {t('removeTopic')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="pl-7 pb-3 space-y-1.5">
          {data.prompts.map((p, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 group rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm flex-1">{p}</span>
              <button
                onClick={() => onRemovePrompt(idx)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder={t('enterNewPrompt')}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="text-sm h-9"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAdd}
              disabled={newPrompt.trim().length < 10}
              className="h-9 px-2"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewPrompt('')} className="h-9 px-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

// ── Main page ──────────────────────────────────────────────────────────────────

export default function NewBrandPage() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const { addBrand, setActiveBrand, updateBrand: updateBrandInStore } = useBrandStore();

  // Same strings as the onboarding wizard — the two flows are twins.
  const topicLoadingMessages = useMemo(() => t.raw('topicLoadingMessages') as string[], [t]);
  const competitorLoadingMessages = useMemo(
    () => t.raw('competitorLoadingMessages') as string[],
    [t],
  );

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [generatingDescription, setGeneratingDescription] = useState(false);

  // Step 2
  const [region, setRegion] = useState('US');
  const [language, setLanguage] = useState('en');

  // Intermediate state
  const [createdBrand, setCreatedBrand] = useState<Brand | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>('starter');

  // Step 3
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [customTopic, setCustomTopic] = useState('');
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicSuggestError, setTopicSuggestError] = useState(false);
  const [topicLoadingMsg, setTopicLoadingMsg] = useState('');
  const topicMsgIdx = useRef(0);

  useEffect(() => {
    if (!loadingTopics) {
      topicMsgIdx.current = 0;
      return;
    }
    setTopicLoadingMsg(topicLoadingMessages[0]);
    topicMsgIdx.current = 0;

    const interval = setInterval(() => {
      topicMsgIdx.current = (topicMsgIdx.current + 1) % topicLoadingMessages.length;
      setTopicLoadingMsg(topicLoadingMessages[topicMsgIdx.current]);
    }, 2500);

    return () => clearInterval(interval);
  }, [loadingTopics, topicLoadingMessages]);

  // Step 4
  const [topicPrompts, setTopicPrompts] = useState<TopicPromptsData[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Step 5
  interface CompetitorItem {
    name: string;
    domain: string;
    selected: boolean;
  }
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<CompetitorItem[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorSuggestError, setCompetitorSuggestError] = useState(false);
  const [competitorName, setCompetitorName] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [savingCompetitors, setSavingCompetitors] = useState(false);
  const [competitorLoadingMsg, setCompetitorLoadingMsg] = useState('');
  const competitorMsgIdx = useRef(0);

  const currentPlan = getPlan(currentPlanId);
  const allowedScraperIds = currentPlan.limits.allowedScrapers;
  const activeScrapers = allowedScraperIds
    ? ALL_SCRAPERS.filter((s) => allowedScraperIds.includes(s.id))
    : ALL_SCRAPERS;
  // From context, not the static plan config: Enterprise orgs can have Claude
  // switched on per customer via plan_overrides, which the layout merges in.
  const { allowedModelIds } = usePlanContext();
  const activeModels = allowedModelIds
    ? ALL_MODELS.filter((m) => allowedModelIds.includes(m.id))
    : ALL_MODELS;

  useEffect(() => {
    if (!loadingCompetitors) {
      competitorMsgIdx.current = 0;
      return;
    }
    setCompetitorLoadingMsg(competitorLoadingMessages[0]);
    competitorMsgIdx.current = 0;

    const interval = setInterval(() => {
      competitorMsgIdx.current = (competitorMsgIdx.current + 1) % competitorLoadingMessages.length;
      setCompetitorLoadingMsg(competitorLoadingMessages[competitorMsgIdx.current]);
    }, 2500);

    return () => clearInterval(interval);
  }, [loadingCompetitors, competitorLoadingMessages]);

  // Auto-fetch competitor suggestions when arriving at step 5 with none loaded
  useEffect(() => {
    if (step === 5 && !loadingCompetitors && suggestedCompetitors.length === 0 && createdBrand) {
      fetchCompetitorSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Load current plan from org on mount
  useEffect(() => {
    async function loadPlan() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (profile?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('plan')
            .eq('id', profile.organization_id)
            .single();
          if (org?.plan) setCurrentPlanId(org.plan as PlanId);
        }
      } catch {
        // Non-critical
      }
    }
    loadPlan();
  }, []);

  const domain = website
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();

  // ── Step 1: draft the description from the brand's own homepage ──
  // Same endpoint and behavior as the onboarding wizard.

  const handleDescribeFromSite = async () => {
    if (!domain) return;
    setGeneratingDescription(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${AEO_SERVER_URL}/api/brands/describe-from-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          website: domain,
          brandName: brandName.trim(),
          language: locale.startsWith('pt') ? 'pt' : 'en',
        }),
      });

      if (!res.ok) throw new Error('describe-from-site failed');
      const data = await res.json();
      if (!data.description) throw new Error('empty description');
      setDescription(data.description);
    } catch (err) {
      console.error('Describe from site error:', err);
      toast.error(t('toasts.describeFailed'));
    } finally {
      setGeneratingDescription(false);
    }
  };

  // ── Step 2 → Step 3 transition: create brand ──

  const handleCreateBrand = async () => {
    setIsLoading(true);
    try {
      const logoUrl = domain ? getFaviconUrl(domain) : undefined;

      // Back → Continue must not create a second brand (#447): once the brand
      // exists, re-submitting this step updates it in place instead.
      if (createdBrand) {
        let brand = await updateBrand(createdBrand.id, {
          name: brandName.trim(),
          logoUrl: logoUrl ?? null,
          description: description.trim() || null,
          region,
          language,
        });

        const previousDomain =
          createdBrand.domains.find((d) => d.isPrimary)?.domain ?? createdBrand.domains[0]?.domain;
        if (domain !== (previousDomain ?? '')) {
          const domains = await syncDomains(
            createdBrand.id,
            domain ? [{ domain, isPrimary: true }] : [],
          );
          brand = { ...brand, domains };
        }

        setCreatedBrand(brand);
        updateBrandInStore(brand.id, brand);
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile?.organization_id) throw new Error('No organization found');

        const brand = await createBrand({
          organizationId: profile.organization_id,
          name: brandName.trim(),
          logoUrl,
          description: description.trim() || undefined,
          region,
          language,
          domains: domain ? [{ domain, isPrimary: true }] : [],
        });

        setCreatedBrand(brand);
        addBrand(brand);
        setActiveBrand(brand.id);
      }

      setStep(3);

      if (suggestedTopics.length === 0) {
        fetchTopicSuggestions();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.createBrandFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Topic suggestion ──

  const fetchTopicSuggestions = async () => {
    setLoadingTopics(true);
    setTopicSuggestError(false);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${AEO_SERVER_URL}/api/topics/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          brandName: brandName.trim(),
          industry: '',
          description: description.trim(),
          website: domain,
          language,
        }),
      });

      if (!res.ok) throw new Error('Failed to suggest topics');
      const data = await res.json();

      const names = (data.topics || []).map((t: { name: string }) => t.name);
      setSuggestedTopics(names);
      setSelectedTopics(new Set(names.slice(0, 7)));
    } catch (err) {
      // Inline banner + Try again instead of a transient toast (#447) — a
      // toast leaves the user stranded on an empty step with no way forward.
      console.error('Topic suggestion error:', err);
      setTopicSuggestError(true);
    } finally {
      setLoadingTopics(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else if (next.size < 10) {
        next.add(topic);
      }
      return next;
    });
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !suggestedTopics.includes(trimmed)) {
      setSuggestedTopics((prev) => [...prev, trimmed]);
      setSelectedTopics((prev) => {
        if (prev.size < 10) {
          const next = new Set(prev);
          next.add(trimmed);
          return next;
        }
        return prev;
      });
      setCustomTopic('');
    }
  };

  // ── Step 3 → Step 4: generate prompts from topics ──

  const handleGeneratePrompts = async () => {
    if (!createdBrand) return;
    setLoadingPrompts(true);
    try {
      const topicNames = Array.from(selectedTopics);
      await createTopics(createdBrand.id, topicNames);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${AEO_SERVER_URL}/api/prompts/from-topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          brandName: brandName.trim(),
          industry: '',
          description: description.trim(),
          topics: topicNames,
          language,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate prompts');
      const data = await res.json();

      setTopicPrompts(
        (data.topicPrompts || []).map((tp: { topic: string; prompts: string[] }) => ({
          topic: tp.topic,
          prompts: tp.prompts,
        })),
      );
      setStep(4);
    } catch (err) {
      console.error('Prompt generation error:', err);
      toast.error(t('toasts.generatePromptsFailed'));
    } finally {
      setLoadingPrompts(false);
    }
  };

  // ── Step 4 → Step 5: save prompts + fetch competitors ──

  const handleSavePromptsAndContinue = async () => {
    if (!createdBrand) return;
    setIsLoading(true);
    try {
      const allPrompts = topicPrompts.flatMap((tp) =>
        tp.prompts.map((text) => ({
          text,
          category: tp.topic,
          platforms: activeScrapers.map((s) => s.id),
          models: activeModels.map((m) => m.id),
          isActive: true,
        })),
      );

      if (allPrompts.length === 0) {
        toast.error(t('toasts.addOnePrompt'));
        setIsLoading(false);
        return;
      }

      await savePromptSet({
        brandId: createdBrand.id,
        name: 'Brand Setup Prompts',
        prompts: allPrompts,
      });

      setStep(5);
      fetchCompetitorSuggestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.savePromptsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Competitor suggestion ──

  const fetchCompetitorSuggestions = async () => {
    setLoadingCompetitors(true);
    setCompetitorSuggestError(false);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${AEO_SERVER_URL}/api/competitors/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          brandName: brandName.trim(),
          industry: '',
          description: description.trim(),
          language,
        }),
      });

      if (!res.ok) throw new Error('Failed to suggest competitors');
      const data = await res.json();

      setSuggestedCompetitors(
        (data.competitors || []).map((c: { name: string; domain: string }) => ({
          name: c.name,
          domain: c.domain,
          selected: true,
        })),
      );
    } catch (err) {
      console.error('Competitor suggestion error:', err);
      setCompetitorSuggestError(true);
    } finally {
      setLoadingCompetitors(false);
    }
  };

  const toggleCompetitor = (index: number) => {
    setSuggestedCompetitors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c)),
    );
  };

  const removeCompetitor = (index: number) => {
    setSuggestedCompetitors((prev) => prev.filter((_, i) => i !== index));
  };

  const addManualCompetitor = () => {
    const name = competitorName.trim();
    const d = competitorDomain
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    if (!name) return;
    setSuggestedCompetitors((prev) => [...prev, { name, domain: d, selected: true }]);
    setCompetitorName('');
    setCompetitorDomain('');
  };

  // ── Step 5: final save ──

  const handleFinish = async () => {
    if (!createdBrand) return;
    setSavingCompetitors(true);
    try {
      const selected = suggestedCompetitors.filter((c) => c.selected);
      if (selected.length > 0) {
        await Promise.all(
          selected.map((c) => addCompetitor(createdBrand.id, { name: c.name, domain: c.domain })),
        );
      }

      try {
        const { jobId } = await triggerTrackingCheck(createdBrand.id);
        localStorage.setItem(
          'aeo:tracking-job',
          JSON.stringify({
            jobId,
            brandId: createdBrand.id,
            startedAt: Date.now(),
          }),
        );
      } catch {
        // Non-critical — scheduled tracking will still run
      }

      toast.success(t('toasts.setupComplete'));
      router.push('/dashboard/insights');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.saveCompetitorsFailed'));
      setSavingCompetitors(false);
    }
  };

  // ── Topic prompt editing helpers ──

  const removeTopic = (index: number) => {
    setTopicPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const addPromptToTopic = (topicIndex: number, prompt: string) => {
    setTopicPrompts((prev) =>
      prev.map((tp, i) => (i === topicIndex ? { ...tp, prompts: [...tp.prompts, prompt] } : tp)),
    );
  };

  const removePromptFromTopic = (topicIndex: number, promptIndex: number) => {
    setTopicPrompts((prev) =>
      prev.map((tp, i) =>
        i === topicIndex
          ? { ...tp, prompts: tp.prompts.filter((_, pi) => pi !== promptIndex) }
          : tp,
      ),
    );
  };

  const totalPrompts = topicPrompts.reduce((sum, tp) => sum + tp.prompts.length, 0);

  // ── Step 1: Brand Info ──

  if (step === 1) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Globe className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('step1.titleNewBrand')}</h1>
            <p className="text-sm text-muted-foreground">{t('step1.subtitle')}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">{t('step1.brandName')}</Label>
              <Input
                id="brandName"
                placeholder={t('step1.brandNamePlaceholder')}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t('step1.website')}</Label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                  https://
                </span>
                <Input
                  id="website"
                  placeholder={t('step1.websitePlaceholder')}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="rounded-l-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t('step1.describeBrand')}{' '}
                <span className="text-muted-foreground">{t('step1.optional')}</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleDescribeFromSite}
                disabled={!website.trim() || generatingDescription}
              >
                {generatingDescription ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('step1.aiFilling')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('step1.aiFill')}
                  </>
                )}
              </Button>
              <Textarea
                id="description"
                placeholder={t('step1.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <ul className="text-xs text-muted-foreground space-y-1 list-disc ml-4">
                <li>{t('step1.tipIndustry')}</li>
                <li>{t('step1.tipAudience')}</li>
              </ul>
            </div>

            <Button
              className="w-full"
              disabled={!brandName.trim() || !website.trim()}
              onClick={() => setStep(2)}
            >
              {t('continue')}
            </Button>
          </div>
        </div>

        <StepDots current={1} total={TOTAL_STEPS} />
      </div>
    );
  }

  // ── Step 2: Region & Language ──

  if (step === 2) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <BrandHeader name={brandName} domain={domain} />

          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('step2.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('step2.subtitle')}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('step2.region')}</Label>
              <Select value={region} onValueChange={(v) => v && setRegion(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('step2.language')}</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleCreateBrand} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('step2.settingUp')}
                </>
              ) : (
                t('continue')
              )}
            </Button>
          </div>
        </div>

        <div className="flex w-full max-w-md items-center justify-between">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </button>
          <StepDots current={2} total={TOTAL_STEPS} />
          <div className="w-12" />
        </div>
      </div>
    );
  }

  // ── Step 3: Topic Selection ──

  if (step === 3) {
    return (
      <div className="flex min-h-svh flex-col p-6 md:p-10">
        <div className="mx-auto w-full max-w-4xl flex-1">
          <BrandHeader name={brandName} domain={domain} />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('topics.title')}</h1>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-muted-foreground">{t('topics.selectUpTo')}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${(selectedTopics.size / 10) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {loadingTopics ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <span key={topicLoadingMsg} className="text-sm animate-in fade-in duration-500">
                    {topicLoadingMsg}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {topicSuggestError && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                      <span>{t('topics.fetchError')}</span>
                      <Button variant="outline" size="sm" onClick={fetchTopicSuggestions}>
                        {t('tryAgain')}
                      </Button>
                    </div>
                  )}
                  {suggestedTopics.map((topic) => {
                    const isSelected = selectedTopics.has(topic);
                    return (
                      <button
                        key={topic}
                        onClick={() => toggleTopic(topic)}
                        className={cn(
                          'flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        {topic}
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder={t('topics.addCustomPlaceholder')}
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addCustomTopic}
                      disabled={!customTopic.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={selectedTopics.size === 0 || loadingPrompts || loadingTopics}
                onClick={handleGeneratePrompts}
              >
                {loadingPrompts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('topics.generating')}
                  </>
                ) : (
                  t('topics.looksGood')
                )}
              </Button>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-xl border bg-card p-5 sticky top-10">
                <h3 className="text-sm font-semibold mb-4">{t('topics.tipsTitle')}</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t('topics.tip1Title')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('topics.tip1Body')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t('topics.tip2Title')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('topics.tip2Body')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t('topics.tip3Title')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('topics.tip3Body')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex mx-auto w-full max-w-4xl items-center justify-between mt-8">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </button>
          <StepDots current={3} total={TOTAL_STEPS} />
          <div className="w-12" />
        </div>
      </div>
    );
  }

  // ── Step 4: Prompt Review ──

  if (step === 4) {
    return (
      <div className="flex min-h-svh flex-col p-6 md:p-10">
        <div className="mx-auto w-full max-w-4xl flex-1">
          <BrandHeader name={brandName} domain={domain} />

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('promptsReview.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('promptsReview.subtitle')}</p>
            </div>
            <Button
              onClick={handleSavePromptsAndContinue}
              disabled={isLoading || totalPrompts === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('promptsReview.saving')}
                </>
              ) : (
                t('continue')
              )}
            </Button>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium">{t('promptsReview.listTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('promptsReview.totalCount', { count: totalPrompts })}
            </p>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center gap-4 px-4 py-2.5 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <span className="flex-1">{t('promptsReview.tableTopic')}</span>
            </div>
            {topicPrompts.map((tp, idx) => (
              <TopicAccordion
                key={`${tp.topic}-${idx}`}
                data={tp}
                defaultOpen={idx === 0}
                onRemoveTopic={() => removeTopic(idx)}
                onAddPrompt={(p) => addPromptToTopic(idx, p)}
                onRemovePrompt={(pi) => removePromptFromTopic(idx, pi)}
              />
            ))}
            {topicPrompts.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('promptsReview.empty')}
              </div>
            )}
          </div>
        </div>

        <div className="flex mx-auto w-full max-w-4xl items-center justify-between mt-8">
          <button
            onClick={() => setStep(3)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </button>
          <StepDots current={4} total={TOTAL_STEPS} />
          <div className="w-12" />
        </div>
      </div>
    );
  }

  // ── Step 5: Competitors ──

  if (step === 5) {
    const selectedCompetitorCount = suggestedCompetitors.filter((c) => c.selected).length;

    return (
      <div className="flex min-h-svh flex-col p-6 md:p-10">
        <div className="mx-auto w-full max-w-lg flex-1">
          <BrandHeader name={brandName} domain={domain} />

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t('competitors.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('competitors.subtitle')}</p>
          </div>

          {loadingCompetitors ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span key={competitorLoadingMsg} className="text-sm animate-in fade-in duration-500">
                {competitorLoadingMsg}
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {competitorSuggestError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                  <span>{t('competitors.fetchError')}</span>
                  <Button variant="outline" size="sm" onClick={fetchCompetitorSuggestions}>
                    {t('tryAgain')}
                  </Button>
                </div>
              )}
              {suggestedCompetitors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('competitors.suggested')}
                  </p>
                  {suggestedCompetitors.map((c, idx) => (
                    <div
                      key={`${c.domain}-${idx}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                        c.selected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:bg-muted/50',
                      )}
                      onClick={() => toggleCompetitor(idx)}
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          c.selected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {c.selected && <Check className="h-3 w-3" />}
                      </div>
                      {c.domain && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getFaviconUrl(c.domain)}
                          alt=""
                          className="h-5 w-5 rounded-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.domain && (
                          <p className="text-xs text-muted-foreground truncate">{c.domain}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCompetitor(idx);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('competitors.addManually')}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('competitors.companyName')}
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder={t('competitors.domainPlaceholder')}
                    value={competitorDomain}
                    onChange={(e) => setCompetitorDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManualCompetitor()}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addManualCompetitor}
                    disabled={!competitorName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button className="w-full" onClick={handleFinish} disabled={savingCompetitors}>
                {savingCompetitors ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('competitors.finishing')}
                  </>
                ) : selectedCompetitorCount > 0 ? (
                  t('competitors.startTracking', { count: selectedCompetitorCount })
                ) : (
                  t('competitors.skipStart')
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex mx-auto w-full max-w-lg items-center justify-between mt-8">
          <button
            onClick={() => setStep(4)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </button>
          <StepDots current={5} total={TOTAL_STEPS} />
          <div className="w-12" />
        </div>
      </div>
    );
  }

  return null;
}
