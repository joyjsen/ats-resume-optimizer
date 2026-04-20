import { BookOpen, Target, ShieldCheck, Search, PenTool, LayoutTemplate, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BrandPlaybook() {
  const features = [
    {
      title: 'Frictionless Job Matching',
      icon: <Search className="w-6 h-6 text-blue-500 dark:text-blue-400" />,
      desc: 'Analyze resumes against any job URL on LinkedIn/Indeed. Share directly from native app without copying/pasting. Upload text or image.',
    },
    {
      title: 'Precision ATS Diagnostics',
      icon: <Target className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />,
      desc: '8 Token Analysis: Gets ATS score, skills breakdown matrix (strong, partial, missing skills).',
    },
    {
      title: 'Ethical Upskilling Engine',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />,
      desc: 'Provides an AI-powered learning skeleton guideline to get equipped with the missing skill BEFORE adding to resume (Ethical Angle). Free career roadmap included.',
    },
    {
      title: 'One-Click Optimization',
      icon: <PenTool className="w-6 h-6 text-orange-500 dark:text-orange-400" />,
      desc: '15 Token Rewrite: Optimizes resume to satisfy ruthless ATS systems. Users save and download only if satisfied.',
    },
    {
      title: 'Tailored Cover Letters',
      icon: <LayoutTemplate className="w-6 h-6 text-pink-500 dark:text-pink-400" />,
      desc: '15 Token Generation: Highly detailed cover letters based specifically on the target URL requirements.',
    },
    {
      title: 'STAR-Method Prep',
      icon: <MessageSquare className="w-6 h-6 text-purple-500 dark:text-purple-400" />,
      desc: '40 Token Prep Guide: Detailed interview behavioral guide based on the STAR method mapped to the job description.',
    }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Brand Playbook</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Core features and marketing positioning for the RiResume marketing engine.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Core Positioning Angle</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed border-l-4 border-indigo-500 pl-4 bg-slate-50 dark:bg-slate-950/50 py-3 pr-4 rounded-r-lg">
          Most AI resume builders just tell job seekers to lie by stuffing their resume with keywords. 
          <strong className="text-slate-900 dark:text-slate-100"> RiResume is different.</strong> When missing a skill, we generate a custom AI learning roadmap to help you ethically acquire that skill before adding it to your resume. 
          <br/><br/>
          <em className="text-slate-500 dark:text-slate-400">"Don't just fake the keywords. Fill the gaps, beat the ATS, and walk into the interview actually prepared."</em>
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Application Features (Marketing Targets)</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="bg-slate-50 dark:bg-slate-950/50 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                {feat.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{feat.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 dark:from-slate-950 dark:to-indigo-950 rounded-2xl shadow-lg border border-slate-800 dark:border-slate-700 p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 dark:bg-black/20"></div>
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 flex items-center gap-2">
            💰 Transparent Pay-As-You-Go Pricing
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 dark:bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-emerald-400 dark:text-emerald-300 font-bold mb-1">110 Free Tokens</div>
              <div className="text-sm text-slate-200 dark:text-slate-300">New User Trial (Enough for 1 full job cycle)</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-white font-bold mb-1">100 Tokens</div>
              <div className="text-sm text-slate-200 dark:text-slate-300">$4.99 (Quick adjusts)</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-white font-bold mb-1">250 Tokens</div>
              <div className="text-sm text-slate-200 dark:text-slate-300">$9.99 (Job Hunter)</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 border border-indigo-400/30 p-4 rounded-xl backdrop-blur-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <div className="text-amber-400 dark:text-amber-300 font-bold mb-1">500 Tokens</div>
              <div className="text-sm text-amber-100/90 dark:text-amber-100/70">$14.99 (Best Value)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
