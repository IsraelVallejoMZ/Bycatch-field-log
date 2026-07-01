# Fish Pulse

Offline-first PWA for fisheries data capture, spanning field research, commercial fishing operations, and recreational/sport fishing. Built to work fully offline in low-connectivity coastal and port environments.

## What it does

Fish Pulse is organized into three independent segments, each targeting a different user profile:

### 1. Field Research
For port-based sampling and elasmobranch/bycatch survey work.
- Species capture with scientific and common name, biometrics, sex, condition, gear type, and GPS position.
- Campaign management and photo evidence per specimen.
- Offline map with downloadable tiles for use without connectivity.
- Export to CSV, GeoJSON, and ZIP (with photos) for downstream analysis in R, stock assessment, and SDM workflows.
- Survey Insights dashboard with client-side SVG charts (donut, bar, histogram) — no external charting libraries.

### 2. Fishing Operations
For commercial fleets, with separate Captain and Operations roles.
- **Captain:** Trip, Haul, Catch, and Fuel logging with GPS; Close Trip workflow.
- **Operations:** Fleet Dashboard, catch reconciliation by species, document management with expiry alerts, Landing Report PDF export (via jsPDF), crew profit-sharing settlement, and profitability overview.

### 3. Sport / Recreational
For recreational anglers.
- Session logging with a client-side solunar table.
- Catch logging with photo and GPS.
- Fishing spots map.
- Document management with photo viewer.
- Personal stats.

## Design

Field Research has been fully redesigned under a dark navy, high-contrast visual system (Space Grotesk for titles, monospace for data, inline SVG iconography for full offline compatibility). The same visual pass is planned for Fishing Operations and Sport/Recreational.

## Tech stack

Vanilla HTML/CSS/JS (no frameworks, all modules built as IIFEs to keep the codebase dependency-free for offline reliability), Leaflet for mapping, Service Worker for offline caching, localStorage for on-device persistence, jsPDF for report generation, CartoDB Voyager as the base tile provider. Deployed via GitHub Pages.

## Status

Functionally complete offline-first prototype across all three segments. Currently in visual/UX polish phase (segment by segment). Multilingual support (English, Spanish, Italian, Thai) is scoped and planned as a post-polish phase. Backend (cloud sync, authentication, AI-assisted species identification) is planned for a later phase and not yet implemented — all data currently lives on-device.

## License

All rights reserved. This repository is shared publicly for portfolio and review purposes only. No license is granted for reuse, modification, or distribution — commercial or otherwise — without explicit written permission from the author.

## Author

Israel Vallejo — Marine Biologist · Environmental Data Analyst
[israelvallejomz.github.io](https://israelvallejomz.github.io) · [LinkedIn](https://linkedin.com/in/israel-vallejo-mz)
