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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-neutral-100">
              {systemInfo?.model || 'Meta Quest Device'}
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/40 border border-emerald-800/60 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-mono">{deviceInfo}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats()}
            disabled={isLoadingStats}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin text-neutral-300' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowRebootModal(true)}
            disabled={isRebooting}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-red-950/60 hover:border-red-900/50 hover:text-red-300 border border-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            Reboot
          </button>
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Battery Card */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 text-neutral-300 font-medium text-sm">
              {isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className="w-4 h-4 text-neutral-400" />
              )}
              <span>Battery</span>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isCharging
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
              }`}
            >
              {battery?.statusText || (isCharging ? 'Charging' : 'Discharging')}
            </span>
          </div>

          <div className="flex items-baseline gap-3 my-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-100">
              {battery ? `${batteryLevel}%` : '--'}
            </span>
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-neutral-500" />
              {temp > 0 ? `${temp}°C` : 'Normal'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-950 rounded-full h-2 mt-4 overflow-hidden border border-neutral-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                batteryLevel > 20 ? 'bg-neutral-200' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(5, Math.min(100, batteryLevel))}%` }}
            ></div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 text-neutral-300 font-medium text-sm">
              <HardDrive className="w-4 h-4 text-neutral-400" />
              <span>Storage (/sdcard)</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
              {storage ? `${storage.free} free` : '--'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-100">
              {storage ? `${storage.used}` : '--'}
            </span>
            <span className="text-xs text-neutral-400">used of {storage?.total || '--'}</span>
          </div>

          {/* Storage Bar */}
          <div className="w-full bg-neutral-950 rounded-full h-2 mt-4 overflow-hidden border border-neutral-800">
            <div
              className="h-2 rounded-full bg-neutral-200 transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, storage?.percent ?? 20))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* System Information Card */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5 text-neutral-300 font-medium text-sm mb-4">
          <Cpu className="w-4 h-4 text-neutral-400" />
          <span>System Information</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-neutral-950 border border-neutral-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <Layers className="w-3.5 h-3.5" />
              Android Version
            </div>
            <p className="text-sm font-semibold text-neutral-200">
              {systemInfo?.androidVersion || 'Android'}
            </p>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Build ID
            </div>
            <p className="text-sm font-semibold text-neutral-200 truncate font-mono">
              {systemInfo?.buildId || 'N/A'}
            </p>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <Clock className="w-3.5 h-3.5" />
              Uptime
            </div>
            <p className="text-sm font-semibold text-neutral-200">{systemInfo?.uptime || '--'}</p>
          </div>
        </div>
      </div>

      {/* Reboot Confirmation Modal */}
      {showRebootModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Power className="w-5 h-5" />
              <h3 className="text-base font-bold text-neutral-100">Reboot Headset?</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Your Meta Quest will restart now. The USB connection will be interrupted until the
              headset boots back up.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRebootModal(false)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition-colors border border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRebootModal(false);
                  reboot();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
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
