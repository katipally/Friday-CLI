import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TelemetryEvent } from '@fridaycode/shared';
import { getUserConfigDir } from '@fridaycode/shared';

const TELEMETRY_DIR = 'telemetry';
const EVENTS_FILE = 'events.jsonl';

/**
 * Simple opt-in telemetry collector.
 * Stores anonymous usage stats locally; external submission is not implemented.
 */
export class TelemetryCollector {
  private enabled: boolean;
  private events: TelemetryEvent[] = [];
  private filePath: string;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    this.filePath = join(getUserConfigDir(), TELEMETRY_DIR, EVENTS_FILE);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  track(event: string, properties?: Record<string, string | number | boolean>): void {
    if (!this.enabled) return;

    this.events.push({
      event,
      properties,
      timestamp: Date.now(),
    });

    // Flush periodically
    if (this.events.length >= 50) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const toFlush = [...this.events];
    this.events = [];

    try {
      const dir = join(getUserConfigDir(), TELEMETRY_DIR);
      await mkdir(dir, { recursive: true });

      const lines = toFlush.map((e) => JSON.stringify(e)).join('\n') + '\n';
      const { appendFile } = await import('node:fs/promises');
      await appendFile(this.filePath, lines, 'utf-8');
    } catch {
      // Silently fail — telemetry should never break the app
    }
  }

  async getStats(): Promise<{ totalEvents: number; uniqueEvents: string[] }> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const events = content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as TelemetryEvent);

      const uniqueEvents = [...new Set(events.map((e) => e.event))];
      return { totalEvents: events.length, uniqueEvents };
    } catch {
      return { totalEvents: 0, uniqueEvents: [] };
    }
  }
}
