import type { AdbSession } from '../adb/session';
import { ShellService } from './shell';
import { AdbSync } from '../adb/sync';

export interface MediaItem {
  name: string;
  path: string;
  type: 'photo' | 'video';
  size: number;
  formattedSize: string;
  date: string;
  /** Timestamp parsed from date for sorting, or 0 if unparseable */
  timestamp: number;
}

const PHOTO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov', 'avi'];

/** Standard Quest directories where screenshots/recordings are stored */
const MEDIA_DIRS = [
  '/sdcard/Oculus/Screenshots',
  '/sdcard/Oculus/VideoShots',
  '/sdcard/Oculus/ScreenRecordings',
  '/sdcard/Pictures',
  '/sdcard/DCIM',
  '/sdcard/Movies',
  '/sdcard/Pictures/Screenshots',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getExt(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

function parseTimestamp(dateStr: string): number {
  const t = Date.parse(dateStr.replace(/\s+/, 'T'));
  return isNaN(t) ? 0 : t;
}

export class MediaService {
  private shell: ShellService;
  private sync: AdbSync;

  constructor(session: AdbSession) {
    this.shell = new ShellService(session);
    this.sync = new AdbSync(session);
  }

  /**
   * Scans known Quest media directories and returns all photo/video items
   * sorted by date descending (newest first).
   */
  async scanMedia(): Promise<MediaItem[]> {
    const items: MediaItem[] = [];
    const seenPaths = new Set<string>();

    // Run a single find command across all directories for efficiency
    // Fall back gracefully if directories don't exist
    const findDirs = MEDIA_DIRS.map((d) => `"${d}"`).join(' ');
    const cmd = `find ${findDirs} -type f 2>/dev/null | head -2000`;

    const res = await this.shell.exec(cmd, 30000);
    const filePaths = res.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Now stat each file to get size and date
    // We batch them using ls -la on each unique directory for efficiency
    const dirFiles = new Map<string, string[]>();
    for (const fp of filePaths) {
      const ext = getExt(fp);
      if (!PHOTO_EXTENSIONS.includes(ext) && !VIDEO_EXTENSIONS.includes(ext)) continue;
      if (seenPaths.has(fp)) continue;
      seenPaths.add(fp);

      const lastSlash = fp.lastIndexOf('/');
      const dir = fp.substring(0, lastSlash) || '/';
      const fname = fp.substring(lastSlash + 1);
      if (!dirFiles.has(dir)) dirFiles.set(dir, []);
      dirFiles.get(dir)!.push(fname);
    }

    // For each directory, get file details
    for (const [dir, files] of dirFiles.entries()) {
      try {
        const lsRes = await this.shell.exec(`ls -la "${dir}"`, 15000);
        const lines = lsRes.stdout.split('\n');

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('total ')) continue;

          const parts = line.split(/\s+/);
          if (parts.length < 7) continue;

          const permissions = parts[0];
          if (permissions.startsWith('d')) continue; // Skip directories

          const size = parseInt(parts[4], 10) || 0;
          let nameIndex = 7;
          let date = `${parts[5] || ''} ${parts[6] || ''}`.trim();

          if (isNaN(parseInt(parts[4], 10)) && parts.length > 7) {
            const altSize2 = parseInt(parts[5], 10);
            if (!isNaN(altSize2)) {
              date = `${parts[6] || ''} ${parts[7] || ''}`.trim();
              nameIndex = 8;
            }
          }

          let name = parts.slice(nameIndex).join(' ');
          if (!name) continue;

          // Check if this file is in our list
          if (!files.includes(name)) continue;

          const ext = getExt(name);
          const isPhoto = PHOTO_EXTENSIONS.includes(ext);
          const isVideo = VIDEO_EXTENSIONS.includes(ext);
          if (!isPhoto && !isVideo) continue;

          const fullPath = `${dir}/${name}`;

          items.push({
            name,
            path: fullPath,
            type: isPhoto ? 'photo' : 'video',
            size,
            formattedSize: formatFileSize(size),
            date,
            timestamp: parseTimestamp(date),
          });
        }
      } catch (err) {
        console.warn(`Failed to scan directory ${dir}:`, err);
      }
    }

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }

  /**
   * Pulls a file from the device and returns it as a Blob with correct MIME type.
   */
  async pullAsBlob(
    remotePath: string,
    onProgress?: (received: number) => void,
    signal?: AbortSignal
  ): Promise<Blob> {
    const bytes = await this.sync.pull(remotePath, onProgress, signal);
    const ext = getExt(remotePath);
    let mime = 'application/octet-stream';

    if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'png') mime = 'image/png';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'bmp') mime = 'image/bmp';
    else if (ext === 'mp4') mime = 'video/mp4';
    else if (ext === 'mkv') mime = 'video/x-matroska';
    else if (ext === 'webm') mime = 'video/webm';
    else if (ext === 'mov') mime = 'video/quicktime';
    else if (ext === 'avi') mime = 'video/x-msvideo';

    return new Blob([bytes as any], { type: mime });
  }

  /**
   * Downloads a file and triggers browser download.
   */
  async downloadFile(
    remotePath: string,
    fileName: string,
    onProgress?: (received: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const blob = await this.pullAsBlob(remotePath, onProgress, signal);
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
