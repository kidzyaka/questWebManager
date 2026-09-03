import React, { useState } from 'react';
import {
  Battery,
  BatteryCharging,
  HardDrive,
  Cpu,
  RefreshCw,
  Power,
  Thermometer,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../../app/store';

export const StatusTab: React.FC = () => {
  const {
    deviceInfo,
    battery,
    storage,
    systemInfo,
    isLoadingStats,
    isRebooting,
    fetchStats,
    reboot,
  } = useStore();

  const [showRebootModal, setShowRebootModal] = useState(false);

  const batteryLevel = battery?.level ?? 0;
  const isCharging = battery?.isCharging ?? false;
  const temp = battery?.temperature ?? 0;

  return (
    <div className="space-y-6">
      {/* Device Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-100">
              {systemInfo?.model || 'Meta Quest Device'}
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/40 border border-emerald-800/60 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono">{deviceInfo}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats()}
            disabled={isLoadingStats}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin text-blue-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowRebootModal(true)}
            disabled={isRebooting}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Power className="w-4 h-4" />
            Reboot
          </button>
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Battery Card */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 text-gray-300 font-semibold">
              {isCharging ? (
                <BatteryCharging className="w-5 h-5 text-emerald-400" />
              ) : (
                <Battery className="w-5 h-5 text-blue-400" />
              )}
              <span>Battery Status</span>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isCharging
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : 'bg-gray-800 text-gray-300 border border-gray-700'
              }`}
            >
              {battery?.statusText || (isCharging ? 'Charging' : 'Discharging')}
            </span>
          </div>

          <div className="flex items-baseline gap-3 my-2">
            <span className="text-4xl font-bold tracking-tight text-gray-100">
              {battery ? `${batteryLevel}%` : '--'}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-yellow-500" />
              {temp > 0 ? `${temp}°C` : 'Normal temp'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-950 rounded-full h-2.5 mt-4 overflow-hidden border border-gray-800">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                batteryLevel > 20 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(5, Math.min(100, batteryLevel))}%` }}
            ></div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 text-gray-300 font-semibold">
              <HardDrive className="w-5 h-5 text-purple-400" />
              <span>Internal Storage (/sdcard)</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-800 text-gray-300 border border-gray-700">
              {storage ? `${storage.free} free` : '--'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-4xl font-bold tracking-tight text-gray-100">
              {storage ? `${storage.used}` : '--'}
            </span>
            <span className="text-sm text-gray-400">used of {storage?.total || '--'}</span>
          </div>

          {/* Storage Bar */}
          <div className="w-full bg-gray-950 rounded-full h-2.5 mt-4 overflow-hidden border border-gray-800">
            <div
              className="h-2.5 rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, storage?.percent ?? 20))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* System Information Card */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5 text-gray-300 font-semibold mb-5">
          <Cpu className="w-5 h-5 text-blue-400" />
          <span>System Information</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-950/70 border border-gray-800/80 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Layers className="w-4 h-4 text-gray-500" />
              Android Version
            </div>
            <p className="text-sm font-semibold text-gray-200">
              {systemInfo?.androidVersion || 'Android'}
            </p>
          </div>

          <div className="bg-gray-950/70 border border-gray-800/80 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <AlertCircle className="w-4 h-4 text-gray-500" />
              Build ID
            </div>
            <p className="text-sm font-semibold text-gray-200 truncate font-mono">
              {systemInfo?.buildId || 'N/A'}
            </p>
          </div>

          <div className="bg-gray-950/70 border border-gray-800/80 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Clock className="w-4 h-4 text-gray-500" />
              Uptime
            </div>
            <p className="text-sm font-semibold text-gray-200">{systemInfo?.uptime || '--'}</p>
          </div>
        </div>
      </div>

      {/* Reboot Confirmation Modal */}
      {showRebootModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Power className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-100">Reboot Headset?</h3>
            </div>
            <p className="text-sm text-gray-300">
              Your Meta Quest will restart now. The USB connection will be interrupted until the
              headset boots back up.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRebootModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRebootModal(false);
                  reboot();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-red-900/30"
              >
                Reboot Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
