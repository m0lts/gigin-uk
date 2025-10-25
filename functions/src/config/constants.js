/* eslint-disable */
import { IS_PROD } from "./env";

export const DEFAULT_CONCURRENCY = 80;
export const PROD_RUNTIME_OPTIONS = IS_PROD
? {
    minInstances: 1,
    cpu: 1,
    memory: "256MiB",
    maxInstances: 20,
  }
: {};