import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PenLine, Sparkles, ChevronRight, ChevronDown, Search, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Idea = {
  id: string;
  topic: string;
  caption?: string;
  hashtags?: string;
  platform: string;
  status: 'pending' | 'approved';
  date: string;
  createdAt: string;
};

const INITIAL_MOCK_IDEAS: Idea[] = [
  {
    id: '1',
    topic: 'The "Silent Layoffs" Survival Guide',
    caption: 'The tech landscape is shifting faster than ever, and "silent layoffs" are forcing professionals into unexpected job hunts. If you haven\'t updated your resume since your last job, don\'t just guess what recruiters want. Run it through RiResume\'s 8-Token ATS Diagnostic to instantly see your Strong, Partial, and Missing skills against today\'s live job listings.',
    hashtags: '#TechCareers #JobMarket2026 #ResumeTips #RiResume',
    platform: 'LinkedIn',
    status: 'pending',
    date: 'Today, 2:00 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '2',
    topic: 'Don\'t Fake It. Learn It. (Ethical Upskilling)',
    caption: 'We see candidates blindly stuffing keywords onto their resumes just to pass the AI filters—only to fail the technical interview. RiResume is different. When you\'re missing a required skill, our AI Ethical Upskilling Engine gives you a custom learning roadmap to legitimately acquire that skill before you add it to your resume. Fill the gap, don\'t fake it.',
    hashtags: '#Upskilling #CareerGrowth #HonestHiring #RiResume',
    platform: 'Instagram & Threads',
    status: 'pending',
    date: 'Today, 4:00 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '3',
    topic: 'The 15-Token Cover Letter Hack',
    caption: 'If you are using the exact same generic cover letter for 50 applications, you are wasting your time. Just paste the job URL into RiResume and instantly generate a highly-detailed, human-sounding cover letter mapped perfectly to the intersection of your experience and the job\'s demands. It takes 15 tokens and 5 seconds. Why do it manually?',
    hashtags: '#CoverLetterHack #JobSearchHacks #CareerTok #RiResume',
    platform: 'TikTok & Shorts',
    status: 'approved',
    date: 'Tomorrow, 9:00 AM',
    createdAt: '2026-04-01',
  },
  {
    id: '4',
    topic: 'The Native Share-Sheet Advantage',
    caption: 'Found the perfect job on Indeed or LinkedIn mobile? Stop awkwardly copying links into notes. Just hit the "Share" button directly on your phone and send it straight to the RiResume app. We automatically parse the role and cross-reference your resume instantly. Job hunting shouldn\'t require 15 browser tabs open.',
    hashtags: '#ProductivityHack #JobSeeker #TechTools #RiResume',
    platform: 'X (Twitter)',
    status: 'pending',
    date: 'Tomorrow, 1:00 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '5',
    topic: 'Why an 80% Match Gets Rejected (ATS)',
    caption: '"I matched 80% of their requirements, why didn\'t they call me?" Because you failed the ATS filter on the 20% that actually mattered. Our deep analysis matrix breaks down exactly which keywords are dealbreakers so your resume is never pushed to the bottom of the pile again.',
    hashtags: '#RecruitingSecrets #ATSChecker #ResumeOptimization #RiResume',
    platform: 'LinkedIn',
    status: 'approved',
    date: 'Tomorrow, 3:30 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '6',
    topic: 'Beat the "STAR" Method Gridlock',
    caption: 'Your resume worked. You got the interview. Now what? For 40 tokens, the RiResume AI analyzes the target job description and predicts the exact behavioral questions they will ask you—then structures your unique career history into winning STAR-method answers. Walk in with absolute confidence.',
    hashtags: '#InterviewPrep #CareerCoach #STARMethod #RiResume',
    platform: 'Threads',
    status: 'pending',
    date: 'Friday, 10:00 AM',
    createdAt: '2026-04-01',
  },
  {
    id: '7',
    topic: 'Stop Paying Resume Writers $500',
    caption: 'Why are you paying a "resume expert" $500 for a generic PDF template? For $4.99, you get 100 RiResume tokens. That is mathematically enough to run a deep ATS Analysis, completely optimize your formatting, and generate a hyper-specific Cover Letter for your dream job. Don\'t pay subscriptions. Pay for precision.',
    hashtags: '#PersonalFinance #JobHunt2026 #ResumeBuilder #RiResume',
    platform: 'Facebook & BlueSky',
    status: 'pending',
    date: 'Friday, 1:00 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '8',
    topic: 'The "One-Click Apply" Myth',
    caption: 'Using "Easy Apply" on a hundred jobs a day is how your resume ends up in a black hole. Quality > Volume. Take the extra 15 tokens to optimize your resume specifically for the URL of your dream job. A tailored 95% match beats 100 generic 60% applications every single time.',
    hashtags: '#TechJobs #JobHunting #HireMe #RiResume',
    platform: 'X (Twitter)',
    status: 'pending',
    date: 'Saturday, 9:00 AM',
    createdAt: '2026-04-01',
  },
  {
    id: '9',
    topic: 'Finding Your Next Pivot (Career Roadmap)',
    caption: 'Feeling stuck in your current role? Upload your resume to RiResume and check the Free Career Roadmap feature. The AI analyzes your latent skills and suggests adjacent, high-paying career pathways you might not have even considered. Turn your past experience into your next big pivot.',
    hashtags: '#CareerPivot #FutureOfWork #CareerGrowth #RiResume',
    platform: 'LinkedIn',
    status: 'approved',
    date: 'Saturday, 2:00 PM',
    createdAt: '2026-04-01',
  },
  {
    id: '10',
    topic: 'Claim Your 110 Free Tokens',
    caption: 'We want your next application to be flawless. New users get 110 free tokens upon signing up for RiResume. That gives you exactly enough power to run our ATS Diagnostic, fully optimize your resume, generate a targeted cover letter, and get an interview prep guide completely free. Go land that job.',
    hashtags: '#FreeTrial #TechCareers #InterviewReady #RiResume',
    platform: 'All Platforms',
    status: 'pending',
    date: 'Sunday, 11:00 AM',
    createdAt: '2026-04-01',
  }
];

export default function Dashboard() {
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = localStorage.getItem('riresume_ideas_v4');
    if (saved) return JSON.parse(saved);
    return INITIAL_MOCK_IDEAS;
  });
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
    '2026-04-01': true,
  });

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem('riresume_ideas_v4', JSON.stringify(ideas));
  }, [ideas]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // Dynamically resolve URL based on if we are running in 'npm run dev' or Production
      const baseUrl = import.meta.env.PROD 
        ? 'https://us-central1-ats-resume-optimizer-8652d.cloudfunctions.net' 
        : `http://${window.location.hostname}:5001/ats-resume-optimizer-8652d/us-central1`;
        
      const response = await fetch(`${baseUrl}/generateMarketingIdeas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customTopic })
      });

      if (!response.ok) throw new Error("Failed to reach backend.");
      const result = await response.json();

      if (result.success && result.ideas) {
        const todayString = new Date().toISOString().split('T')[0];
        
        // Map the array returned from OpenRouter into UI formatting
        const formattedIdeas = result.ideas.map((idea: any) => ({
          ...idea,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: todayString,
        }));

        setIdeas(prev => [...formattedIdeas, ...prev]);
        setCustomTopic('');
        
        // Auto-expand the "Today" group
        setExpandedDates(prev => ({ ...prev, [todayString]: true }));
      } else {
         console.error("Malformed response", result);
         alert("Connected to backend, but received malformed JSON. Did the AI format correctly?");
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      alert("Failed to connect! Ensure 'npm run serve' is actively running in your functions folder.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleGroup = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const handleDeleteIdea = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if(window.confirm("Are you sure you want to permanently delete this generated idea?")) {
      setIdeas(prev => prev.filter(idea => idea.id !== id));
    }
  };

  const groupedIdeas = useMemo(() => {
    const groups: Record<string, Idea[]> = {};
    ideas.forEach(idea => {
      if (!groups[idea.createdAt]) groups[idea.createdAt] = [];
      groups[idea.createdAt].push(idea);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [ideas]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Daily Marketing Ideas</h1>
        <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
          Your AI agent curates fresh topics based on today's industry trends.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-end gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-16 bg-indigo-100/50 dark:bg-indigo-900/10 rounded-bl-full opacity-50 blur-3xl pointer-events-none transition-all"></div>
        <div className="flex-1 w-full relative z-10">
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">
            Target a specific topic (Optional)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
            <input 
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g., 'How to pass ATS easily'" 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-200" 
            />
          </div>
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 disabled:hover:bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition-all font-medium flex items-center justify-center gap-2 relative z-10"
        >
          {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          {isGenerating ? 'Analyzing Trends...' : 'Generate 10 Fresh Ideas'}
        </button>
      </div>

      <div className="space-y-6">
        {groupedIdeas.length === 0 && (
           <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
             <Sparkles className="h-8 w-8 mx-auto mb-4 opacity-50" />
             No marketing ideas currently saved. Generate some to get started!
           </div>
        )}

        {groupedIdeas.map(([dateString, groupIdeas]) => {
          const isExpanded = expandedDates[dateString] ?? true;
          const formattedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(dateString));

          return (
            <div key={dateString} className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
              <button 
                onClick={() => toggleGroup(dateString)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{formattedDate}</h2>
                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">
                    {groupIdeas.length} {groupIdeas.length === 1 ? 'Idea' : 'Ideas'}
                  </span>
                </div>
                <div className="text-slate-400">
                  <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6 pt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {groupIdeas.map((idea, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={idea.id}
                        >
                          <Link
                            to={`/approve/${idea.id}`}
                            className="group block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 relative"
                          >
                            <button 
                               onClick={(e) => handleDeleteIdea(idea.id, e)}
                               className="absolute top-4 right-4 p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all z-10"
                               title="Permanently Delete Idea"
                            >
                               <Trash2 className="h-4 w-4" />
                            </button>

                            <div className="p-5">
                              <div className="flex items-center justify-between mb-4 pr-10">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  idea.status === 'pending' 
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' 
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                                }`}>
                                  {idea.status === 'pending' ? 'Requires Approval' : 'Scheduled'}
                                </span>
                                <div className="flex items-center text-slate-400 dark:text-slate-500 gap-1 text-sm">
                                  <Calendar className="h-4 w-4" />
                                  <span>{idea.date}</span>
                                </div>
                              </div>
                              
                              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {idea.topic}
                              </h3>
                              
                              <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 gap-2 mb-6">
                                <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                                <span>AI Suggested for {idea.platform}</span>
                              </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/50 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              <span className="flex items-center gap-1.5"><PenLine className="h-4 w-4" /> Review & Edit</span>
                              <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
