import { create } from 'zustand';
import { AdbSession } from '../adb/session';
import { DeviceService, BatteryInfo, StorageInfo, SystemInfo } from '../services/device';

type ConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected';

type AppState = {
  status: ConnectionStatus;
  deviceInfo: string | null;
  session: AdbSession | null;
  deviceService: DeviceService | null;

  battery: BatteryInfo | null;
  storage: StorageInfo | null;
  systemInfo: SystemInfo | null;
  isLoadingStats: boolean;
  isRebooting: boolean;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchStats: () => Promise<void>;
  reboot: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  status: 'disconnected',
  deviceInfo: null,
  session: null,
  deviceService: null,

  battery: null,
  storage: null,
  systemInfo: null,
  isLoadingStats: false,
  isRebooting: false,

  connect: async () => {
    try {
      set({ status: 'connecting' });
      const session = new AdbSession();

      // Listen to internal transport disconnection
      session.onDisconnect(() => {
        set({
          status: 'disconnected',
          session: null,
          deviceService: null,
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

      set({
        status: 'connected',
        session,
        deviceService,
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
      session: null,
      deviceService: null,
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
      // Disconnect cleanly
      get().disconnect();
      set({ isRebooting: false });
    }
  },
}));
