// Key-value storage for the background, with writes serialised so that
// concurrent messages never lose an update (one queue for all keys).

export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** An update's new value plus an extra result for the caller. */
export class WithResult<T, R> {
  readonly value: T;
  readonly result: R;
  constructor(value: T, result: R) {
    this.value = value;
    this.result = result;
  }
}

export const withResult = <T, R>(value: T, result: R): WithResult<T, R> =>
  new WithResult(value, result);

/** An update returns the new value, or `withResult(value, result)`. */
export type Updated<T, R> = T | WithResult<T, R>;

export interface SerializedKeyValue {
  get<T>(key: string): Promise<T | undefined>;
  update<T, R = T>(
    key: string,
    fallback: T,
    fn: (current: T) => Updated<T, R> | Promise<Updated<T, R>>,
  ): Promise<R>;
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
        const wrapped = updated instanceof WithResult;
        const value = wrapped ? updated.value : updated;
        await kv.set(key, value);
        return wrapped ? updated.result : (value as unknown as R);
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
