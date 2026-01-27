# Absurd Music Player

Browser-based encrypted music player using Lit web components and the reeeductio spaces API.

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Type check and build
- `npm run typecheck` - TypeScript check only

## Stack

- TypeScript, Lit 3.x, Vite 6.x
- Target: ES2022, esnext

## Architecture

- **Components**: Lit web components in `src/components/` using `@customElement` decorator
- **Services**: Singleton services in `src/services/` (MusicSpaceService, CryptoService, CacheService, PlaybackService)
- **Types**: All types in `src/types/`
- **Path alias**: Use `@/` for `src/` imports

## Patterns

- Web Crypto API for all encryption (AES-GCM, PRF-based deterministic IDs)
- Event-based communication between components (CustomEvent with bubbling)
- IndexedDB for caching with LRU eviction
- Hybrid denormalized/normalized data (e.g., Track has both `artist_name` and `artist_id`)

## Style

- Strict TypeScript mode
- CSS-in-JS scoped to components
- Dark theme using CSS custom properties from `src/styles/global.css`
- JSDoc comments for public APIs

## Notes

- The reeeductio SDK is a local dependency providing encrypted storage spaces
- All audio files are encrypted client-side before storage
- Deterministic IDs via PRF enable cross-device consistency

## Status

See TODO.md for incomplete features (auth flow, import workflow, playback wiring).
