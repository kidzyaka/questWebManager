import type { AdbSession } from '../adb/session';
import { ShellService } from './shell';

export type RebootTarget = 'normal' | 'recovery' | 'bootloader';

export class PowerService {
  private shell: ShellService;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
  }

  /**
   * Reboots the headset into a specified mode
   */
  async reboot(target: RebootTarget = 'normal'): Promise<void> {
    const cmd = target === 'normal' ? 'reboot' : `reboot ${target}`;
    try {
      await this.shell.exec(cmd, 4000);
    } catch (e) {
      // Immediate disconnection is expected upon reboot command execution
      console.log(`Reboot (${target}) command sent, device is restarting:`, e);
    }
  }

  /**
   * Powers off the headset completely
   */
  async shutdown(): Promise<void> {
    try {
      // Try shutdown -p first, then fallback to poweroff
      await this.shell.exec('shutdown -p || poweroff', 4000);
    } catch (e) {
      console.log('Shutdown command sent, device is powering down:', e);
    }
  }
}
