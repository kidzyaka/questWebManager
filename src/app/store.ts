import { create } from 'zustand';
import { AdbSession } from '../adb/session';

type ConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected';

type AppState = {
  status: ConnectionStatus;
  deviceInfo: string | null;
  session: AdbSession | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  status: 'disconnected',
  deviceInfo: null,
  session: null,

  connect: async () => {
    try {
      set({ status: 'connecting' });
      const session = new AdbSession();
      await session.connect(() => {
        // Callback when ADB asks for RSA Public Key and waits for user
        set({ status: 'authorizing' });
      });
      set({ 
        status: 'connected', 
        session,
        deviceInfo: session.deviceInfo 
      });
    } catch (e: any) {
      console.error('Connection failed:', e);
      alert(`Connection failed: ${e.message}`);
      set({ status: 'disconnected', session: null, deviceInfo: null });
    }
  },

  disconnect: async () => {
    const { session } = get();
    if (session) {
      await session.disconnect();
    }
    set({ status: 'disconnected', session: null, deviceInfo: null });
  }
}));
