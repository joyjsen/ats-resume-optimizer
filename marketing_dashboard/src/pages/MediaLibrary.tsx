import { useEffect, useState } from 'react';
import { storage } from '../lib/firebaseConfig';
import { ref, listAll, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import type { StorageReference } from 'firebase/storage';
import { Trash2, Loader2, Database, Image as ImageIcon, Video, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

type MediaFile = {
  ref: StorageReference;
  name: string;
  url: string;
  contentType?: string;
  size?: number;
  timeCreated?: string;
};

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const listRef = ref(storage, 'marketing_media');
      const res = await listAll(listRef);

      const filePromises = res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        const meta = await getMetadata(itemRef);
        return {
          ref: itemRef,
          name: itemRef.name,
          url,
          contentType: meta.contentType,
          size: meta.size,
          timeCreated: meta.timeCreated
        };
      });

      const loadedFiles = await Promise.all(filePromises);
      // Sort newest first
      loadedFiles.sort((a, b) => {
        if (!a.timeCreated || !b.timeCreated) return 0;
        return new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime();
      });

      setFiles(loadedFiles);
    } catch (e) {
      console.error("Failed to fetch media:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${file.name.split('_').pop()}? This might break connected posts.`)) {
      return;
    }
    setDeletingId(file.ref.fullPath);
    try {
      await deleteObject(file.ref);
      setFiles(prev => prev.filter(f => f.ref.fullPath !== file.ref.fullPath));
    } catch (e) {
      console.error("Failed to delete", e);
      alert("Failed to delete file from storage.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatBytes = (bytes = 0) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <Database className="h-8 w-8 text-indigo-500" /> Media Library
          </h1>
          <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
            Manage files directly uploaded to Firebase Storage. <br/> Currently tracking {files.length} uploads.
          </p>
        </div>
        <button onClick={loadFiles} className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
           Refresh Cloud
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
           <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
           Syncing Secure Cloud...
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center shadow-sm">
          <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Your Bucket is Empty</h3>
          <p className="text-slate-500 mt-2">Upload files using the Custom Blueprint creator to manage them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {files.map((file) => {
            const isVideo = file.contentType?.includes('video');
            const cleanName = file.name.includes('_') ? file.name.substring(file.name.indexOf('_') + 1) : file.name;
            const isDeleting = deletingId === file.ref.fullPath;

            return (
              <div key={file.ref.fullPath} className={clsx("group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md", isDeleting && "opacity-50 pointer-events-none")}>
                
                {/* Media Preview Window */}
                <div className="h-40 w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden">
                  {isVideo ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <Video className="h-10 w-10 text-white/50" />
                    </div>
                  ) : (
                    <img src={file.url} alt={cleanName} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                    <a href={file.url} target="_blank" rel="noreferrer" className="p-2.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-colors" title="View Raw File">
                       <ExternalLink className="h-5 w-5" />
                    </a>
                    <button onClick={() => handleDelete(file)} className="p-2.5 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-md transition-colors" title="Permanently Delete">
                       {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Metadata Footer */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mb-1" title={cleanName}>{cleanName}</h4>
                    <p className="text-xs text-slate-500 font-medium">{formatBytes(file.size)}</p>
                  </div>
                  {file.timeCreated && (
                    <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-50 dark:border-slate-800">
                      Added {format(new Date(file.timeCreated), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
