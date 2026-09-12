# Bundled fonts

`NotoSansDevanagari.ttf` — Noto Sans Devanagari (variable, wdth+wght),
SIL Open Font License 1.1. Licence text in `OFL.txt`, as the OFL requires when
redistributing.

Bundled rather than loaded from a CDN on purpose. Certificates are printed in
a school office whose internet connection is unreliable, and a leaving
certificate that renders as tofu boxes because fonts.googleapis.com was
unreachable is worse than one that does not print at all — the clerk may not
notice until it has been signed and handed over.

It is embedded as a base64 data URI at render time (see `src/lib/pdf.ts`) so
Chromium never needs filesystem access to a path that differs between the dev
Mac and the production Linux box.
