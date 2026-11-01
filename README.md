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

The generated room backdrops are marketing staging, not environments included in Acapella. Accessible film labels describe their animation and perspective. Visitor-facing copy should earn its place: omit duration badges, captions that merely describe what is already visible, and automatic-sounding filler. Keep useful controls, meaningful copy, and accessible descriptions. Production terminology stays in this documentation. The main illustration opens the page as a wide cover directly below the header, before the headline and layered app icon. It appears only once and contains no caption or explanatory copy. The cover loads with high priority; the home-studio screenshot follows the introduction and loads lazily.

### App icon

The hero uses the approved isometric singer icon from the October 31 study: an adult singer with peach, mint, lavender and yellow waveforms on ivory. Its three exported PNG layers are copied unchanged into `media/icon/isometric-v1/` and into the native app’s `Assets.xcassets/AppIcon.solidimagestack`. Versioned website paths avoid retaining the previous terracotta icon in browser caches.

`icon.js` and the `.icon-showcase` styles provide a website approximation of layered depth: a circular back, two raised artwork planes, a soft highlight, pointer tilt, subtle scroll movement, and a brief turn on tap or keyboard activation. The gesture never captures touch scrolling or requests motion-sensor access. It settles after interaction, stops while offscreen or hidden, and becomes static with Reduce Motion or without JavaScript. The website adds motion to the same artwork used by the native app; Apple supplies the native icon’s lighting and depth.

The two terracotta masks from the earlier icon live near the footer as a small Easter egg. `masks.js` synthesizes a short low or high vowel glide on hover, click, or keyboard activation using local Web Audio oscillators and formant filters. Safari may need a first tap to unlock sound. Notes stop when leaving a mask, pressing Escape, hiding the page, or starting a film; they never play over an audible film. The pair uses the original transparent mask layers, respects Reduce Motion, and makes no microphone or network requests.

The header and footer wordmarks share a second Easter egg: a soft, dry recorded “ahem,” with a tiny movement when it plays. Hovering briefly, tapping, or activating the home link with Enter can trigger it; ordinary link navigation is preserved. Both logos share a four-second cooldown. Leaving the logo, hiding the page, pressing Escape, playing a film or a mask cancels the sound and any pending request. A blocked or slow hover is never saved for later playback. Safari may need an initial click to allow hover audio. The half-second, 14 KB CC0 recording is self-hosted and fetched only on interaction; its provenance is in `media/audio/easter-eggs/NOTICE.txt`. No new visible labels or controls are added, and Reduce Motion disables the movement.

### Film integration

Keep the short landing page free of hero navigation buttons and song pickers. Same-page anchor links use plain labels without arrows.

The two 36-second concept films draw from four owner-supplied recordings: **Mouth Party**, **Puff Parade**, **Breath Club**, and **Cheeky Beats**. On each page load, the songs are shuffled and each perspective receives a different one. Its song stays fixed across scrolling, pauses, and replays. There is no playlist, song picker, or full-track link; native video controls remain available. On desktop, stopped videos show a centered Play control (Replay after completion, Try again on a media error); the sound toggle appears only during playback. On iPhone, iPad, and other touch devices, only the browser’s native controls are shown. Without JavaScript, both videos retain the default Mouth Party soundtrack.

`media/videos/soundtracks-v2/` contains eight H.264/AAC variants, named `{third,first}-{track-id}.mp4`, plus one VTT sound-description track per song. `media/audio/soundtracks-v2/` contains the four complete recordings converted from Opus to AAC for browser compatibility. Each film uses 0:00–0:36 of its selected track with a 0.75-second ending fade. No volume adjustment was needed. All films are 1920 × 1080 at 24 fps, with 864 frames. Every complete file decoded successfully; the current viewer film preserves the four existing soundtrack audio streams exactly. The earlier website movie files and their original audio have been removed from this repository; immutable source films remain in the private workspace. Versioned URLs avoid reusing cached copies.

These are concept films, not App Store previews or app recordings. The third-person film now uses the approved adult Black woman from the illustrated cast; sixteen waveforms appear individually. The new movies, matching captions, and poster use `media/videos/woman-v1/` so cached copies of the previous singer cannot replace the approved revision. Its per-video `data-film-root` controls the randomized movie and caption paths together. The first-person film remains in `soundtracks-v2`, and earlier public media URLs remain available for cached pages. Both perspectives now use only the four supplied songs. The App Store previews and built-in demo recordings are separate and unchanged.

On phones and tablets, playback is tap-to-play through native controls. No autoplay attempts, custom Play overlay, shared mute/volume writes, viewport pause/resume, or visibility/fullscreen handlers run. Starting another film pauses the previous one; explicitly closing the wearer’s perspective pauses its video. Safari owns all other playback behavior. This replaces the earlier phone enhancement after continued physical-device startup failures.

Desktop films retain scroll autoplay with an audible attempt and muted policy fallback, explicit mute/pause preferences, reduced-motion support, and fullscreen protection. Both paths choose a stable randomized song before enabling metadata preload, assign video.src directly without a second load(), and leave media already started before the deferred script untouched. A real media error exposes an Open video link to the same selected file. The wearer’s view is expanded by default.

External caption elements are detached while selecting the visit's video source and restored after `loadedmetadata`. On a physical iPhone 15 Pro Max running iOS 27.2, attaching the text track during source selection reproduced `MEDIA_ERR_SRC_NOT_SUPPORTED`; restoring it after metadata allowed one-tap playback. A video started before the deferred script arrives keeps its source, captions, and playback position untouched.

Run `node tests/film-playback.cjs` for the playback-controller regression checks, including randomized song assignment, resource/caption consistency, caption initialization, stale play promises, one-tap recovery from blocked autoplay, native mute/pause behavior, reduced motion, and fullscreen/picture-in-picture ownership. Media uses H.264 High L4.0, yuv420p, AAC-LC, and fast-start MP4; the live host supports HTTP byte ranges. Browser checks include an iPhone-width layout, Safari on the iOS 26.5 simulator, and the physical iPhone startup comparison above.

## Link previews

Open Graph and large-image social-card metadata use the text-free main illustration (1672 × 941 JPEG), an absolute HTTPS image URL, descriptive image alt text and concise conversational title/description. Metadata is present in the initial static HTML, so social crawlers do not need JavaScript.

## Publication state

The page describes the app as **coming to Apple Vision Pro**. It deliberately includes no download link, App Store badge, release date, price, reviews, or availability claim. Update those only when the app’s actual release state changes.

The original Acapella Air display font is self-hosted at `fonts/AcapellaAir.woff2` and used only for headings. Its copyright/provenance notice is in `fonts/NOTICE.txt`; body and legal text use system fonts.

The header/footer wordmark uses `media/images/acapella-air-coral-800.png`, an 800 × 215 transparent delivery copy of the original 1600 × 430 dimensional coral render. It uses the same custom Acapella Air letterforms as the headings. The original remains in the private marketing workspace.
