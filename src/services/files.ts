import type { AdbSession } from '../adb/session';
import { ShellService } from './shell';
import { AdbSync } from '../adb/sync';

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  size: number;
  formattedSize: string;
  date: string;
  permissions: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export class FilesService {
  private shell: ShellService;
  private sync: AdbSync;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
    this.sync = new AdbSync(session);
  }

  /**
   * Lists files in a given directory on the Quest
   */
  async listFiles(dirPath: string): Promise<FileEntry[]> {
    const cleanPath = dirPath.replace(/\/+$/, '') || '/';
    const res = await this.shell.exec(`ls -la "${cleanPath}"`, 8000);

    const lines = res.stdout.split('\n');
    const entries: FileEntry[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('total ')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 7) continue;

      const permissions = parts[0];
      const isDir = permissions.startsWith('d');
      const isSymlink = permissions.startsWith('l');

      // In toybox/Android ls -la:
      // permissions links owner group size date time/year name...
      // e.g.: -rw-rw---- 1 root sdcard_rw 12345 2026-08-15 12:34 file.txt
      const sizeIndex = isSymlink || isDir ? 4 : 4;
      const size = parseInt(parts[sizeIndex], 10) || 0;

      // Name is everything after the date/time fields
      // Usually date is parts[5] and parts[6]
      let nameIndex = 7;
      let date = `${parts[5] || ''} ${parts[6] || ''}`.trim();

      // Some Android builds have an extra SELinux column or different column count
      // Check if parts[4] is group and parts[5] is size:
      if (isNaN(size) && parts.length > 7) {
        const altSize = parseInt(parts[5], 10);
        if (!isNaN(altSize)) {
          date = `${parts[6] || ''} ${parts[7] || ''}`.trim();
          nameIndex = 8;
        }
      }

      let name = parts.slice(nameIndex).join(' ');
      if (!name) continue;

      // Skip current and parent dir markers
      if (name === '.' || name === '..') continue;

      // If symlink, strip target (e.g. "sdcard -> /storage/emulated/0")
      if (isSymlink && name.includes(' -> ')) {
        name = name.split(' -> ')[0];
      }

      const fullPath = cleanPath === '/' ? `/${name}` : `${cleanPath}/${name}`;

      entries.push({
        name,
        path: fullPath,
        isDir,
        isSymlink,
        size,
        formattedSize: isDir ? '--' : formatFileSize(size),
        date,
        permissions,
      });
    }

    // Sort: directories first, then alphabetically
    return entries.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  /**
   * Creates a new folder
   */
  async createFolder(parentPath: string, folderName: string): Promise<void> {
    const sanitized = folderName.replace(/[/\\:*?"<>|]/g, '_').trim();
    if (!sanitized) throw new Error('Invalid folder name');

    const cleanParent = parentPath.replace(/\/+$/, '');
    const targetPath = `${cleanParent}/${sanitized}`;

    const res = await this.shell.exec(`mkdir -p "${targetPath}"`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to create directory: ${res.stdout}`);
    }
  }

  /**
   * Deletes a file or directory
   */
  async deleteEntry(targetPath: string): Promise<void> {
    const clean = targetPath.trim().replace(/\/+$/, '');
    // Safety guard against root or top level deletions
    if (!clean || clean === '/' || clean === '/sdcard' || clean === '/system' || clean === '/data') {
      throw new Error('Refusing to delete critical root path');
    }

    const res = await this.shell.exec(`rm -rf "${clean}"`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to delete: ${res.stdout}`);
    }
  }

  /**
   * Renames / moves a file or directory
   */
  async renameEntry(oldPath: string, newName: string): Promise<void> {
    const sanitized = newName.replace(/[/\\:*?"<>|]/g, '_').trim();
    if (!sanitized) throw new Error('Invalid name');

    const lastSlash = oldPath.lastIndexOf('/');
    const parentDir = lastSlash > 0 ? oldPath.substring(0, lastSlash) : '/';
    const newPath = parentDir === '/' ? `/${sanitized}` : `${parentDir}/${sanitized}`;

    const res = await this.shell.exec(`mv "${oldPath}" "${newPath}"`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to rename: ${res.stdout}`);
    }
  }

  /**
   * Uploads a file via Sync push
   */
  async uploadFile(
    file: File | Blob,
    remotePath: string,
    onProgress?: (sent: number, total: number) => void
  ): Promise<void> {
    await this.sync.push(file, remotePath, onProgress);
  }

  /**
   * Downloads a file via Sync pull and triggers browser download
   */
  async downloadFile(
    remotePath: string,
    fileName: string,
    onProgress?: (received: number) => void
  ): Promise<void> {
    const bytes = await this.sync.pull(remotePath, onProgress);
    const blob = new Blob([bytes as any]);
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60000);
  }
}
