import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Image,
  Video,
  RefreshCw,
  Download,
  X,
  Filter,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Play,
  Camera,
  Film,
  Loader2,
  AlertTriangle,
  Folder,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../../app/store';
import type { MediaItem } from '../../services/media';
import { formatFileSize } from '../../services/files';

type ViewMode = 'grid' | 'list';
type MediaFilter = 'all' | 'photo' | 'video';

interface DownloadProgressState {
  item: MediaItem;
  received: number;
  total: number;
  percent: number;
  controller: AbortController;
}

/**
 * Triggers browser download without revoking the blob URL prematurely.
 */
function triggerBrowserDownload(blobOrUrl: Blob | string, fileName: string) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    if (typeof blobOrUrl !== 'string') {
      URL.revokeObjectURL(url);
    }
  }, 60000);
}

export const MediaTab: React.FC = () => {
  const { mediaService } = useStore();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<MediaFilter>('all');

  // Lightbox state
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<{ received: number; total: number; percent: number } | null>(null);
  const [autoSaveWhenLoaded, setAutoSaveWhenLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const previewAbortRef = useRef<AbortController | null>(null);
  const autoSaveRef = useRef<boolean>(false);

  // Standalone download state (from grid or list)
  const [activeDownload, setActiveDownload] = useState<DownloadProgressState | null>(null);

  // Thumbnail cache: path -> blob URL
  const thumbCache = useRef<Map<string, string>>(new Map());
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());
  const [loadingThumbs, setLoadingThumbs] = useState<Set<string>>(new Set());

  const loadMedia = useCallback(async () => {
    if (!mediaService) return;
    setLoading(true);
    setError(null);
    try {
      const result = await mediaService.scanMedia();
      setItems(result);
    } catch (err: any) {
      console.error('Error scanning media:', err);
      setError(err.message || 'Failed to scan media directories');
    } finally {
      setLoading(false);
    }
  }, [mediaService]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of thumbCache.current.values()) {
        URL.revokeObjectURL(url);
      }
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const photoCount = useMemo(() => items.filter((i) => i.type === 'photo').length, [items]);
  const videoCount = useMemo(() => items.filter((i) => i.type === 'video').length, [items]);

  // Load thumbnail for a single photo
  const loadThumbnail = useCallback(
    async (item: MediaItem) => {
      if (!mediaService) return;
      if (thumbCache.current.has(item.path)) return;
      if (loadingThumbs.has(item.path)) return;

      setLoadingThumbs((prev) => new Set(prev).add(item.path));
      try {
        const blob = await mediaService.pullAsBlob(item.path);
        const url = URL.createObjectURL(blob);
        thumbCache.current.set(item.path, url);
        setThumbUrls((prev) => new Map(prev).set(item.path, url));
      } catch (err) {
        console.warn(`Failed to load thumbnail for ${item.name}:`, err);
      } finally {
        setLoadingThumbs((prev) => {
          const next = new Set(prev);
          next.delete(item.path);
          return next;
        });
      }
    },
    [mediaService, loadingThumbs]
  );

  // Lazy-load thumbnails for visible photos (load first batch)
  useEffect(() => {
    const photosToLoad = filteredItems
      .filter((i) => i.type === 'photo' && !thumbCache.current.has(i.path))
      .slice(0, 12);

    for (const item of photosToLoad) {
      loadThumbnail(item);
    }
  }, [filteredItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open preview / lightbox with live progress and cancel support
  const openPreview = useCallback(
    async (item: MediaItem) => {
      if (!mediaService) return;

      // Abort any ongoing preview transfer
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
      const controller = new AbortController();
      previewAbortRef.current = controller;

      setPreviewItem(item);
      setPreviewLoading(true);
      setPreviewBlobUrl(null);
      setPreviewProgress({ received: 0, total: item.size, percent: 0 });
      setAutoSaveWhenLoaded(false);
      autoSaveRef.current = false;
      setVideoError(false);
      setDownloadSuccess(false);

      try {
        const blob = await mediaService.pullAsBlob(
          item.path,
          (received) => {
            const total = item.size || received;
            const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
            setPreviewProgress({ received, total, percent });
          },
          controller.signal
        );

        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);

        // If the user clicked "Download" while it was loading, trigger the file download now
        if (autoSaveRef.current) {
          triggerBrowserDownload(url, item.name);
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 3000);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          // User aborted, clean exit
          return;
        }
        console.error('Failed to load preview:', err);
        setError(`Failed to load ${item.name}: ${err.message}`);
        setPreviewItem(null);
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    },
    [mediaService]
  );

  const closePreview = useCallback(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewItem(null);
    setPreviewBlobUrl(null);
    setPreviewLoading(false);
    setPreviewProgress(null);
    setAutoSaveWhenLoaded(false);
    autoSaveRef.current = false;
    setVideoError(false);
  }, [previewBlobUrl]);

  // Navigate in lightbox
  const navigatePreview = useCallback(
    (direction: -1 | 1) => {
      if (!previewItem) return;
      const idx = filteredItems.findIndex((i) => i.path === previewItem.path);
      if (idx === -1) return;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= filteredItems.length) return;
      openPreview(filteredItems[nextIdx]);
    },
    [previewItem, filteredItems, openPreview]
  );

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!previewItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') navigatePreview(-1);
      if (e.key === 'ArrowRight') navigatePreview(1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewItem, closePreview, navigatePreview]);

  /**
   * Handle download inside the preview modal
   */
  const handlePreviewDownloadClick = () => {
    if (!previewItem) return;

    if (previewBlobUrl) {
      // Blob is ready in memory: download immediately!
      triggerBrowserDownload(previewBlobUrl, previewItem.name);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } else if (previewLoading) {
      // Still transferring: flag auto-save as soon as transfer finishes
      setAutoSaveWhenLoaded(true);
      autoSaveRef.current = true;
    }
  };

  /**
   * Start a dedicated file download with progress modal (from grid or list)
   */
  const startDirectDownload = async (item: MediaItem) => {
    if (!mediaService) return;

    // Check if we already have it in preview
    if (previewItem?.path === item.path && previewBlobUrl) {
      triggerBrowserDownload(previewBlobUrl, item.name);
      return;
    }

    const controller = new AbortController();
    setActiveDownload({
      item,
      received: 0,
      total: item.size,
      percent: 0,
      controller,
    });

    try {
      await mediaService.downloadFile(
        item.path,
        item.name,
        (received) => {
          const total = item.size || received;
          const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
          setActiveDownload((prev) => (prev ? { ...prev, received, total, percent } : null));
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        console.error('Download failed:', err);
        alert(`Download failed: ${err.message}`);
      }
    } finally {
      setActiveDownload(null);
    }
  };

  const cancelDirectDownload = () => {
    if (activeDownload) {
      activeDownload.controller.abort();
      setActiveDownload(null);
    }
  };

  const getDir = (path: string) => {
    const i = path.lastIndexOf('/');
    return i > 0 ? path.substring(0, i) : '/';
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg">
          <Camera className="w-4 h-4 text-neutral-400" />
          <span className="text-xs text-neutral-300 font-medium">{photoCount} Photos</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg">
          <Film className="w-4 h-4 text-neutral-400" />
          <span className="text-xs text-neutral-300 font-medium">{videoCount} Videos</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-3 rounded-xl shadow-sm">
        {/* Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          {(['all', 'photo', 'video'] as MediaFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                filter === f
                  ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>

        {/* View + Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={loadMedia}
            title="Rescan media"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-neutral-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-900/40 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <RefreshCw className="w-6 h-6 animate-spin mb-3 text-neutral-400" />
            <p className="text-sm">Scanning media directories...</p>
            <p className="text-xs text-neutral-600 mt-1">This may take a moment</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <Image className="w-8 h-8 mb-3 text-neutral-600" />
            <p className="text-sm font-medium text-neutral-400">No media found</p>
            <p className="text-xs text-neutral-600 mt-1">
              {filter !== 'all'
                ? `No ${filter === 'photo' ? 'photos' : 'videos'} found. Try changing the filter.`
                : 'Take screenshots or record videos on your headset first.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2">
            {filteredItems.map((item) => (
              <div
                key={item.path}
                className="group relative aspect-video bg-neutral-950 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-neutral-600 transition-all border border-neutral-800/80"
                onClick={() => openPreview(item)}
                onMouseEnter={() => {
                  if (item.type === 'photo' && !thumbCache.current.has(item.path)) {
                    loadThumbnail(item);
                  }
                }}
              >
                {/* Thumbnail or Placeholder */}
                {item.type === 'photo' && thumbUrls.has(item.path) ? (
                  <img
                    src={thumbUrls.get(item.path)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.type === 'video' ? (
                      <div className="relative flex items-center justify-center">
                        <Film className="w-8 h-8 text-neutral-700" />
                        <Play className="w-4 h-4 text-neutral-500 absolute" />
                      </div>
                    ) : loadingThumbs.has(item.path) ? (
                      <Loader2 className="w-5 h-5 text-neutral-600 animate-spin" />
                    ) : (
                      <Image className="w-8 h-8 text-neutral-700" />
                    )}
                  </div>
                )}

                {/* Quick Download Button on Grid Item (Top Left) */}
                <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startDirectDownload(item);
                    }}
                    title="Download to PC"
                    className="p-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-md border border-neutral-700 backdrop-blur-sm transition-colors shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Type badge (Top Right) */}
                <div className="absolute top-1.5 right-1.5 pointer-events-none">
                  {item.type === 'video' ? (
                    <span className="px-1.5 py-0.5 bg-blue-600/80 text-white text-[9px] font-medium rounded backdrop-blur-sm">
                      VIDEO
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-emerald-600/80 text-white text-[9px] font-medium rounded backdrop-blur-sm">
                      PHOTO
                    </span>
                  )}
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                  <p className="text-[10px] text-white font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-neutral-400">{item.formattedSize}</span>
                    <span className="text-[9px] text-neutral-500">•</span>
                    <span className="text-[9px] text-neutral-400">{item.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-950/60 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3 w-20">Type</th>
                  <th className="px-5 py-3 w-28">Size</th>
                  <th className="px-5 py-3 w-36">Date</th>
                  <th className="px-5 py-3 w-48">Directory</th>
                  <th className="px-5 py-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredItems.map((item) => (
                  <tr
                    key={item.path}
                    className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                    onClick={() => openPreview(item)}
                  >
                    <td className="px-5 py-2.5 flex items-center gap-2.5">
                      {item.type === 'photo' ? (
                        <Image className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Video className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <span className="font-medium text-neutral-200 group-hover:text-white transition-colors truncate max-w-sm">
                        {item.name}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          item.type === 'photo'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'
                            : 'bg-blue-950/60 text-blue-400 border border-blue-900/40'
                        }`}
                      >
                        {item.type === 'photo' ? 'Photo' : 'Video'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-neutral-400 font-mono text-[11px]">
                      {item.formattedSize}
                    </td>
                    <td className="px-5 py-2.5 text-neutral-500 text-[11px] whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1 text-neutral-600 text-[11px] truncate max-w-[10rem]">
                        <Folder className="w-3 h-3 shrink-0" />
                        <span className="truncate">{getDir(item.path)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startDirectDownload(item)}
                        disabled={activeDownload?.item.path === item.path}
                        title="Download to PC"
                        className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-50 rounded transition-colors"
                      >
                        {activeDownload?.item.path === item.path ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-200" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Standalone Direct Download Modal with Progress Bar */}
      {activeDownload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-neutral-300" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">Downloading to PC</h3>
                  <p className="text-xs text-neutral-400 truncate max-w-xs">{activeDownload.item.name}</p>
                </div>
              </div>
              <button
                onClick={cancelDirectDownload}
                className="text-neutral-500 hover:text-neutral-300 text-xs px-2 py-1 rounded bg-neutral-800"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>
                  {formatFileSize(activeDownload.received)} / {activeDownload.item.formattedSize}
                </span>
                <span className="font-mono text-neutral-200">{activeDownload.percent}%</span>
              </div>
              <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                <div
                  className="h-2.5 rounded-full bg-neutral-200 transition-all duration-150"
                  style={{ width: `${activeDownload.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closePreview}
        >
          {/* Close button */}
          <button
            onClick={closePreview}
            title="Close (Esc)"
            className="absolute top-4 right-4 z-50 p-2 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Navigation Arrows */}
          {(() => {
            const idx = filteredItems.findIndex((i) => i.path === previewItem.path);
            return (
              <>
                {idx > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigatePreview(-1);
                    }}
                    title="Previous (Left Arrow)"
                    className="absolute left-4 z-50 p-2 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {idx < filteredItems.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigatePreview(1);
                    }}
                    title="Next (Right Arrow)"
                    className="absolute right-4 z-50 p-2 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            );
          })()}

          {/* Lightbox Body */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading Screen with Real-Time Progress Bar */}
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 bg-neutral-900/90 rounded-2xl border border-neutral-800 max-w-md w-full shadow-2xl text-center">
                <Loader2 className="w-8 h-8 text-neutral-300 animate-spin mb-4" />
                <p className="text-sm font-semibold text-neutral-100 mb-1">
                  Loading {previewItem.type === 'video' ? 'Video' : 'Photo'}...
                </p>
                <p className="text-xs text-neutral-400 truncate max-w-xs mb-4">
                  {previewItem.name}
                </p>

                {/* Progress bar */}
                <div className="w-full space-y-1.5 mb-6">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>
                      {previewProgress
                        ? `${formatFileSize(previewProgress.received)} / ${previewItem.formattedSize}`
                        : previewItem.formattedSize}
                    </span>
                    <span className="font-mono text-neutral-200">
                      {previewProgress ? `${previewProgress.percent}%` : '0%'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                    <div
                      className="h-2.5 rounded-full bg-neutral-200 transition-all duration-150"
                      style={{ width: `${previewProgress?.percent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Loading Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={closePreview}
                    className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handlePreviewDownloadClick}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      autoSaveWhenLoaded
                        ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        : 'bg-neutral-100 hover:bg-white text-neutral-950 shadow-sm'
                    }`}
                  >
                    {autoSaveWhenLoaded ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to PC when loaded...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download to PC</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : previewBlobUrl ? (
              previewItem.type === 'photo' ? (
                <img
                  src={previewBlobUrl}
                  alt={previewItem.name}
                  className="max-w-full max-h-[75vh] rounded-lg shadow-2xl object-contain"
                />
              ) : (
                <div className="relative max-w-full max-h-[75vh] flex flex-col items-center">
                  {videoError ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-neutral-900 border border-neutral-800 rounded-xl text-center max-w-md">
                      <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                      <h4 className="text-sm font-semibold text-neutral-100 mb-1">
                        Cannot play video in browser
                      </h4>
                      <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
                        This video format (often HEVC/H.265 recorded by Quest) cannot be decoded directly by your browser.
                        Download it to play in your local media player.
                      </p>
                      <button
                        onClick={handlePreviewDownloadClick}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-semibold rounded-lg shadow-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Video to PC</span>
                      </button>
                    </div>
                  ) : (
                    <video
                      src={previewBlobUrl}
                      controls
                      autoPlay
                      onError={() => setVideoError(true)}
                      className="max-w-full max-h-[75vh] rounded-lg shadow-2xl"
                    />
                  )}
                </div>
              )
            ) : null}

            {/* Bottom Info & Action Bar */}
            <div className="mt-3 flex items-center gap-4 px-4 py-2.5 bg-neutral-900/90 rounded-xl border border-neutral-800 shadow-xl max-w-xl w-full">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-200 font-medium truncate">{previewItem.name}</p>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                  <span>{previewItem.formattedSize}</span>
                  <span>•</span>
                  <span>{previewItem.date}</span>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handlePreviewDownloadClick}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 ${
                  downloadSuccess
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : autoSaveWhenLoaded
                    ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-100 hover:bg-white text-neutral-900 border-transparent shadow-sm'
                }`}
              >
                {downloadSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : autoSaveWhenLoaded ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving when ready...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
