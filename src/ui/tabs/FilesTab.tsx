import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  File as FileIcon,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  Package,
  Upload,
  FolderPlus,
  RefreshCw,
  Download,
  Trash2,
  Edit2,
  ChevronRight,
  ArrowUp,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../app/store';
import type { FileEntry } from '../../services/files';

export const FilesTab: React.FC = () => {
  const { filesService } = useStore();

  const [currentPath, setCurrentPath] = useState<string>('/sdcard');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!filesService) return;
      setLoading(true);
      setError(null);
      try {
        const list = await filesService.listFiles(path);
        setEntries(list);
        setCurrentPath(path);
      } catch (err: any) {
        console.error('Error loading directory:', err);
        setError(err.message || 'Failed to list directory');
      } finally {
        setLoading(false);
      }
    },
    [filesService]
  );

  useEffect(() => {
    loadDirectory('/sdcard');
  }, [loadDirectory]);

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  const navigateToSegment = (index: number) => {
    const target = '/' + pathParts.slice(0, index + 1).join('/');
    loadDirectory(target);
  };

  const navigateUp = () => {
    if (currentPath === '/' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadDirectory(upPath === '//' ? '/' : upPath || '/');
  };

  // Actions
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filesService || !newFolderName.trim()) return;
    try {
      await filesService.createFolder(currentPath, newFolderName.trim());
      setNewFolderOpen(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Failed to create folder: ${err.message}`);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filesService || !renameTarget || !renameValue.trim()) return;
    try {
      await filesService.renameEntry(renameTarget.path, renameValue.trim());
      setRenameTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Failed to rename: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!filesService || !deleteTarget) return;
    try {
      await filesService.deleteEntry(deleteTarget.path);
      setDeleteTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !filesService) return;

    const file = files[0];
    const remotePath = `${currentPath.replace(/\/+$/, '')}/${file.name}`;

    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);

    try {
      await filesService.uploadFile(file, remotePath, (sent, total) => {
        const pct = Math.round((sent / total) * 100);
        setUploadProgress(pct);
      });
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (entry: FileEntry) => {
    if (!filesService) return;
    try {
      await filesService.downloadFile(entry.path, entry.name);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const getFileIcon = (entry: FileEntry) => {
    if (entry.isDir) return <Folder className="w-5 h-5 text-amber-400 shrink-0" />;
    const ext = entry.name.split('.').pop()?.toLowerCase();
    if (ext === 'apk') return <Package className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || ''))
      return <FileImage className="w-5 h-5 text-blue-400 shrink-0" />;
    if (['mp4', 'mkv', 'webm'].includes(ext || ''))
      return <FileVideo className="w-5 h-5 text-purple-400 shrink-0" />;
    if (['mp3', 'ogg', 'wav'].includes(ext || ''))
      return <FileAudio className="w-5 h-5 text-pink-400 shrink-0" />;
    if (['json', 'txt', 'xml', 'log'].includes(ext || ''))
      return <FileCode className="w-5 h-5 text-gray-400 shrink-0" />;
    return <FileIcon className="w-5 h-5 text-gray-400 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-sm">
        {/* Navigation / Breadcrumbs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-sm text-gray-300 py-1 max-w-xl">
          <button
            onClick={() => loadDirectory('/')}
            className="hover:text-white px-2 py-1 bg-gray-950/60 rounded border border-gray-800 hover:border-gray-700 transition-colors"
          >
            /
          </button>
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <button
                onClick={() => navigateToSegment(index)}
                className={`hover:text-white px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  index === pathParts.length - 1
                    ? 'font-semibold text-blue-400 bg-blue-950/30 border border-blue-900/40'
                    : 'bg-gray-950/60 border border-gray-800 hover:border-gray-700'
                }`}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {currentPath !== '/' && (
            <button
              onClick={navigateUp}
              title="Go to parent directory"
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => loadDirectory(currentPath)}
            title="Refresh directory"
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={() => setNewFolderOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* File List Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 bg-red-950/40 border-b border-red-900/40 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950/60 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 w-32">Size</th>
                <th className="px-5 py-3 w-40">Date</th>
                <th className="px-5 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading files...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    Directory is empty
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.path}
                    className="hover:bg-gray-800/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      if (entry.isDir) loadDirectory(entry.path);
                    }}
                  >
                    <td className="px-5 py-3 flex items-center gap-3">
                      {getFileIcon(entry)}
                      <span className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors truncate max-w-md">
                        {entry.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">
                      {entry.formattedSize}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td
                      className="px-5 py-3 text-right"
                      onClick={(e) => e.stopPropagation()} // don't trigger row navigation
                    >
                      <div className="flex items-center justify-end gap-1">
                        {!entry.isDir && (
                          <button
                            onClick={() => handleDownload(entry)}
                            title="Download to PC"
                            className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-emerald-400 rounded transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRenameTarget(entry);
                            setRenameValue(entry.name);
                          }}
                          title="Rename"
                          className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-blue-400 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          title="Delete"
                          className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Progress Modal */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Upload className="w-6 h-6 text-blue-500 animate-bounce" />
              <div>
                <h3 className="text-base font-bold text-gray-100">Uploading File</h3>
                <p className="text-xs text-gray-400 truncate max-w-xs">{uploadFileName}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Transferring...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                <div
                  className="h-2.5 rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateFolder}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-100">Create New Folder</h3>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Folder Name</label>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. MyFolder"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleRename}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-100">Rename</h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">New Name</label>
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameValue.trim() || renameValue === renameTarget.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-100">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-gray-300">
              Are you sure you want to delete{' '}
              <strong className="text-white break-all">{deleteTarget.name}</strong>?
              {deleteTarget.isDir && ' This will remove all contents inside this folder.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-red-900/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
