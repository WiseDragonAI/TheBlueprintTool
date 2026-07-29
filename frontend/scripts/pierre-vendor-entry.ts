/**
 * WHAT: Exposes the exact Pierre diff symbols consumed by authored-file revision rendering.
 * WHY: A narrow vendor entry keeps the pinned local browser bundle deterministic.
 */
export {
  DIFFS_TAG_NAME,
  FileDiff,
  parsePatchFiles,
} from '@pierre/diffs';
