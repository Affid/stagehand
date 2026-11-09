// The payload of each request to native, with its limits: what the harness
// checks and the Kotlin app must check (native-api.ts lists who may ask).
import { z } from "zod";
import { MAX_MESSAGE_CHARS } from "./bridge.ts";

const MAX_KEY = 200;
const MAX_URL = 4096;
const MAX_FILE_NAME = 200;
const MAX_QUESTION = 2000;
const MAX_IDS = 50;
const MAX_WORLD = 200;
const MAX_USER = 100;
const MAX_PEOPLE = 10_000;

/** A match pattern as the extension's: "http://host:port/*" or with a path. */
const pattern = z
  .string()
  .max(MAX_URL)
  .regex(/^https?:\/\/[^/*?#\\@\s]+\/\*$/);

/** A server id: http(s) origin and route prefix, no trailing slash. */
const server = z
  .string()
  .max(MAX_URL)
  .regex(/^https?:\/\/[^/*?#\\@\s]+(\/[^*?#\\\s%]*[^/*?#\\\s%])?$/);

const ids = z.array(z.string().min(1).max(300)).max(MAX_IDS);

export const REQUEST_SCHEMAS = {
  "runtime.send": z.object({ message: z.unknown() }),
  "files.save": z.object({
    // A file name only: no folders.
    fileName: z
      .string()
      .min(1)
      .max(MAX_FILE_NAME)
      .regex(/^[^/\\\0]+$/),
    text: z.string().max(MAX_MESSAGE_CHARS),
  }),
  "files.open": z.object({}),
  confirm: z.object({ text: z.string().min(1).max(MAX_QUESTION) }),
  openExternal: z.object({ url: z.string().max(MAX_URL) }),
  "kv.get": z.object({ key: z.string().min(1).max(MAX_KEY) }),
  "kv.set": z.object({
    key: z.string().min(1).max(MAX_KEY),
    value: z.unknown(),
  }),
  "scripts.registered": z.object({ ids }),
  "scripts.register": z.object({ server, ids }),
  "scripts.unregister": z.object({ ids }),
  "permissions.contains": z.object({ origin: pattern }),
  "permissions.request": z.object({ origin: pattern }),
  "permissions.remove": z.object({ origin: pattern }),
  fetch: z.object({
    url: z.string().max(MAX_URL),
    purpose: z.enum(["release", "config"]),
  }),
  "server.check": z.object({ server }),
  "password.ask": z.object({
    purpose: z.enum(["close", "join"]),
    world: z.string().min(1).max(MAX_WORLD),
    user: z.string().min(1).max(MAX_USER).optional(),
    people: z.number().int().min(0).max(MAX_PEOPLE),
    wrong: z.boolean(),
  }),
  "apply.start": z.object({
    world: z.string().min(1).max(MAX_WORLD),
    changes: z.number().int().min(1).max(MAX_PEOPLE),
  }),
  "apply.done": z.object({ ok: z.boolean() }),
  "home.open": z.object({}),
  "background.ready": z.object({}),
} as const;

export type RequestType = keyof typeof REQUEST_SCHEMAS;
