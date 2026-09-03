import React from 'react';
import { Settings, FolderOpen, Package, RefreshCw, Activity, CheckCircle2, Info, Usb, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useStore } from './store';
import { StatusTab } from '../ui/tabs/StatusTab';

export const App: React.FC = () => {
  const { status, connect, disconnect } = useStore();
  const isSupported = 'usb' in navigator;

  return (
    <div className="min-h-screen flex bg-gray-950 text-gray-100 relative pt-0">
      {!isSupported && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-500/10 text-red-400 p-3 flex items-center justify-center gap-3 border-b border-red-500/20 backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            Your browser is not supported. WebUSB is required for this application to function. Please use a Chromium-based browser (like Google Chrome or Microsoft Edge).
          </p>
        </div>
      )}

      {/* Sidebar / Tabs */}
      <nav className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">Device</div>
        <button className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${status === 'connected' ? 'bg-gray-800 text-gray-200' : 'text-gray-500 opacity-50 cursor-not-allowed'}`}>
          <Activity className="w-5 h-5 text-gray-400" />
          Status
        </button>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-2">Management</div>
        <button className="flex items-center gap-3 px-3 py-2 text-gray-500 opacity-50 cursor-not-allowed rounded-md">
          <FolderOpen className="w-5 h-5" />
          File Manager
        </button>
        <button className="flex items-center gap-3 px-3 py-2 text-gray-500 opacity-50 cursor-not-allowed rounded-md">
          <Package className="w-5 h-5" />
          Apps (APK)
        </button>
        <button className="flex items-center gap-3 px-3 py-2 text-gray-500 opacity-50 cursor-not-allowed rounded-md">
          <Settings className="w-5 h-5" />
          Settings
        </button>

        {/* Connection Status (Bottom Left) */}
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between px-3 py-2.5 bg-gray-950/50 rounded-md border border-gray-800/50">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              {status === 'connected' ? (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              ) : status === 'authorizing' || status === 'connecting' ? (
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse"></span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
              )}
              <span className="font-medium capitalize">{status}</span>
            </div>
            {status === 'connected' && (
              <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-300">Disconnect</button>
            )}
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {status === 'connected' ? (
          <div className="max-w-4xl mx-auto mt-2">
            <StatusTab />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-8 mt-4">
            <div className={`flex flex-col items-center justify-center p-10 border rounded-lg mb-8 transition-colors ${
                status === 'authorizing' ? 'bg-yellow-950/20 border-yellow-900/50' : 'bg-gray-950 border-gray-800'
              }`}>
                {status === 'authorizing' ? (
                  <>
                    <ShieldAlert className="w-12 h-12 mb-5 text-yellow-500 animate-pulse" />
                    <p className="font-medium text-lg text-yellow-200 mb-2">Check your Headset</p>
                    <p className="text-sm text-yellow-500/80 mb-0 text-center max-w-md">Please put on your headset and accept the <strong>"Allow USB debugging"</strong> prompt to continue.</p>
                  </>
                ) : (
                  <>
                    <Usb className="w-12 h-12 mb-5 text-gray-500 opacity-80" />
                    <p className="font-medium text-lg text-gray-200 mb-2">
                      {status === 'connecting' ? 'Connecting...' : 'Waiting for connection'}
                    </p>
                    <p className="text-sm text-gray-500 mb-6 text-center max-w-md">Connect your headset via USB cable. Ensure it is powered on and awake.</p>

                    <button 
                      onClick={connect}
                      disabled={status === 'connecting' || !isSupported}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-md transition-colors flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20"
                    >
                      <RefreshCw className={`w-4 h-4 ${status === 'connecting' ? 'animate-spin' : ''}`} />
                      {status === 'connecting' ? 'Connecting...' : 'Connect Device'}
                    </button>
                  </>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  How to enable Developer Mode
                </h3>

                <div className="flex gap-3 items-start bg-blue-900/20 border border-blue-800/30 p-4 rounded-md mb-5 text-sm text-blue-200">
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-300 mb-1">Prerequisite: Developer Status</p>
                    <p>Before the option appears in your app, you must register as a Meta developer and verify your account. Go to the <a href="https://developers.meta.com/horizon/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">Meta Horizon Developer Dashboard</a> to create your organization.</p>
                  </div>
                </div>

                <ol className="list-decimal list-inside space-y-3 text-sm text-gray-300">
                  <li>Open the <strong>Meta Horizon</strong> app on your phone.</li>
                  <li>Go to <strong>Menu &gt; Devices</strong> and select your headset.</li>
                  <li>Navigate to <strong>Headset Settings &gt; Developer Mode</strong>.</li>
                  <li>Toggle <strong>Developer Mode</strong> on.</li>
                  <li>Connect the headset to this PC using a USB cable.</li>
                  <li>Put on your headset and accept the <strong>"Allow USB debugging"</strong> prompt (check "Always allow from this computer" to avoid prompts in the future).</li>
                </ol>
              </div>
            </div>
          )}
      </main>
    </div>
  );
};
