import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, TrendingUp, DollarSign, Heart, Briefcase, Zap, Shield, Landmark, Building2, Flame, Leaf, Atom, PiggyBank, Users, BookOpen, Scale, Sparkles, Loader2, CheckCircle2, Brain, ShieldCheck, Lightbulb, ListChecks, FileCheck } from 'lucide-react';
import { triggerTopicGeneration } from '../services/supabaseClient';

// Generation progress steps
const TOPIC_GEN_STEPS = [
  { id: 0, label: 'Connecting to AI Engine', icon: Zap, duration: 2000 },
  { id: 1, label: 'Reviewing Compliance Guidelines', icon: ShieldCheck, duration: 3000 },
  { id: 2, label: 'Brainstorming Topic Ideas', icon: Lightbulb, duration: 5000 },
  { id: 3, label: 'Curating & Categorizing', icon: ListChecks, duration: 4000 },
  { id: 4, label: 'Finalizing Topics', icon: FileCheck, duration: 3000 },
];

// Color config per category
const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string; border: string; dot: string; hover: string }> = {
  'All': { bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400', hover: 'hover:border-slate-300' },
  'Market Updates': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', hover: 'hover:border-blue-300' },
  'Personal Finance': { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', hover: 'hover:border-emerald-300' },
  'Alternative Investments': { bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', hover: 'hover:border-violet-300' },
  'Tax Strategy': { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', hover: 'hover:border-amber-300' },
  'Estate Planning': { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', hover: 'hover:border-rose-300' },
  'Financial Planning': { bg: 'bg-cyan-50', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', hover: 'hover:border-cyan-300' },
  'Energy Investments': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', hover: 'hover:border-orange-300' },
  'About Legacy': { bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', hover: 'hover:border-indigo-300' },
  'Lifestyle': { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500', hover: 'hover:border-pink-300' },
};

const getColors = (category: string) => CATEGORY_COLORS[category] || CATEGORY_COLORS['All'];

// Map category names to icons
const CATEGORY_ICONS: Record<string, any> = {
  'Market Updates': TrendingUp,
  'Personal Finance': DollarSign,
  'Alternative Investments': Zap,
  'Tax Strategy': DollarSign,
  'Estate Planning': Briefcase,
  'Financial Planning': Heart,
  'Energy Investments': Flame,
  'About Legacy': Landmark,
  'Lifestyle': Heart,
};

interface TopicItem {
  id: string;
  category: string;
  topic: string;
  icon: any;
  aiGenerated?: boolean;
  audience?: string;
}

const TopicSelector: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [genStep, setGenStep] = useState(0);
  const genStepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cycle through generation steps while generating topics
  useEffect(() => {
    if (isGeneratingTopics) {
      setGenStep(0);
      let currentStep = 0;

      const advanceStep = () => {
        if (currentStep < TOPIC_GEN_STEPS.length - 1) {
          currentStep++;
          setGenStep(currentStep);
          genStepTimerRef.current = setTimeout(advanceStep, TOPIC_GEN_STEPS[currentStep].duration);
        }
      };

      genStepTimerRef.current = setTimeout(advanceStep, TOPIC_GEN_STEPS[0].duration);

      return () => {
        if (genStepTimerRef.current) clearTimeout(genStepTimerRef.current);
      };
    }
  }, [isGeneratingTopics]);

  // Pre-approved compliance topics
  const [topics, setTopics] = useState<TopicItem[]>([
    // --- Original Topics ---
    { id: '1', category: 'Market Updates', topic: 'How rising rates impact bond portfolios', icon: TrendingUp },
    { id: '2', category: 'Personal Finance', topic: 'The 4% rule in a high-yield environment', icon: DollarSign },
    { id: '3', category: 'Lifestyle', topic: 'Balancing wealth and health after 50', icon: Heart },
    { id: '4', category: 'Market Updates', topic: 'AI regulation and what it means for investors', icon: TrendingUp },
    { id: '5', category: 'Estate Planning', topic: 'Revocable vs Irrevocable trusts explained', icon: Briefcase },

    // --- Blog Topics ---
    { id: '6', category: 'Tax Strategy', topic: 'Investments as Tax Deductions', icon: DollarSign },
    { id: '7', category: 'Market Updates', topic: 'Creating wealth that lasts in volatile markets', icon: TrendingUp },
    { id: '8', category: 'Financial Planning', topic: 'Charitable Giving in Financial Planning', icon: Heart },
    { id: '9', category: 'Estate Planning', topic: 'Creating an intergenerational wealth plan', icon: Briefcase },
    { id: '10', category: 'Financial Planning', topic: 'Types of insurance you should have as part of your financial plan', icon: Shield },
    { id: '11', category: 'Alternative Investments', topic: 'How do we create structured notes that perform well during volatile markets?', icon: Zap },
    { id: '12', category: 'Alternative Investments', topic: 'Investing in real estate through alternative investments', icon: Building2 },
    { id: '13', category: 'Alternative Investments', topic: 'How does Legacy find and vet alternative investments for their clients?', icon: Zap },
    { id: '14', category: 'Market Updates', topic: 'Getting off the stock market rollercoaster', icon: TrendingUp },
    { id: '15', category: 'Personal Finance', topic: 'Understanding your risk tolerance level', icon: Scale },
    { id: '16', category: 'Tax Strategy', topic: 'Minimizing your tax burden through investments', icon: DollarSign },
    { id: '17', category: 'Personal Finance', topic: 'IRA 101 (Roth, Traditional, and Backdoor)', icon: PiggyBank },
    { id: '18', category: 'About Legacy', topic: 'Why Legacy?', icon: Landmark },
    { id: '19', category: 'Financial Planning', topic: 'The benefits of charitable giving in the financial sector', icon: Heart },
    { id: '20', category: 'Personal Finance', topic: 'Small business owner financial check-up', icon: BookOpen },
    { id: '21', category: 'Personal Finance', topic: 'Where is the best place to start in investing and financial planning?', icon: PiggyBank },
    { id: '22', category: 'Tax Strategy', topic: 'Setting up a proactive tax strategy', icon: DollarSign },
    { id: '23', category: 'Market Updates', topic: 'What is downside protection and how does it help to reduce losses?', icon: Shield },
    { id: '24', category: 'Personal Finance', topic: 'Where to find the right financial advice for you', icon: Users },
    { id: '25', category: 'Alternative Investments', topic: 'Different types of structured notes', icon: Zap },
    { id: '26', category: 'Estate Planning', topic: 'Protecting your future for the ones that matter most', icon: Briefcase },
    { id: '27', category: 'Market Updates', topic: 'Making a personalized stock market plan (active vs passive management, fees, plans)', icon: TrendingUp },
    { id: '28', category: 'Personal Finance', topic: 'Building the right financial team', icon: Users },
    { id: '29', category: 'Alternative Investments', topic: 'What is a private equity investment and why is it a good way to diversify your portfolio?', icon: Zap },
    { id: '30', category: 'Tax Strategy', topic: 'Decreasing your tax burden in one year', icon: DollarSign },
    { id: '31', category: 'Alternative Investments', topic: 'Institutionalization of Single Family Homes', icon: Building2 },
    { id: '32', category: 'About Legacy', topic: 'What to expect when you become a client of LWM - new client experience', icon: Landmark },
    { id: '33', category: 'Alternative Investments', topic: 'How to create a more-defined outcome through structured notes', icon: Zap },
    { id: '34', category: 'Market Updates', topic: 'Why should you be thinking outside the market when you make your financial plan?', icon: TrendingUp },
    { id: '35', category: 'Personal Finance', topic: 'Best savings strategies for retirement planning', icon: PiggyBank },
    { id: '36', category: 'Financial Planning', topic: 'Premium Finance', icon: DollarSign },
    { id: '37', category: 'Personal Finance', topic: 'Small business retirement plans', icon: PiggyBank },

    // --- Advisors (Alternative Investing Focused) ---
    { id: '38', category: 'Alternative Investments', topic: 'What Are Alternatives? A Simple Guide for High-Net-Worth Investors', icon: Zap },
    { id: '39', category: 'Alternative Investments', topic: "Why Alternatives Belong in Every Serious Investor's Portfolio", icon: Zap },
    { id: '40', category: 'Alternative Investments', topic: 'The Endowment Model Explained: How Yale Changed Investing Forever', icon: Landmark },
    { id: '41', category: 'Alternative Investments', topic: "Alternatives vs. Traditional Portfolios: What's the Real Difference?", icon: Scale },
    { id: '42', category: 'Alternative Investments', topic: 'How Much Should You Allocate to Alternatives?', icon: Zap },

    // --- Energy Investments ---
    { id: '43', category: 'Energy Investments', topic: "The Future of Energy: Why It's More Than Just Oil and Gas", icon: Flame },
    { id: '44', category: 'Energy Investments', topic: 'Investing in Oil & Gas: Risks, Rewards, and Tax Benefits', icon: Flame },
    { id: '45', category: 'Energy Investments', topic: 'Renewable Energy: Solar, Wind, and the Investment Opportunity Ahead', icon: Leaf },
    { id: '46', category: 'Energy Investments', topic: 'The Rise of Nuclear: Safe, Scalable, and Investable?', icon: Atom },
    { id: '47', category: 'Energy Investments', topic: 'Energy Infrastructure Funds: Pipelines, Storage, and Beyond', icon: Building2 },
  ]);

  // Derive unique categories with counts
  const categoryList = ['All', ...Array.from(new Set(topics.map(t => t.category)))];
  const categoryCounts: Record<string, number> = { All: topics.length };
  topics.forEach(t => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1; });

  // Filter by active tab + search
  const filteredTopics = topics.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch = searchTerm === '' ||
      t.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // AI topic generation
  const handleGenerateTopics = async () => {
    setIsGeneratingTopics(true);
    setGenStep(0);
    setGenerateError(null);
    try {
      const existingTopicStrings = topics.map(t => t.topic);
      const result = await triggerTopicGeneration(existingTopicStrings);

      // Mark all steps as complete
      setGenStep(TOPIC_GEN_STEPS.length);
      await new Promise(resolve => setTimeout(resolve, 800));

      if (result.topics && Array.isArray(result.topics)) {
        const nextId = topics.length + 1;
        const newTopics: TopicItem[] = result.topics.map((t: any, i: number) => ({
          id: String(nextId + i),
          category: t.category || 'Personal Finance',
          topic: t.topic,
          icon: CATEGORY_ICONS[t.category] || DollarSign,
          aiGenerated: true,
          audience: t.audience,
        }));
        setTopics(prev => [...prev, ...newTopics]);
      }
    } catch (err: any) {
      console.error(err);
      setGenerateError(err.message || 'Failed to generate topics.');
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Topic Library</h2>
          <p className="text-slate-500 mt-1">Select a pre-approved compliance topic to start generating content.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateTopics}
            disabled={isGeneratingTopics}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 whitespace-nowrap"
          >
            {isGeneratingTopics ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate More Topics
              </>
            )}
          </button>
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search topics by keyword..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{generateError}</span>
          <button onClick={() => setGenerateError(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categoryList.map((cat) => {
          const colors = getColors(cat);
          const isActive = activeCategory === cat;
          const count = categoryCounts[cat] || 0;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${isActive
                ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? colors.dot : 'bg-slate-300'}`} />
              {cat}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? `${colors.badge}` : 'bg-slate-100 text-slate-400'
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Generation Progress Feed */}
      {isGeneratingTopics && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Brain size={22} className="text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-display font-bold text-sm">AI Topic Generator</h3>
              <p className="text-violet-200 text-xs">Generating compliance-approved topics...</p>
            </div>
            <div className="ml-auto flex gap-1">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>

          {/* Progress Bar */}
          {(() => {
            const allDone = genStep >= TOPIC_GEN_STEPS.length;
            const progressPercent = allDone ? 100 : Math.round((genStep / TOPIC_GEN_STEPS.length) * 100);
            return (
              <div className="px-6 pt-5">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">{allDone ? '✅ Complete!' : `Step ${genStep + 1} of ${TOPIC_GEN_STEPS.length}`}</span>
                  <span className={`text-xs font-semibold ${allDone ? 'text-emerald-500' : 'text-violet-600'}`}>{progressPercent}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${allDone ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Step List */}
          <div className="px-6 py-5 space-y-2.5">
            {TOPIC_GEN_STEPS.map((step) => {
              const StepIcon = step.icon;
              const isComplete = genStep > step.id;
              const isActive = genStep === step.id;
              const allDone = genStep >= TOPIC_GEN_STEPS.length;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${allDone
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : isActive
                        ? 'bg-violet-50/60 border-violet-200 shadow-sm'
                        : isComplete
                          ? 'bg-emerald-50/40 border-emerald-100'
                          : 'bg-slate-50/50 border-slate-100 opacity-50'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500 ${(allDone || isComplete)
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-400'
                    }`}>
                    {(allDone || isComplete) ? (
                      <CheckCircle2 size={16} />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <StepIcon size={16} />
                    )}
                  </div>
                  <p className={`text-sm font-medium flex-1 transition-colors duration-500 ${(allDone || isComplete)
                      ? 'text-emerald-700'
                      : isActive
                        ? 'text-violet-900'
                        : 'text-slate-400'
                    }`}>
                    {step.label}
                  </p>
                  {isActive && !allDone && (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Topic Count */}
      <p className="text-xs text-slate-400 font-medium">
        Showing {filteredTopics.length} of {topics.length} topics
      </p>

      {/* Topic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTopics.map((t) => {
          const Icon = t.icon;
          const colors = getColors(t.category);
          return (
            <div
              key={t.id}
              onClick={() => navigate(`/create?topicId=${t.id}&topic=${encodeURIComponent(t.topic)}`)}
              className={`group bg-white rounded-xl p-6 border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden ${colors.border} ${colors.hover}`}
            >
              {/* Color accent bar on left */}
              <div className={`absolute top-0 left-0 w-1 h-full ${colors.dot} opacity-40 group-hover:opacity-100 transition-opacity`}></div>

              {/* AI Generated badge */}
              {t.aiGenerated && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 text-[10px] font-semibold">
                    <Sparkles size={10} /> AI Generated
                  </span>
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg transition-colors ${colors.bg}`}>
                  <Icon size={20} className={`${colors.text} transition-colors`} />
                </div>
                {!t.aiGenerated && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${colors.badge}`}>
                    {t.category}
                  </span>
                )}
                {t.aiGenerated && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium mt-4 ${colors.badge}`}>
                    {t.category}
                  </span>
                )}
              </div>

              <h3 className="font-display font-semibold text-base text-slate-900 leading-snug mb-3 group-hover:text-primary-700 transition-colors">
                {t.topic}
              </h3>

              {/* Audience tag for AI-generated topics */}
              {t.audience && (
                <p className="text-[11px] text-slate-400 font-medium mb-2">
                  Audience: {t.audience}
                </p>
              )}

              <div className="flex items-center text-sm font-medium text-slate-400 group-hover:text-primary-600 transition-colors mt-auto">
                Start Draft <ChevronRight size={16} className="ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTopics.length === 0 && (
        <div className="text-center py-16">
          <Search size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No topics match your search.</p>
          <p className="text-sm text-slate-400 mt-1">Try a different keyword or category.</p>
        </div>
      )}
    </div>
  );
};

export default TopicSelector;