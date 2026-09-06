import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Search,
  Upload,
  Play,
  Square,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useStore } from '../../app/store';
import type { AppPackage } from '../../services/pm';

export const AppsTab: React.FC = () => {
  const { pmService } = useStore();

  const [apps, setApps] = useState<AppPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'user' | 'system'>('user');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ msg: string; isError: boolean } | null>(null);

  // Install modal
  const [installing, setInstalling] = useState(false);
  const [installStage, setInstallStage] = useState<'uploading' | 'installing'>('uploading');
  const [installProgress, setInstallProgress] = useState(0);
  const [installFileName, setInstallFileName] = useState('');
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);

  // Uninstall confirm modal
  const [uninstallTarget, setUninstallTarget] = useState<AppPackage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadApps = useCallback(async () => {
    if (!pmService) return;
    setLoading(true);
    setActionFeedback(null);
    try {
      const list = await pmService.listPackages();
      setApps(list);
    } catch (err: any) {
      console.error('Error listing packages:', err);
      setActionFeedback({ msg: err.message || 'Failed to list packages', isError: true });
    } finally {
      setLoading(false);
    }
  }, [pmService]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const handleInstallFile = async (file: File) => {
    if (!pmService) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Only .apk files are supported for sideloading.');
      return;
    }

    setInstalling(true);
    setInstallResult(null);
    setInstallStage('uploading');
    setInstallProgress(0);
    setInstallFileName(file.name);

    try {
      const report = await pmService.installApk(file, file.name, (stage, pct) => {
        setInstallStage(stage);
        setInstallProgress(pct);
      });
      setInstallResult(report);
      if (report.success) {
        loadApps();
      }
    } catch (err: any) {
      setInstallResult({ success: false, message: err.message || 'Installation error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLaunch = async (pkg: AppPackage) => {
    if (!pmService) return;
    setActionLoading(pkg.packageName);
    try {
      await pmService.launch(pkg.packageName);
      setActionFeedback({ msg: `Launched ${pkg.packageName}`, isError: false });
    } catch (err: any) {
      setActionFeedback({ msg: `Failed to launch: ${err.message}`, isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceStop = async (pkg: AppPackage) => {
    if (!pmService) return;
    setActionLoading(pkg.packageName);
    try {
      await pmService.forceStop(pkg.packageName);
      setActionFeedback({ msg: `Stopped ${pkg.packageName}`, isError: false });
    } catch (err: any) {
      setActionFeedback({ msg: `Failed to stop: ${err.message}`, isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async () => {
    if (!pmService || !uninstallTarget) return;
    setActionLoading(uninstallTarget.packageName);
    try {
      await pmService.uninstall(uninstallTarget.packageName, uninstallTarget.isSystem);
      setUninstallTarget(null);
      setActionFeedback({
        msg: `Uninstalled ${uninstallTarget.packageName}`,
        isError: false,
      });
      loadApps();
    } catch (err: any) {
      setActionFeedback({ msg: `Uninstall failed: ${err.message}`, isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter list
  const filteredApps = apps.filter((app) => {
    if (filterType === 'user' && app.isSystem) return false;
    if (filterType === 'system' && !app.isSystem) return false;
    if (searchQuery.trim()) {
      return app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const userAppsCount = apps.filter((a) => !a.isSystem).length;
  const systemAppsCount = apps.filter((a) => a.isSystem).length;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".apk"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleInstallFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-3 rounded-xl shadow-sm">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType('user')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              filterType === 'user'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <span>User Apps</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-900 text-neutral-300">
              {userAppsCount}
            </span>
          </button>

          <button
            onClick={() => setFilterType('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              filterType === 'system'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <span>System Apps</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-900 text-neutral-300">
              {systemAppsCount}
            </span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search packages..."
              className="bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 w-44 sm:w-56"
            />
          </div>

          <button
            onClick={loadApps}
            title="Refresh list"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-neutral-400' : ''}`} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Install APK</span>
          </button>
        </div>
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionFeedback.isError
              ? 'bg-red-950/40 border-red-900/40 text-red-400'
              : 'bg-emerald-950/40 border-emerald-900/40 text-emerald-300'
          }`}
        >
          <span>{actionFeedback.msg}</span>
          <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Apps Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/60 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="px-5 py-3">Application</th>
                <th className="px-5 py-3 w-56">Path</th>
                <th className="px-5 py-3 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading && apps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-400" />
                    Loading applications...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-neutral-500">
                    No applications found
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.packageName} className="hover:bg-neutral-800/40 transition-colors group">
                    <td className="px-5 py-2.5 flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          app.isSystem
                            ? 'bg-neutral-800 text-neutral-500'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        }`}
                      >
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="truncate max-w-sm sm:max-w-md">
                        <p className="font-medium text-neutral-200 group-hover:text-white transition-colors truncate text-xs">
                          {app.packageName}
                        </p>
                        <span className="text-[9px] uppercase font-medium text-neutral-500">
                          {app.isSystem ? 'System' : 'Third-Party'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-2.5 text-[11px] text-neutral-500 font-mono truncate max-w-xs">
                      {app.apkPath}
                    </td>

                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleLaunch(app)}
                          disabled={actionLoading === app.packageName}
                          title="Launch on headset"
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleForceStop(app)}
                          disabled={actionLoading === app.packageName}
                          title="Force stop"
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded transition-colors"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setUninstallTarget(app)}
                          disabled={actionLoading === app.packageName}
                          title={app.isSystem ? 'Hide system app' : 'Uninstall app'}
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* APK Installation Modal */}
      {installing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-neutral-300" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">APK Sideload</h3>
                  <p className="text-xs text-neutral-400 truncate max-w-xs">{installFileName}</p>
                </div>
              </div>
              {installResult && (
                <button
                  onClick={() => setInstalling(false)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!installResult ? (
              <div className="space-y-2.5 py-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-neutral-300" />
                    {installStage === 'uploading'
                      ? 'Uploading APK to headset...'
                      : 'Installing on device...'}
                  </span>
                  <span>{installStage === 'uploading' ? `${installProgress}%` : ''}</span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                  <div
                    className="h-2 rounded-full bg-neutral-200 transition-all duration-200"
                    style={{
                      width: installStage === 'uploading' ? `${installProgress}%` : '100%',
                    }}
                  ></div>
                </div>
              </div>
            ) : (
              <div
                className={`p-3.5 rounded-lg text-xs border space-y-2 ${
                  installResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                    : 'bg-red-950/40 border-red-800/50 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {installResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                  <span>{installResult.success ? 'Success' : 'Error'}</span>
                </div>
                <p className="text-neutral-300 break-words">{installResult.message}</p>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setInstalling(false)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uninstall Confirmation Modal */}
      {uninstallTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-neutral-100">
                {uninstallTarget.isSystem ? 'Hide System App?' : 'Uninstall App?'}
              </h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to {uninstallTarget.isSystem ? 'hide' : 'uninstall'}{' '}
              <strong className="text-neutral-200 break-all">{uninstallTarget.packageName}</strong>?
              {uninstallTarget.isSystem &&
                ' (System apps will be disabled for the primary user).'}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setUninstallTarget(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUninstall}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg"
              >
                {uninstallTarget.isSystem ? 'Hide App' : 'Uninstall'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
