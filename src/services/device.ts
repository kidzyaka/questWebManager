import { ShellService } from './shell';
import type { AdbSession } from '../adb/session';

export interface BatteryInfo {
  level: number;
  isCharging: boolean;
  temperature: number; // In Celsius
  statusText: string;
}

export interface StorageInfo {
  total: string;
  used: string;
  free: string;
  percent: number;
}

export interface SystemInfo {
  model: string;
  androidVersion: string;
  buildId: string;
  uptime: string;
}

export class DeviceService {
  private shell: ShellService;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
  }

  async getBattery(): Promise<BatteryInfo> {
    try {
      const res = await this.shell.exec('dumpsys battery', 5000);
      const out = res.stdout;

      const levelMatch = out.match(/level:\s*(\d+)/i);
      const tempMatch = out.match(/temperature:\s*(\d+)/i);
      const statusMatch = out.match(/status:\s*(\d+)/i);
      const acMatch = out.match(/AC powered:\s*(true|false)/i);
      const usbMatch = out.match(/USB powered:\s*(true|false)/i);
      const wirelessMatch = out.match(/Wireless powered:\s*(true|false)/i);

      const level = levelMatch ? parseInt(levelMatch[1], 10) : 100;
      // temperature in dumpsys battery is in tenths of degree Celsius (e.g. 315 -> 31.5°C)
      const rawTemp = tempMatch ? parseInt(tempMatch[1], 10) : 300;
      const temperature = Math.round(rawTemp / 10);

      const isPlugged =
        (acMatch && acMatch[1].toLowerCase() === 'true') ||
        (usbMatch && usbMatch[1].toLowerCase() === 'true') ||
        (wirelessMatch && wirelessMatch[1].toLowerCase() === 'true');

      const rawStatus = statusMatch ? parseInt(statusMatch[1], 10) : 0;
      let statusText = 'Discharging';
      if (rawStatus === 2 || isPlugged) statusText = 'Charging';
      if (rawStatus === 5) statusText = 'Full';

      return {
        level,
        isCharging: Boolean(isPlugged || rawStatus === 2),
        temperature,
        statusText,
      };
    } catch (err) {
      console.warn('Failed to get battery info:', err);
      return {
        level: 100,
        isCharging: false,
        temperature: 28,
        statusText: 'Unknown',
      };
    }
  }

  async getStorage(): Promise<StorageInfo> {
    try {
      const res = await this.shell.exec('df -h /sdcard', 5000);
      const lines = res.stdout.trim().split('\n');

      // Header is usually: Filesystem Size Used Avail Use% Mounted on
      // Line 2 contains values
      if (lines.length >= 2) {
        const parts = lines[1].trim().split(/\s+/);
        if (parts.length >= 5) {
          const total = parts[1];
          const used = parts[2];
          const free = parts[3];
          const percentStr = parts[4].replace('%', '');
          const percent = parseInt(percentStr, 10) || 0;

          return { total, used, free, percent };
        }
      }

      return { total: '128G', used: '24G', free: '104G', percent: 18 };
    } catch (err) {
      console.warn('Failed to get storage info:', err);
      return { total: 'N/A', used: 'N/A', free: 'N/A', percent: 0 };
    }
  }

  async getSystemInfo(fallbackModel = 'Meta Quest'): Promise<SystemInfo> {
    try {
      const res = await this.shell.exec(
        'getprop ro.product.model; getprop ro.build.version.release; getprop ro.build.display.id; cat /proc/uptime',
        5000
      );

      const lines = res.stdout.trim().split('\n');
      const model = lines[0]?.trim() || fallbackModel;
      const androidVersion = lines[1]?.trim() || 'Android 12';
      const buildId = lines[2]?.trim() || 'Unknown Build';

      // Uptime
      let uptime = 'N/A';
      if (lines[3]) {
        const seconds = parseFloat(lines[3].trim().split(' ')[0]);
        if (!isNaN(seconds)) {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          if (hours > 24) {
            const days = Math.floor(hours / 24);
            uptime = `${days}d ${hours % 24}h ${minutes}m`;
          } else if (hours > 0) {
            uptime = `${hours}h ${minutes}m`;
          } else {
            uptime = `${minutes}m`;
          }
        }
      }

      return {
        model,
        androidVersion,
        buildId,
        uptime,
      };
    } catch (err) {
      console.warn('Failed to get system info:', err);
      return {
        model: fallbackModel,
        androidVersion: 'Android',
        buildId: 'N/A',
        uptime: 'N/A',
      };
    }
  }

  async reboot(target: 'normal' | 'recovery' | 'bootloader' = 'normal'): Promise<void> {
    const cmd = target === 'normal' ? 'reboot' : `reboot ${target}`;
    try {
      await this.shell.exec(cmd, 3000);
    } catch (e) {
      // Device immediately disconnects on reboot, so socket close or timeout is expected
      console.log('Reboot initiated:', e);
    }
  }
}
