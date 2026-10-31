# Acapella

Static product, privacy, and support website for Acapella Spatial, a spatial vocal looper for Apple Vision Pro.

Hosted with GitHub Pages at <https://jamminstein.github.io/acapella-spatial/>. There is no build step, contact backend, analytics script, cookie storage, or third-party embed.

## Preview

From this directory:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

Open <http://127.0.0.1:8767/>. `index.html` is the landing page; `privacy.html` and `support.html` are standalone legal/help pages. `landing.css` is separate from the original `style.css` used by those pages.

The full privacy policy is also retained in the landing page’s `#privacy` section, preserving access through the original root privacy URL. Its policy body and the support page’s body are unchanged; only the surrounding presentation and site navigation differ.

## Media

Only public-facing approved artwork, screenshots, and final marketing films belong here. Do not add the app source, Xcode projects, capture fixtures, raw recordings, Blender projects, or review account details.

| Asset | What it shows |
| --- | --- |
| `bedroom-simple` | Native Simple interface and two vocal loops, captured in visionOS Simulator with a generated bedroom backdrop. |
| `small-studio-play` | Native Play controls and five loops, captured in visionOS Simulator with a generated small-studio backdrop. |
| `grand-studio-editor` | Native full studio and selected loop editor, captured in visionOS Simulator with a generated studio backdrop. |
| `warehouse-layers` | Native Play interface and eighteen loops, captured in visionOS Simulator with a generated warehouse backdrop. |
| `spatial-voice-concept` | Approved AI-generated adult-wearer concept illustration, with the baked typography removed through a minimal image-generation edit. It is not an app screenshot. |

`media/images/` contains resized, progressively encoded JPEGs for responsive delivery (quality 85). `media/originals/` keeps the original four 3840 × 2160 screenshot JPEGs and the original 1672 × 941 illustration PNG available through each image link. Responsive exports are neither cropped nor color-adjusted. The text-free illustration is a new edited original; the earlier version remains in the private marketing workspace.

The generated room backdrops are marketing staging, not environments included in Acapella. The concept films remain labeled. The separate illustration section intentionally contains only the text-free artwork, without a caption or explanatory copy, as requested.

### Film integration

The landing page includes these 36-second, sixteen-layer sequential concept films:

- `media/videos/first-person-concept.mp4`
- `media/videos/third-person-concept.mp4`
- `media/videos/first-person-poster.jpg`
- `media/videos/third-person-poster.jpg`

Both final H.264/AAC films are 1920 × 1080 at 24 fps, with 864 frames and clean full-file decode checks. The third-person film uses the approved adult illustration as its character texture. Sixteen waveforms appear individually; the soundtrack uses the developer’s owned backing-vocal recording, with repeated layers of that same performance. These are concept films, not App Store app previews or app recordings. Native video controls remain available. Films attempt audible playback when they enter the viewport and fall back to muted playback if the browser blocks sound. Explicit sound preferences carry between films for the current visit. Films pause when they leave, and only one can play at a time. The wearer’s view is expanded by default. Reduced-motion preferences disable automatic playback; manual pauses remain respected while the film stays in view. Metadata loads when a film comes into view. `soundtrack-captions.vtt` supplies an English sound description for the layered vocal soundtrack.

## Link previews

Open Graph and large-image social-card metadata use the text-free main illustration (1672 × 941 JPEG), an absolute HTTPS image URL, descriptive image alt text and concise conversational title/description. Metadata is present in the initial static HTML, so social crawlers do not need JavaScript.

## Publication state

The page describes the app as **coming to Apple Vision Pro**. It deliberately includes no download link, App Store badge, release date, price, reviews, or availability claim. Update those only when the app’s actual release state changes.

The original Acapella Air display font is self-hosted at `fonts/AcapellaAir.woff2` and used only for headings. Its copyright/provenance notice is in `fonts/NOTICE.txt`; body and legal text use system fonts.

The header/footer wordmark uses `media/images/acapella-air-coral-800.png`, an 800 × 215 transparent delivery copy of the original 1600 × 430 dimensional coral render. It uses the same custom Acapella Air letterforms as the headings. The original remains in the private marketing workspace.
