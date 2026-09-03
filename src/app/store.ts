import { create } from 'zustand';
import { AdbSession } from '../adb/session';
import { DeviceService, BatteryInfo, StorageInfo, SystemInfo } from '../services/device';
import { FilesService } from '../services/files';
import { PmService } from '../services/pm';

type ConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected';
export type TabType = 'status' | 'files' | 'apps' | 'settings';

type AppState = {
  status: ConnectionStatus;
  activeTab: TabType;
  deviceInfo: string | null;
  session: AdbSession | null;
  deviceService: DeviceService | null;
  filesService: FilesService | null;
  pmService: PmService | null;

  battery: BatteryInfo | null;
  storage: StorageInfo | null;
  systemInfo: SystemInfo | null;
  isLoadingStats: boolean;
  isRebooting: boolean;

  setActiveTab: (tab: TabType) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchStats: () => Promise<void>;
  reboot: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  status: 'disconnected',
  activeTab: 'status',
  deviceInfo: null,
  session: null,
  deviceService: null,
  filesService: null,
  pmService: null,

  battery: null,
  storage: null,
  systemInfo: null,
  isLoadingStats: false,
  isRebooting: false,

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

      set({
        status: 'connected',
        activeTab: 'status',
        session,
        deviceService,
        filesService,
        pmService,
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

  reboot: async () => {
    const { deviceService } = get();
    if (!deviceService) return;

    set({ isRebooting: true });
    try {
      await deviceService.reboot('normal');
    } finally {
      get().disconnect();
      set({ isRebooting: false });
    }
  },
}));
