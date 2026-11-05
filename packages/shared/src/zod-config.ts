// Imported first by every entry point: Zod never compiles validators with
// `new Function`, so nothing is evaluated at runtime (AMO policy, MV3 CSP).
import { z } from "zod";

z.config({ jitless: true });
