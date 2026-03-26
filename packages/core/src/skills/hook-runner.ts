import type { HookDefinition, HookData, HookPoint } from './skill-types.js';

const DEFAULT_PRIORITY = 100;

export class HookRunner {
  private hooks: Map<HookPoint, HookDefinition[]> = new Map();

  registerHook(hook: HookDefinition): void {
    const list = this.hooks.get(hook.point) ?? [];
    list.push(hook);
    // Keep sorted by priority (ascending — lower runs first)
    list.sort(
      (a, b) => (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY),
    );
    this.hooks.set(hook.point, list);
  }

  unregisterHook(point: HookPoint, handlerRef: Function): void {
    const list = this.hooks.get(point);
    if (!list) return;

    const filtered = list.filter((h) => h.handler !== handlerRef);
    if (filtered.length === 0) {
      this.hooks.delete(point);
    } else {
      this.hooks.set(point, filtered);
    }
  }

  async runHooks(point: HookPoint, data: HookData): Promise<HookData> {
    const list = this.hooks.get(point);
    if (!list || list.length === 0) return data;

    let current = data;

    for (const hook of list) {
      try {
        const result = await hook.handler(current);
        if (result !== undefined && result !== null) {
          current = result;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[HookRunner] Hook at "${point}" (priority ${hook.priority ?? DEFAULT_PRIORITY}) failed: ${message}`,
        );
        // Continue executing remaining hooks
      }
    }

    return current;
  }

  getRegisteredHooks(): Map<HookPoint, HookDefinition[]> {
    return new Map(this.hooks);
  }
}
