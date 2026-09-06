import { create } from 'zustand';
import { AdbSession } from '../adb/session';
import { DeviceService, BatteryInfo, StorageInfo, SystemInfo } from '../services/device';
import { FilesService } from '../services/files';
import { PmService } from '../services/pm';
import { SettingsService } from '../services/settings';
import { PowerService } from '../services/power';

type ConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected';
export type TabType = 'status' | 'files' | 'apps' | 'settings';

export interface SettingPreset {
  id: string;
  name: string;
  timestamp: number;
  values: Record<string, string>;
}

const PRESETS_STORAGE_KEY = 'qwm_settings_presets';

function loadPresetsFromStorage(): SettingPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: SettingPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets to localStorage:', e);
  }
}

type AppState = {
  status: ConnectionStatus;
  activeTab: TabType;
  deviceInfo: string | null;
  session: AdbSession | null;
  deviceService: DeviceService | null;
  filesService: FilesService | null;
  pmService: PmService | null;
  settingsService: SettingsService | null;
  powerService: PowerService | null;

  battery: BatteryInfo | null;
  storage: StorageInfo | null;
  systemInfo: SystemInfo | null;
  isLoadingStats: boolean;
  isRebooting: boolean;

  presets: SettingPreset[];

  setActiveTab: (tab: TabType) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchStats: () => Promise<void>;
  reboot: (target?: 'normal' | 'recovery' | 'bootloader') => Promise<void>;
  shutdown: () => Promise<void>;
  savePreset: (name: string, values: Record<string, string>) => void;
  deletePreset: (id: string) => void;
};

export const useStore = create<AppState>((set, get) => ({
  status: 'disconnected',
  activeTab: 'status',
  deviceInfo: null,
  session: null,
  deviceService: null,
  filesService: null,
  pmService: null,
  settingsService: null,
  powerService: null,

  battery: null,
  storage: null,
  systemInfo: null,
  isLoadingStats: false,
  isRebooting: false,

  presets: loadPresetsFromStorage(),

  setActiveTab: (activeTab) => set({ activeTab }),

  connect: async () => {
    try {
      set({ status: 'connecting' });
      const session = new AdbSession();

      // Listen to internal transport disconnection
      session.onDisconnect(() => {
        set({
          status: 'disconnected',
          activeTab: 'status',
          session: null,
          deviceService: null,
          filesService: null,
          pmService: null,
          settingsService: null,
          powerService: null,
          deviceInfo: null,
          battery: null,
          storage: null,
          systemInfo: null,
        });
      });

      // Also listen to browser native USB disconnect event
      if ('usb' in navigator) {
        const handleUsbDisconnect = (event: USBConnectionEvent) => {
          if (session.transport.device && event.device === session.transport.device) {
            session.disconnect();
            navigator.usb.removeEventListener('disconnect', handleUsbDisconnect);
          }
        };
        navigator.usb.addEventListener('disconnect', handleUsbDisconnect);
      }

      await session.connect(() => {
        set({ status: 'authorizing' });
      });

      const deviceService = new DeviceService(session);
      const filesService = new FilesService(session);
      const pmService = new PmService(session);
      const settingsService = new SettingsService(session);
      const powerService = new PowerService(session);

      set({
        status: 'connected',
        activeTab: 'status',
        session,
        deviceService,
        filesService,
        pmService,
        settingsService,
        powerService,
        deviceInfo: session.deviceInfo,
      });

      // Auto-fetch device stats upon successful connection
      get().fetchStats();
    } catch (e: any) {
      console.error('Connection failed:', e);
      alert(`Connection failed: ${e.message}`);
      set({
        status: 'disconnected',
        session: null,
        deviceService: null,
        filesService: null,
        pmService: null,
        settingsService: null,
        powerService: null,
        deviceInfo: null,
      });
    }
  },

  disconnect: async () => {
    const { session } = get();
    if (session) {
      await session.disconnect();
    }
    set({
      status: 'disconnected',
      activeTab: 'status',
      session: null,
      deviceService: null,
      filesService: null,
      pmService: null,
      settingsService: null,
      powerService: null,
      deviceInfo: null,
      battery: null,
      storage: null,
      systemInfo: null,
    });
  },

  fetchStats: async () => {
    const { deviceService, status } = get();
    if (!deviceService || status !== 'connected') return;

    set({ isLoadingStats: true });
    try {
      const [battery, storage, systemInfo] = await Promise.all([
        deviceService.getBattery(),
        deviceService.getStorage(),
        deviceService.getSystemInfo(get().deviceInfo || 'Meta Quest'),
      ]);

      set({
        battery,
        storage,
        systemInfo,
        isLoadingStats: false,
      });
    } catch (err) {
      console.error('Error fetching device stats:', err);
      set({ isLoadingStats: false });
    }
  },

  reboot: async (target = 'normal') => {
    const { powerService } = get();
    if (!powerService) return;

    set({ isRebooting: true });
    try {
      await powerService.reboot(target);
    } finally {
      get().disconnect();
      set({ isRebooting: false });
    }
  },

  shutdown: async () => {
    const { powerService } = get();
    if (!powerService) return;

    set({ isRebooting: true });
    try {
      await powerService.shutdown();
    } finally {
      get().disconnect();
      set({ isRebooting: false });
    }
  },

  savePreset: (name, values) => {
    const newPreset: SettingPreset = {
      id: 'preset_' + Date.now(),
      name,
      timestamp: Date.now(),
      values,
    };
    const updated = [newPreset, ...get().presets];
    set({ presets: updated });
    savePresetsToStorage(updated);
  },

  deletePreset: (id) => {
    const updated = get().presets.filter((p) => p.id !== id);
    set({ presets: updated });
    savePresetsToStorage(updated);
  },
}));
