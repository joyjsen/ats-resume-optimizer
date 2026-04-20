import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Send, Image as ImageIcon, Calendar as CalendarIcon, Check, Plus, Trash2, Loader2, Wand2, Type, FileText, Camera, PenLine, Sparkles, UploadCloud } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import clsx from 'clsx';
import { format } from 'date-fns';
import { storage } from '../lib/firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type FormValues = {
  caption: string;
  hashtags: string;
  urls: { value: string }[];
  platforms: string[];
  scheduleDate: string;
};

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'threads', label: 'Threads' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube_shorts', label: 'YouTube Shorts' },
  { id: 'youtube_long', label: 'YouTube Video' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'bluesky', label: 'BlueSky' }
];

export default function ApprovePost() {
  const { id } = useParams();
  const [currentIdea, setCurrentIdea] = useState<any>(null);
  
  // Standard actions
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Record<string, number>>({});

  // New AI Expansion States
  const [isModifyingTone, setIsModifyingTone] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [mediaPrompts, setMediaPrompts] = useState<any[]>([]);
  const [isGeneratingBlog, setIsGeneratingBlog] = useState(false);
  const [blogContent, setBlogContent] = useState<string | null>(null);

  const { control, handleSubmit, register, watch, reset, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      caption: '',
      hashtags: '',
      urls: [{ value: '' }],
      platforms: [],
      scheduleDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm") // Tomorrow
    }
  });

  // Pull contextual data from localStorage based on clicked ID
  useEffect(() => {
    const saved = localStorage.getItem('riresume_ideas_v4');
    if (saved) {
      const ideas = JSON.parse(saved);
      const idea = ideas.find((i: any) => i.id === id);
      if (idea) {
        setCurrentIdea(idea);
        
        // Map rough platforms based on string
        const platformString = idea.platform.toLowerCase();
        let matchedPlatforms: string[] = [];
        if (platformString.includes('linkedin')) matchedPlatforms.push('linkedin');
        if (platformString.includes('x') || platformString.includes('twitter')) matchedPlatforms.push('x');
        if (platformString.includes('tiktok')) matchedPlatforms.push('tiktok');
        if (platformString.includes('instagram')) matchedPlatforms.push('instagram');
        if (platformString.includes('threads')) matchedPlatforms.push('threads');
        if (platformString.includes('facebook')) matchedPlatforms.push('facebook');
        if (platformString.includes('short')) matchedPlatforms.push('youtube_shorts');
        if (matchedPlatforms.length === 0) matchedPlatforms = ['linkedin', 'x']; // fallback
        
        reset({
          caption: idea.caption || idea.topic,
          hashtags: idea.hashtags || '#RiResume',
          urls: [{ value: '' }],
          platforms: matchedPlatforms,
          scheduleDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm")
        });
      }
    }
  }, [id, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: 'urls' });
  const selectedPlatforms = watch('platforms');
  const urlsWatch = watch('urls');

  /* ---------- NEW AI ACTION HANDLERS ---------- */

  const baseUrl = import.meta.env.PROD 
    ? 'https://us-central1-ats-resume-optimizer-8652d.cloudfunctions.net' 
    : `http://${window.location.hostname}:5001/ats-resume-optimizer-8652d/us-central1`;

  const handleModifyTone = async (toneReq: string) => {
    setIsModifyingTone(true);
    try {
      const res = await fetch(`${baseUrl}/modifyTone`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: getValues('caption'), tone: toneReq })
      });
      const data = await res.json();
      if(data.success) setValue('caption', data.text);
    } catch(e) { 
      alert("Failed to modify tone. Ensure the emulator is running."); 
    } finally {
      setIsModifyingTone(false);
    }
  };

  const handleGeneratePrompts = async () => {
    setIsGeneratingPrompts(true);
    try {
      const res = await fetch(`${baseUrl}/generateMediaPrompts`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ topic: currentIdea?.topic, caption: getValues('caption') })
      });
      const data = await res.json();
      if(data.success) setMediaPrompts(data.prompts);
    } catch(e) { 
      alert("Failed to generate UI prompts."); 
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleGenerateBlog = async () => {
    setIsGeneratingBlog(true);
    try {
      const res = await fetch(`${baseUrl}/generateBlogPost`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ topic: currentIdea?.topic, caption: getValues('caption') })
      });
      const data = await res.json();
      if(data.success) setBlogContent(data.blog);
    } catch(e) { 
      alert("Failed to generate blog."); 
    } finally {
      setIsGeneratingBlog(false);
    }
  };

  /* ------------------------------------------ */

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const storageRef = ref(storage, `marketing_media/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const fileId = file.name;
      setActiveUploads(prev => ({ ...prev, [fileId]: 0 }));

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setActiveUploads(prev => ({ ...prev, [fileId]: progress }));
        }, 
        (error) => {
          console.error("Upload error:", error);
          alert("Failed to upload " + file.name);
          setActiveUploads(prev => { const d = {...prev}; delete d[fileId]; return d; });
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          append({ value: downloadURL });
          setActiveUploads(prev => { const d = {...prev}; delete d[fileId]; return d; });
        }
      );
    });
  };

  const onSubmit = async (data: FormValues) => {
    const filledUrls = data.urls.filter(u => u.value.trim().length > 0);
    
    if (data.platforms.includes('instagram') && filledUrls.length === 0) {
       alert("Validation Error: Instagram requires at least one image or video media URL to be added.");
       return;
    }
    
    const hasVideoPlatform = data.platforms.some(p => ['youtube_shorts', 'youtube_long', 'tiktok'].includes(p));
    if (hasVideoPlatform && filledUrls.length === 0) {
       alert("Validation Error: YouTube and TikTok require a video media URL to be added.");
       return;
    }

    if (Object.keys(activeUploads).length > 0) {
       alert("Please wait for all media files to finish uploading.");
       return;
    }

    setIsPublishing(true);
    
    try {
      const response = await fetch(`${baseUrl}/publishToBlotato`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId: id, ...data })
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || "Failed to reach backend API.");
      
      const saved = localStorage.getItem('riresume_ideas_v4');
      if (saved) {
         let ideas = JSON.parse(saved);
         ideas = ideas.map((idea: any) => idea.id === id ? { ...idea, status: 'approved' } : idea);
         localStorage.setItem('riresume_ideas_v4', JSON.stringify(ideas));
      }

      alert("Post approved and queued in Blotato Backend!");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to connect to backend system.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-24">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to ideas
      </Link>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Review Marketing Content</h1>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">
              Generated Idea #{id} • {currentIdea ? currentIdea.topic : 'Loading Topic...'}
            </p>
          </div>
          <div className="h-10 w-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-indigo-100 dark:border-slate-700 text-indigo-500 dark:text-indigo-400">
            <ImageIcon className="h-5 w-5" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Generated Caption</label>
                <textarea 
                  {...register('caption')}
                  className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner dark:text-slate-200 leading-relaxed"
                />
                
                {/* Tone Modifiers */}
                <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                   <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mr-2">
                     <Type className="h-3 w-3" /> Tone Tweaks:
                   </div>
                   {['Humorous & Witty', 'Highly Professional', 'Bold & Controversial'].map((t) => (
                     <button 
                       key={t} type="button" onClick={() => handleModifyTone(t)} disabled={isModifyingTone}
                       className="text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                     >
                       {t.split(' ')[0]}
                     </button>
                   ))}
                   {isModifyingTone && <Loader2 className="h-4 w-4 animate-spin text-indigo-500 ml-auto" />}
                </div>

              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Suggested Hashtags</label>
                <input 
                  type="text"
                  {...register('hashtags')}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner font-mono text-sm text-indigo-600 dark:text-indigo-400"
                />
              </div>
            </div>

            {/* Media Uploads */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">Media Attachments (Max 10)</label>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">{fields.length}/10</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upload files directly to Firebase or paste raw public URLs.</p>
              
              <div className="relative group cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl p-6 text-center transition-all">
                <input 
                  type="file" multiple accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-indigo-500 mx-auto mb-2 transition-colors" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Drag & Drop or Click to Upload Media</span>
              </div>

              {/* Progress Trackers */}
              {Object.entries(activeUploads).map(([name, progress]) => (
                 <div key={name} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                       <span className="truncate w-3/4">{name}</span>
                       <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                       <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                 </div>
              ))}

              <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {fields.map((field, index) => {
                  const urlValue = urlsWatch?.[index]?.value || '';
                  const isVideo = urlValue.toLowerCase().match(/\.(mp4|mov|webm)/i);
                  const isPopulated = urlValue.trim().length > 0;
                  
                  return (
                    <div key={field.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex gap-2">
                        <input
                          {...register(`urls.${index}.value`)}
                          placeholder="https://drive.google.com/..."
                          className="flex-1 p-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-slate-200"
                        />
                        <button 
                          type="button" onClick={() => remove(index)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {isPopulated && (
                        <div className="mt-2 pl-1 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 w-32 h-32 bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative">
                          {isVideo ? (
                            <video src={urlValue} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                          ) : (
                            <img src={urlValue} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/50 backdrop-blur-md text-[10px] text-white px-1.5 py-0.5 rounded font-bold">
                            {isVideo ? 'VIDEO' : 'IMAGE'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {fields.length < 10 && (
                <button
                  type="button" onClick={() => append({ value: '' })}
                  className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Paste External URL
                </button>
              )}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Social Platforms */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">Select Target Platforms</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <Controller
                    key={platform.id} name="platforms" control={control}
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => {
                          const current = field.value || [];
                          field.onChange(isSelected ? current.filter(p => p !== platform.id) : [...current, platform.id]);
                        }}
                        className={clsx(
                          "relative flex items-center p-3 rounded-xl border text-sm font-medium transition-all text-left",
                          isSelected 
                            ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-600" 
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        <span className="flex-1">{platform.label}</span>
                        {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* Scheduling & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-slate-950/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 mt-8 gap-6">
            <div className="w-full sm:w-auto">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">
                <CalendarIcon className="h-4 w-4 text-slate-500" /> Schedule Post
              </label>
              <input
                type="datetime-local" {...register('scheduleDate')}
                className="w-full sm:w-64 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none transition-all dark:text-slate-200"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                type="button" disabled={Object.keys(activeUploads).length > 0}
                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" /> Save Draft
              </button>
              <button 
                type="submit" disabled={isPublishing || Object.keys(activeUploads).length > 0}
                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isPublishing ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                {isPublishing ? 'Publishing...' : 'Approve & Queue'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* -------------------- AI EXPANSION STUDIO UI -------------------- */}

      <div className="space-y-6">
          <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-indigo-500"/> AI Augmentation Studio
              </h2>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-bold">New Features</span>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
              
              {/* Media Prompts Generator Panel */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 bg-purple-100/50 dark:bg-purple-900/10 rounded-bl-full opacity-50 blur-2xl z-0"></div>
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4">
                          <Camera className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-2">Cinematic Media Prompts</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                          Need absolute perfection? Generate hyper-specific, production-ready text prompts for generative models like Midjourney (Image) or Runway (Video) structurally based on this exact post.
                      </p>
                      
                      <button 
                          type="button" onClick={handleGeneratePrompts} disabled={isGeneratingPrompts} 
                          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                      >
                          {isGeneratingPrompts ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                          {isGeneratingPrompts ? 'Engineering Prompts...' : 'Generate Image & Video Prompts'}
                      </button>

                      {/* Display Prompts */}
                      {mediaPrompts.length > 0 && (
                          <div className="mt-6 space-y-4">
                              {mediaPrompts.map((p, i) => (
                                  <div key={i} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                                      <strong className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-2">{p.type}</strong>
                                      <p className="text-sm font-mono text-slate-700 dark:text-slate-300 leading-relaxed">{p.prompt}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Long-Form Blog Generator Panel */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 bg-emerald-100/50 dark:bg-emerald-900/10 rounded-bl-full opacity-50 blur-2xl z-0"></div>
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
                          <FileText className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-2">Auto-Expand into a Blog</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                          Loved this social media post? Instantly expand this core idea into a massive 1,000-word, fully parsed, SEO-optimized thought-leadership article for your website. 
                      </p>
                      
                      <button 
                          type="button" onClick={handleGenerateBlog} disabled={isGeneratingBlog} 
                          className="w-full py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                      >
                          {isGeneratingBlog ? <Loader2 className="animate-spin h-4 w-4" /> : <PenLine className="h-4 w-4" />}
                          {isGeneratingBlog ? 'Writing 1,000 Word Article...' : 'Draft Complete Blog Post'}
                      </button>
                  </div>
              </div>
          </div>

          {/* Generated Blog Display UI */}
          {blogContent && (
             <div className="p-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mt-8 relative">
                <button className="absolute top-6 right-6 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Copy HTML</button>
                <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-3">
                   <FileText className="h-6 w-6 text-emerald-500" /> SEO Generated Blog Output
                </h3>
                <div className="prose prose-slate dark:prose-invert max-w-none font-serif leading-loose whitespace-pre-wrap">
                   {blogContent}
                </div>
             </div>
          )}

      </div>

    </div>
  );
}
