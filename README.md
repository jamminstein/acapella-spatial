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

The generated room backdrops are marketing staging, not environments included in Acapella. Accessible film labels describe their animation and perspective. Visitor-facing copy should earn its place: omit duration badges, captions that merely describe what is already visible, and automatic-sounding filler. Keep useful controls, meaningful copy, and accessible descriptions. Production terminology stays in this documentation. The separate illustration section intentionally contains only the text-free artwork, without a caption or explanatory copy, as requested.

### Film integration

Use “Video” in visitor-facing navigation and calls to action. Same-page anchor links use plain labels without arrows.

The two 36-second concept films share four soundtrack choices: **Mouth Party** (default), **Puff Parade**, **Breath Club**, and **Cheeky Beats**. The owner supplied all four recordings. Each pastel button starts that perspective with the chosen music; the other perspective adopts the same selection. Native video controls remain available. The full-track link opens the complete selected recording and pauses the films.

`media/videos/soundtracks-v2/` contains eight H.264/AAC variants, named `{third,first}-{track-id}.mp4`, plus one VTT sound-description track per song. `media/audio/soundtracks-v2/` contains the four complete recordings converted from Opus to AAC for browser compatibility. Each film uses 0:00–0:36 of its selected track with a 0.75-second ending fade. No volume adjustment was needed. Every variant preserves the original 1920 × 1080, 24 fps video stream: all 864 packets and their timestamps were checked, and every complete file decoded successfully. The earlier website movie files and their original audio have been removed from this repository; immutable source films remain in the private workspace. Versioned URLs avoid reusing cached copies.

These are concept films, not App Store previews or app recordings. The third-person film uses the approved adult illustration as its character texture; sixteen waveforms appear individually. Both perspectives now use only the four supplied songs. The App Store previews and built-in demo recordings are separate and unchanged.

Films attempt audible playback when they enter the viewport and fall back to muted playback if the browser blocks sound. Explicit mute/volume preferences carry between films for the current visit. Films pause when they leave, and only one can play at a time. The wearer’s view is expanded by default. Reduced-motion preferences disable automatic playback; manual pauses remain respected until explicit playback. Metadata loads when a film comes into view. Selecting a different song restarts the selected film; selecting the current song resumes it.

Run `node tests/film-playback.cjs` for the playback-controller regression checks, including shared choices, stale play promises, native mute/pause behavior, policy fallback, reduced motion and full-track links.

## Link previews

Open Graph and large-image social-card metadata use the text-free main illustration (1672 × 941 JPEG), an absolute HTTPS image URL, descriptive image alt text and concise conversational title/description. Metadata is present in the initial static HTML, so social crawlers do not need JavaScript.

## Publication state

The page describes the app as **coming to Apple Vision Pro**. It deliberately includes no download link, App Store badge, release date, price, reviews, or availability claim. Update those only when the app’s actual release state changes.

The original Acapella Air display font is self-hosted at `fonts/AcapellaAir.woff2` and used only for headings. Its copyright/provenance notice is in `fonts/NOTICE.txt`; body and legal text use system fonts.

The header/footer wordmark uses `media/images/acapella-air-coral-800.png`, an 800 × 215 transparent delivery copy of the original 1600 × 430 dimensional coral render. It uses the same custom Acapella Air letterforms as the headings. The original remains in the private marketing workspace.
