import { useEffect, useState } from 'react';
import { db } from '../lib/firebaseConfig';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { Calendar as CalendarIcon, CheckCircle2, AlertCircle, Clock, Link as LinkIcon } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

type MarketingPost = {
  id: string;
  topic?: string;
  caption: string;
  hashtags: string;
  platforms: string[];
  scheduleDate: string;
  status: 'scheduled' | 'failed' | 'partial_failure';
  results?: any[];
  mediaUrls?: string[];
  createdAt: any;
};

export default function CalendarView() {
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const q = query(collection(db, 'marketing_posts'), orderBy('scheduleDate', 'desc'), limit(100));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MarketingPost[];
        setPosts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <CalendarIcon className="h-8 w-8 text-indigo-500" /> Content Schedule
        </h1>
        <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
          Monitor your upcoming and past marketing queue pushed to Blotato.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading Calendar...</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No scheduled posts found. Start generating ideas!</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {posts.map(post => {
              const dDate = new Date(post.scheduleDate);
              const formattedDate = !isNaN(dDate.getTime()) ? format(dDate, 'MMM do, yyyy • h:mm a') : 'Invalid Date';
              
              const isFailed = post.status === 'failed' || post.status === 'partial_failure';
              
              return (
                <div key={post.id} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    
                    {/* Timestamp & Status Pillar */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                       <span className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                         <Clock className="h-4 w-4 text-slate-400" /> {formattedDate}
                       </span>
                       
                       <div className={clsx(
                         "inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                         post.status === 'scheduled' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                       )}>
                         {post.status === 'scheduled' ? <CheckCircle2 className="h-3.5 w-3.5"/> : <AlertCircle className="h-3.5 w-3.5"/>}
                         {post.status.replace('_', ' ')}
                       </div>
                       
                       <div className="flex flex-wrap gap-1 mt-2">
                         {post.platforms.map(p => (
                            <span key={p} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {p}
                            </span>
                         ))}
                       </div>
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 min-w-0">
                       <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                          {post.caption}
                       </div>
                       {post.hashtags && (
                          <div className="mt-3 text-indigo-600 dark:text-indigo-400 text-sm font-mono truncate">
                             {post.hashtags}
                          </div>
                       )}

                       {post.mediaUrls && post.mediaUrls.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {post.mediaUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg transition-colors overflow-hidden max-w-[200px]">
                                <LinkIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{url.split('?')[0].split('/').pop()}</span>
                              </a>
                            ))}
                          </div>
                       )}

                       {/* Error Panel */}
                       {isFailed && post.results && (
                          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl">
                            <h4 className="text-sm font-bold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" /> Blotato Integration Errors
                            </h4>
                            <div className="space-y-2">
                              {post.results.filter((r: any) => !r.success).map((r: any, i: number) => (
                                <div key={i} className="text-xs text-red-700 dark:text-red-300 font-mono bg-red-100/50 dark:bg-red-950 px-2 py-1.5 rounded">
                                  <strong>{r.platform}:</strong> {JSON.stringify(r.error)}
                                </div>
                              ))}
                            </div>
                          </div>
                       )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
