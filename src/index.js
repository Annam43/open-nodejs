/**
 * Re-exports the public API of the library.
 *
 * Keeping the entry point separate from core logic lets consumers import from a
 * stable root (`open-nodejs`) while internal modules can be split freely.
 */
export { sanitizeAttributes } from './core.js';
