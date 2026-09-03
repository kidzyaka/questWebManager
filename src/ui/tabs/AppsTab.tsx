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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-sm">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('user')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filterType === 'user'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>User Apps</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-black/20">
              {userAppsCount}
            </span>
          </button>

          <button
            onClick={() => setFilterType('system')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filterType === 'system'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>System Apps</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-black/20">
              {systemAppsCount}
            </span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search packages..."
              className="bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48 sm:w-60"
            />
          </div>

          <button
            onClick={loadApps}
            title="Refresh list"
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Upload className="w-4 h-4" />
            <span>Install APK</span>
          </button>
        </div>
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center justify-between ${
            actionFeedback.isError
              ? 'bg-red-950/40 border-red-900/40 text-red-400'
              : 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400'
          }`}
        >
          <span>{actionFeedback.msg}</span>
          <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Apps Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950/60 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
              <tr>
                <th className="px-5 py-3">Application</th>
                <th className="px-5 py-3 w-56">Path</th>
                <th className="px-5 py-3 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && apps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading applications...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-500">
                    No applications found
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.packageName} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-5 py-3 flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          app.isSystem
                            ? 'bg-gray-800 text-gray-400'
                            : 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
                        }`}
                      >
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="truncate max-w-sm sm:max-w-md">
                        <p className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors truncate">
                          {app.packageName}
                        </p>
                        <span className="text-[10px] uppercase font-semibold text-gray-500">
                          {app.isSystem ? 'System' : 'Third-Party'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3 text-xs text-gray-500 font-mono truncate max-w-xs">
                      {app.apkPath}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleLaunch(app)}
                          disabled={actionLoading === app.packageName}
                          title="Launch on headset"
                          className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-emerald-400 rounded transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleForceStop(app)}
                          disabled={actionLoading === app.packageName}
                          title="Force stop"
                          className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-amber-400 rounded transition-colors"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setUninstallTarget(app)}
                          disabled={actionLoading === app.packageName}
                          title={app.isSystem ? 'Hide system app' : 'Uninstall app'}
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

      {/* APK Installation Modal */}
      {installing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-blue-500" />
                <div>
                  <h3 className="text-base font-bold text-gray-100">APK Sideload</h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{installFileName}</p>
                </div>
              </div>
              {installResult && (
                <button
                  onClick={() => setInstalling(false)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {!installResult ? (
              <div className="space-y-3 py-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    {installStage === 'uploading'
                      ? 'Uploading APK to headset...'
                      : 'Installing on device (this may take up to a minute)...'}
                  </span>
                  <span>{installStage === 'uploading' ? `${installProgress}%` : ''}</span>
                </div>
                <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      installStage === 'uploading' ? 'bg-blue-500' : 'bg-amber-500 animate-pulse'
                    }`}
                    style={{
                      width: installStage === 'uploading' ? `${installProgress}%` : '100%',
                    }}
                  ></div>
                </div>
              </div>
            ) : (
              <div
                className={`p-4 rounded-lg text-sm border space-y-2 ${
                  installResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                    : 'bg-red-950/40 border-red-800/50 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {installResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                  <span>{installResult.success ? 'Success' : 'Error'}</span>
                </div>
                <p className="text-xs text-gray-300 break-words">{installResult.message}</p>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInstalling(false)}
                    className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-100">
                {uninstallTarget.isSystem ? 'Hide System App?' : 'Uninstall App?'}
              </h3>
            </div>
            <p className="text-sm text-gray-300">
              Are you sure you want to {uninstallTarget.isSystem ? 'hide' : 'uninstall'}{' '}
              <strong className="text-white break-all">{uninstallTarget.packageName}</strong>?
              {uninstallTarget.isSystem &&
                ' (System apps cannot be fully deleted, but will be disabled for the current user).'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setUninstallTarget(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUninstall}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-red-900/30"
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
