/* eslint-disable */
import { IS_PROD } from "./env.js";

export const DEFAULT_RUNTIME_OPTIONS = {
    minInstances: 0,
    cpu: 0.167,
    memory: "256MiB",
    maxInstances: 5,
};
export const WARM_RUNTIME_OPTIONS = IS_PROD
? {
    minInstances: 1,
    cpu: 0.333,
    memory: "256MiB",
    maxInstances: 20,
  }
: {};