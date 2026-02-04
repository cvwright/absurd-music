1. ~~Temporary authentication flow - User inputs space id, keypair, and symmetric root~~
2. ~~Import workflow - File picker, ID3 parsing, upload with encryption~~
3. ~~Wire up PlaybackService - Connect player-bar to the service~~
4. ~~Library view component - Show actual tracks, albums, and artists~~
5. ~~Album/Artist views - Detail pages with track listings~~
6. Real authentication flow - Connect to wallet space, get music space credentials
7. Artist view - Photo, description, etc
8. ~~Playlist support - Create, Add music, Edit, View, Play~~
9. Search interface
10. Content similarity search / Recommendations - with OpenL3 or MuLan embeddings
11. Favorites
12. ~~Sort and filtering in the library view~~
13. ~~Genre filter~~
14. Smart playlists - Include everything from a given artist or genre or time period etc
15. Check for admin on startup, and if so make sure we have roles and capabilities set up for multi-user
16. Multi-user support
17. Multi-space support - Separate media collection from "app home dir" stuff like play counts, favorites, etc.

## UX Polish
18. Keyboard shortcuts - Space for play/pause, arrows for seek/volume, J/K for prev/next
~~19. Media Session API - OS media controls (lock screen, notification area, headphone buttons)~~
20. Drag and drop imports - Drop zone in addition to file picker
21. Queue management UI - View and reorder the playback queue
22. Gapless playback / crossfade - For live albums and classical music

## Library Management
23. ~~Delete tracks/albums - Remove items from library~~
24. Duplicate detection - Warn when re-importing existing files
25. Batch metadata editing - Fix artist/album names across multiple tracks
26. Storage usage visibility - Show cache size, allow manual clearing

## Performance
27. Virtual scrolling - For large libraries (thousands of tracks)
28. Lazy image loading - Load artwork on scroll
29. Service worker - Offline support and faster repeat visits

## Accessibility
30. Keyboard navigation - Tab through controls, focus management
31. ARIA labels - Screen reader support for player controls
32. Focus indicators - Visible focus states for keyboard users

## Mobile
33. Responsive layout - Mobile-friendly sidebar and main content
34. Touch gestures - Swipe for next/prev, long press for context menu
35. PWA manifest - Install to home screen

## Integrations
36. Last.fm scrobbling - Track listening history
37. Lyrics display - Fetch or parse embedded lyrics
38. MusicBrainz enrichment - Better metadata than iTunes alone