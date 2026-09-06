import type { AdbSession } from '../adb/session';
import { ShellService } from './shell';

export type SettingsCategory = 'global' | 'system' | 'secure';

export interface SettingsSnapshot {
  timestamp: number;
  global: Record<string, string>;
  system: Record<string, string>;
  secure: Record<string, string>;
}

export interface SettingDiff {
  category: SettingsCategory;
  key: string;
  oldValue?: string;
  newValue?: string;
  type: 'added' | 'removed' | 'modified';
}

/**
 * Parses stdout from `settings list <category>` into a key-value dictionary
 */
export function parseSettingsList(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = output.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

/**
 * Compares two snapshots and returns all differences
 */
export function diffSettingsSnapshots(
  before: SettingsSnapshot,
  after: SettingsSnapshot
): SettingDiff[] {
  const diffs: SettingDiff[] = [];
  const categories: SettingsCategory[] = ['global', 'system', 'secure'];

  for (const cat of categories) {
    const bMap = before[cat] || {};
    const aMap = after[cat] || {};
    const allKeys = new Set([...Object.keys(bMap), ...Object.keys(aMap)]);

    for (const key of allKeys) {
      const oldVal = bMap[key];
      const newVal = aMap[key];

      if (oldVal === undefined && newVal !== undefined) {
        diffs.push({ category: cat, key, newValue: newVal, type: 'added' });
      } else if (oldVal !== undefined && newVal === undefined) {
        diffs.push({ category: cat, key, oldValue: oldVal, type: 'removed' });
      } else if (oldVal !== newVal) {
        diffs.push({ category: cat, key, oldValue: oldVal, newValue: newVal, type: 'modified' });
      }
    }
  }

  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

export class SettingsService {
  private shell: ShellService;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
  }

  /**
   * Reads a single setting value
   */
  async get(category: SettingsCategory, key: string): Promise<string> {
    const res = await this.shell.exec(`settings get ${category} "${key}"`, 5000);
    const val = res.stdout.trim();
    // Android returns "null" if key does not exist
    return val === 'null' ? '' : val;
  }

  /**
   * Writes a setting value
   */
  async put(category: SettingsCategory, key: string, value: string): Promise<void> {
    const res = await this.shell.exec(`settings put ${category} "${key}" "${value}"`, 5000);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to set ${category}.${key}: ${res.stdout}`);
    }
  }

  /**
   * Lists all settings in a category
   */
  async list(category: SettingsCategory): Promise<Record<string, string>> {
    const res = await this.shell.exec(`settings list ${category}`, 8000);
    return parseSettingsList(res.stdout);
  }

  /**
   * Captures a full snapshot of all settings across global, system, and secure
   */
  async snapshot(): Promise<SettingsSnapshot> {
    const [global, system, secure] = await Promise.all([
      this.list('global'),
      this.list('system'),
      this.list('secure'),
    ]);

    return {
      timestamp: Date.now(),
      global,
      system,
      secure,
    };
  }

  /**
   * Simulates an Android hardware keyevent (e.g. 24 = Volume Up, 25 = Volume Down)
   */
  async sendKeyEvent(keyCode: number): Promise<void> {
    await this.shell.exec(`input keyevent ${keyCode}`, 3000);
  }

  /**
   * Executes a direct shell command (for system toggles like connectivity or bluetooth)
   */
  async execRaw(command: string): Promise<string> {
    const res = await this.shell.exec(command, 5000);
    return res.stdout.trim();
  }
}
