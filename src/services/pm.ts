import type { AdbSession } from '../adb/session';
import { ShellService } from './shell';
import { AdbSync } from '../adb/sync';

export interface AppPackage {
  packageName: string;
  apkPath: string;
  isSystem: boolean;
}

export interface InstallReport {
  success: boolean;
  message: string;
}

export class PmService {
  private shell: ShellService;
  private sync: AdbSync;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
    this.sync = new AdbSync(session);
  }

  /**
   * Lists all installed packages on the Quest
   */
  async listPackages(): Promise<AppPackage[]> {
    const res = await this.shell.exec('pm list packages -f', 10000);
    const lines = res.stdout.split('\n');
    const apps: AppPackage[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('package:')) continue;

      const content = line.substring('package:'.length);
      const lastEqual = content.lastIndexOf('=');
      if (lastEqual === -1) continue;

      const apkPath = content.substring(0, lastEqual);
      const packageName = content.substring(lastEqual + 1);

      // In Android, apps stored in /data/app/ are user-installed (third-party)
      const isSystem = !apkPath.startsWith('/data/app');

      apps.push({
        packageName,
        apkPath,
        isSystem,
      });
    }

    // Sort alphabetically by package name
    return apps.sort((a, b) => a.packageName.localeCompare(b.packageName));
  }

  /**
   * Sideloads an APK onto the Quest
   */
  async installApk(
    file: File | Blob,
    filename: string,
    onProgress?: (stage: 'uploading' | 'installing', progress: number) => void
  ): Promise<InstallReport> {
    const stagingDir = '/data/local/tmp/qwm';
    await this.shell.exec(`mkdir -p "${stagingDir}"`);

    const sanitizedName = filename.replace(/[/\\:*?"<>|]/g, '_');
    const remotePath = `${stagingDir}/${Date.now()}_${sanitizedName}`;

    try {
      // Stage 1: Upload APK to staging
      onProgress?.('uploading', 0);
      await this.sync.push(file, remotePath, (sent, total) => {
        const pct = Math.round((sent / total) * 100);
        onProgress?.('uploading', pct);
      });

      // Stage 2: Install via pm
      onProgress?.('installing', 100);
      const res = await this.shell.exec(`pm install -r -d "${remotePath}"`, 120000);

      const out = res.stdout.trim();
      if (out.includes('Success')) {
        return { success: true, message: 'APK installed successfully!' };
      }

      // Parse common install failures
      const failureMatch = out.match(/Failure\s*\[([^\]]+)\]/i);
      const errCode = failureMatch ? failureMatch[1] : out;
      return { success: false, message: `Installation failed: ${errCode}` };
    } finally {
      // Clean up staged APK
      try {
        await this.shell.exec(`rm -f "${remotePath}"`);
      } catch (e) {
        console.warn('Failed to clean up temporary APK:', e);
      }
    }
  }

  /**
   * Uninstalls an app
   */
  async uninstall(packageName: string, isSystem = false): Promise<void> {
    const cmd = isSystem ? `pm uninstall --user 0 "${packageName}"` : `pm uninstall "${packageName}"`;
    const res = await this.shell.exec(cmd, 15000);
    if (!res.stdout.includes('Success')) {
      throw new Error(`Uninstall failed: ${res.stdout}`);
    }
  }

  /**
   * Launches an app by package name
   */
  async launch(packageName: string): Promise<void> {
    await this.shell.exec(`monkey -p "${packageName}" -c android.intent.category.LAUNCHER 1`);
  }

  /**
   * Force stops an app
   */
  async forceStop(packageName: string): Promise<void> {
    await this.shell.exec(`am force-stop "${packageName}"`);
  }
}
