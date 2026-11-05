// Key-value storage for the background, with writes serialised so that
// concurrent messages never lose an update (one queue for all keys).

export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** An update returns the new value, or the new value plus a result. */
export type Updated<T, R> = T | { readonly value: T; readonly result: R };

export interface SerializedKeyValue {
  get<T>(key: string): Promise<T | undefined>;
  update<T, R = T>(
    key: string,
    fallback: T,
    fn: (current: T) => Updated<T, R> | Promise<Updated<T, R>>,
  ): Promise<R>;
}

export function chromeKeyValue(): KeyValue {
  return {
    async get<T>(key: string) {
      const items = await chrome.storage.local.get(key);
      return items[key] as T | undefined;
    },
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
  };
}

/** In-memory storage (tests), copying like chrome.storage does. */
export function memoryKeyValue(): KeyValue {
  const data = new Map<string, string>();
  return {
    get<T>(key: string) {
      const raw = data.get(key);
      return Promise.resolve(
        raw === undefined ? undefined : (JSON.parse(raw) as T),
      );
    },
    set(key, value) {
      data.set(key, JSON.stringify(value));
      return Promise.resolve();
    },
  };
}

const isWrapped = <T, R>(
  u: Updated<T, R>,
): u is { readonly value: T; readonly result: R } =>
  typeof u === "object" && u !== null && "value" in u && "result" in u;

export function serialized(kv: KeyValue): SerializedKeyValue {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    get: (key) => kv.get(key),
    update<T, R = T>(
      key: string,
      fallback: T,
      fn: (current: T) => Updated<T, R> | Promise<Updated<T, R>>,
    ): Promise<R> {
      const run = async (): Promise<R> => {
        const current = (await kv.get<T>(key)) ?? fallback;
        const updated = await fn(current);
        const value = isWrapped(updated) ? updated.value : updated;
        await kv.set(key, value);
        return isWrapped(updated) ? updated.result : (value as unknown as R);
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
