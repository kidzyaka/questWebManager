import React from 'react';
import {
  Settings,
  FolderOpen,
  Package,
  RefreshCw,
  Activity,
  CheckCircle2,
  Info,
  Usb,
  ShieldAlert,
  AlertTriangle,
  Image,
} from 'lucide-react';
import { useStore } from './store';
import { StatusTab } from '../ui/tabs/StatusTab';
import { FilesTab } from '../ui/tabs/FilesTab';
import { AppsTab } from '../ui/tabs/AppsTab';
import { SettingsTab } from '../ui/tabs/SettingsTab';
import { MediaTab } from '../ui/tabs/MediaTab';

export const App: React.FC = () => {
  const { status, activeTab, setActiveTab, connect, disconnect } = useStore();
  const isSupported = 'usb' in navigator;
  const isConnected = status === 'connected';

  return (
    <div className="min-h-screen flex bg-neutral-950 text-neutral-100 relative pt-0 font-sans">
      {!isSupported && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-950/80 text-red-300 p-3 flex items-center justify-center gap-3 border-b border-red-900/50 backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <p className="text-sm font-medium">
            Your browser is not supported. WebUSB is required for this application to function. Please use a Chromium-based browser (like Google Chrome or Microsoft Edge).
          </p>
        </div>
      )}

      {/* Sidebar / Tabs */}
      <nav className="w-64 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col gap-1.5">
        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-2 px-2">
          Device
        </div>
        <button
          onClick={() => isConnected && setActiveTab('status')}
          disabled={!isConnected}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            !isConnected
              ? 'text-neutral-600 opacity-50 cursor-not-allowed'
              : activeTab === 'status'
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
              : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Status
        </button>

        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mt-6 mb-2 px-2">
          Management
        </div>
        <button
          onClick={() => isConnected && setActiveTab('files')}
          disabled={!isConnected}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            !isConnected
              ? 'text-neutral-600 opacity-50 cursor-not-allowed'
              : activeTab === 'files'
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
              : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          File Manager
        </button>

        <button
          onClick={() => isConnected && setActiveTab('media')}
          disabled={!isConnected}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            !isConnected
              ? 'text-neutral-600 opacity-50 cursor-not-allowed'
              : activeTab === 'media'
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
              : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
          }`}
        >
          <Image className="w-4 h-4" />
          Media Gallery
        </button>

        <button
          onClick={() => isConnected && setActiveTab('apps')}
          disabled={!isConnected}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            !isConnected
              ? 'text-neutral-600 opacity-50 cursor-not-allowed'
              : activeTab === 'apps'
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
              : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Apps (APK)
        </button>

        <button
          onClick={() => isConnected && setActiveTab('settings')}
          disabled={!isConnected}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            !isConnected
              ? 'text-neutral-600 opacity-50 cursor-not-allowed'
              : activeTab === 'settings'
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
              : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        {/* Connection Status (Bottom Left) */}
        <div className="mt-auto pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2.5 text-xs text-neutral-400">
              {isConnected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
              ) : status === 'authorizing' || status === 'connecting' ? (
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] animate-pulse"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></span>
              )}
              <span className="font-medium capitalize">{status}</span>
            </div>
            {isConnected && (
              <button
                onClick={disconnect}
                className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {isConnected ? (
          <div className="max-w-5xl mx-auto mt-2">
            {activeTab === 'status' && <StatusTab />}
            {activeTab === 'files' && <FilesTab />}
            {activeTab === 'media' && <MediaTab />}
            {activeTab === 'apps' && <AppsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-neutral-900 rounded-xl border border-neutral-800 p-8 mt-6">
            <div
              className={`flex flex-col items-center justify-center p-10 border rounded-xl mb-8 transition-colors ${
                status === 'authorizing'
                  ? 'bg-amber-950/20 border-amber-900/40'
                  : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              {status === 'authorizing' ? (
                <>
                  <ShieldAlert className="w-10 h-10 mb-4 text-amber-400 animate-pulse" />
                  <p className="font-medium text-base text-amber-200 mb-1">Check your Headset</p>
                  <p className="text-xs text-amber-400/80 text-center max-w-sm">
                    Please put on your headset and accept the <strong>"Allow USB debugging"</strong>{' '}
                    prompt to continue.
                  </p>
                </>
              ) : (
                <>
                  <Usb className="w-10 h-10 mb-4 text-neutral-500" />
                  <p className="font-medium text-base text-neutral-200 mb-1">
                    {status === 'connecting' ? 'Connecting...' : 'Waiting for connection'}
                  </p>
                  <p className="text-xs text-neutral-500 mb-6 text-center max-w-sm">
                    Connect your headset via USB cable. Ensure it is powered on and awake.
                  </p>

                  <button
                    onClick={connect}
                    disabled={status === 'connecting' || !isSupported}
                    className="bg-neutral-100 hover:bg-white text-neutral-900 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 font-medium text-sm shadow-sm"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`}
                    />
                    {status === 'connecting' ? 'Connecting...' : 'Connect Device'}
                  </button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neutral-400" />
                How to enable Developer Mode
              </h3>

              <div className="flex gap-3 items-start bg-neutral-900 border border-neutral-800 p-3.5 rounded-lg mb-4 text-xs text-neutral-300">
                <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-neutral-200 mb-0.5">
                    Prerequisite: Developer Status
                  </p>
                  <p className="text-neutral-400">
                    Before the option appears in your app, you must register as a Meta developer and
                    verify your account. Go to the{' '}
                    <a
                      href="https://developers.meta.com/horizon/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-200 underline font-medium hover:text-white"
                    >
                      Meta Horizon Developer Dashboard
                    </a>{' '}
                    to create your organization.
                  </p>
                </div>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-xs text-neutral-400 leading-relaxed">
                <li>Open the <strong className="text-neutral-300">Meta Horizon</strong> app on your phone.</li>
                <li>Go to <strong className="text-neutral-300">Menu &gt; Devices</strong> and select your headset.</li>
                <li>Navigate to <strong className="text-neutral-300">Headset Settings &gt; Developer Mode</strong>.</li>
                <li>Toggle <strong className="text-neutral-300">Developer Mode</strong> on.</li>
                <li>Connect the headset to this PC using a USB cable.</li>
                <li>
                  Put on your headset and accept the <strong className="text-neutral-300">"Allow USB debugging"</strong> prompt
                  (check "Always allow from this computer" to avoid prompts in the future).
                </li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
