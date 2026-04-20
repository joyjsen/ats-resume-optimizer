import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Send, Calendar as CalendarIcon, Check, Plus, Trash2, Loader2, UploadCloud } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import clsx from 'clsx';
import { format } from 'date-fns';
import { storage } from '../lib/firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type FormValues = {
  topic: string;
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

export default function CustomPost() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Record<string, number>>({});
  
  const { control, handleSubmit, register, watch, reset } = useForm<FormValues>({
    defaultValues: {
      topic: '',
      caption: '',
      hashtags: '',
      urls: [],
      platforms: [],
      scheduleDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm")
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'urls' });
  const selectedPlatforms = watch('platforms');
  const urlsWatch = watch('urls');

  const baseUrl = import.meta.env.PROD 
    ? 'https://us-central1-ats-resume-optimizer-8652d.cloudfunctions.net' 
    : `http://${window.location.hostname}:5001/ats-resume-optimizer-8652d/us-central1`;

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
       alert("Validation Error: Instagram requires at least one image or video media URL or file to be uploaded.");
       return;
    }
    
    const hasVideoPlatform = data.platforms.some(p => ['youtube_shorts', 'youtube_long', 'tiktok'].includes(p));
    if (hasVideoPlatform && filledUrls.length === 0) {
       alert("Validation Error: YouTube and TikTok require a video media file to be uploaded.");
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: 'manual_custom', ...data })
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || "Failed to reach backend API.");
      
      alert("Custom Post Approved & Queued in Blotato!");
      reset();
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
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 px-8 py-6 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Custom Post</h1>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              Design a manual marketing post from scratch and bypass the AI generator.
            </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Topic or Title (Internal)</label>
              <input 
                type="text"
                {...register('topic')}
                placeholder="Holiday Promo 2026..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Post Caption</label>
                <textarea 
                  {...register('caption')}
                  required
                  placeholder="Tell your audience something great..."
                  className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none shadow-inner dark:text-slate-200 leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Hashtags</label>
                <input 
                  type="text"
                  {...register('hashtags')}
                  placeholder="#RiResume #JobHunt"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-mono text-sm text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            {/* Media Uploads */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">Media Attachments</label>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">{fields.length}/10</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upload files directly to Firebase or paste raw public URLs.</p>
              
              <div className="relative group cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl p-6 text-center transition-all">
                <input 
                  type="file" multiple accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-emerald-500 mx-auto mb-2 transition-colors" />
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
                       <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                 </div>
              ))}

              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                {fields.map((field, index) => {
                  const urlValue = urlsWatch?.[index]?.value || '';
                  const isVideo = urlValue.toLowerCase().match(/\.(mp4|mov|webm)/i);
                  const isPopulated = urlValue.trim().length > 0;
                  
                  return (
                    <div key={field.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex gap-2">
                        <input
                          {...register(`urls.${index}.value`)}
                          placeholder="https://firebasestorage..."
                          className="flex-1 p-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-slate-200"
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
                            ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-600" 
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        <span className="flex-1">{platform.label}</span>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
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
                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isPublishing ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                {isPublishing ? 'Publishing...' : 'Approve & Queue'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
