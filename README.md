# Acapella

Static product, privacy, and support website for Acapella Spatial, a spatial vocal looper for Apple Vision Pro.

Hosted with GitHub Pages at <https://jamminstein.github.io/acapella-spatial/>. The published files are static; deployment needs no build step. There is no contact backend, analytics script, cookie storage, or third-party embed.

## Preview

From this directory:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

Open <http://127.0.0.1:8767/>. `index.html` is the landing page; `privacy.html` and `support.html` are standalone legal/help pages. `landing.css` is separate from the original `style.css` used by those pages.

The full privacy policy is also retained in the landing page’s `#privacy` section, preserving access through the original root privacy URL. Its policy body and the support page’s body are unchanged; only the surrounding presentation and site navigation differ.

## Media

### Waveform playground

The playground sits immediately after the Studio image, without a separate
heading. Seven modes use the app's native ribbon builders: rounded (Plain, Hum,
Whisper), dotted (Chant), pixelated (Scream, Vocode), and sharp (Tsk). Geometry
is exported with the Swift builders, including Float noise, edge tapering, and
rendered playhead paths. Display scaling makes the ribbon legible in the room.

All seven examples use the same close-mic, casual hum from **“Casual Humming” by
Topschool**, released under CC0. Source, license, and edits are recorded in
`media/playground/v2/NOTICE.txt`. The plain example keeps the voice uncorrected,
without accompaniment, denoising, or added reverb. Other examples push the app's
tools further: octave-down cathedral, telephone coloration and long echoes,
everything-broken distortion and bitcrush, octave-up air and alien chatter,
tempo gating and buffer beats, and the app's full-wet Robot vocoder an octave
lower. Six-second AAC examples include effect tails, matched listening levels,
and a final limiter. These are curated settings, not each mode's defaults.

Drag up to move away, down to move closer, and sideways to reposition the sound.
The ribbon turns toward the listener as it moves. There is no depth slider or
camera orbit. Arrow keys do the same; Shift-drag or Shift-Up/Down changes height.
Home / the reset button returns the sound to center. Switching modes retains
placement. The pearl follows the ribbon through every transform. The ribbon floats
without a platform; a soft shadow follows its projected position across the effects
area and scales in both dimensions with distance. Travel fits the viewport width,
and the ribbon can approach more than twice its default apparent size. App mode
hues are retained with softer saturation and neutral lighting for the web scene.

A Web Audio HRTF panner places the sample at the displayed position, including
distance attenuation. Headphones make this easier to hear; it is a fixed-listener
browser demonstration, not headset tracking. AudioContext resume and native
media play are both requested synchronously within the original gesture. No
microphone access is used. Video and sample playback remain mutually exclusive.

The self-hosted Three.js bundle loads near the section, rendering stops offscreen,
and device pixel ratio is capped at 2. Static SVGs and sound controls remain
available without WebGL. Without JavaScript, a native audio control plays the raw
hum. All media is self-hosted. Earlier v1 assets remain for cached pages.

`npm test` covers placement bounds, audio orientation, context reuse/interruption,
asset completeness, and existing film and logo behavior. Open
`tests/spatial-audio-browser.html` in a browser to render native offline HRTF
checks for left/right channel energy and near/far attenuation without audible output.

To rebuild after editing `src/waveform-viewer.js`:

```sh
npm ci
npm run build:waveforms
```

Commit the resulting `waveform-viewer.bundle.js`; GitHub Pages serves it directly.
Three.js and esbuild versions are pinned in `package-lock.json`. The Three.js
license is retained in `media/playground/THREE-LICENSE.txt`.

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

The header and footer wordmarks share a second Easter egg: a soft, dry recorded “ahem,” with a tiny movement when it plays. Once browser audio is unlocked, even a quick pass over the logo triggers the complete sound; tapping or activating the home link with Enter works too. Pointer exit and loss of keyboard focus do not cut it short. Ordinary link navigation is preserved, and both logos share a four-second cooldown. Hiding the page, pressing Escape, playing a film or a mask cancels the sound and any pending request. The tiny recording is prefetched without opening audio, then decoded on interaction. A slow first download does not discard an accepted trigger. Locked hovers are never queued for later, and page clicks, taps and key presses retry unlocking after Safari audio interruptions. A blocked unlock expires after 700 ms. Safari may need an initial click to allow hover audio. The half-second, 14 KB CC0 recording is self-hosted; its provenance is in `media/audio/easter-eggs/NOTICE.txt`. No new visible labels or controls are added, and Reduce Motion disables the movement. Run `node --test tests/logo-ahem.cjs` for loading, gesture, cooldown and interruption regression coverage.

### Film integration

Keep the short landing page free of hero navigation buttons and song pickers. Same-page anchor links use plain labels without arrows.

The two 36-second concept films draw from four owner-supplied recordings: **Mouth Party**, **Puff Parade**, **Breath Club**, and **Cheeky Beats**. On each page load, the songs are shuffled and each perspective receives a different one. Its song stays fixed across scrolling, pauses, and replays. There is no playlist, song picker, or full-track link; native video controls remain available. On desktop, stopped videos show a centered Play control (Replay after completion, Try again on a media error); the sound toggle appears only during playback. On iPhone, iPad, and other touch devices, only the browser’s native controls are shown. Without JavaScript, both videos retain the default Mouth Party soundtrack.

`media/videos/soundtracks-v2/` contains eight H.264/AAC variants, named `{third,first}-{track-id}.mp4`, plus one VTT sound-description track per song. `media/audio/soundtracks-v2/` contains the four complete recordings converted from Opus to AAC for browser compatibility. Each film uses 0:00–0:36 of its selected track with a 0.75-second ending fade. No volume adjustment was needed. Both current perspectives are natively rendered at 3840 × 2160. Both run for 36 seconds at 24 fps, with 864 frames. The 4K H.264 files use BT.709 color, 4:2:0 sampling, and a front-loaded MP4 index for streaming. Every complete file decoded successfully; both current films preserve their four existing soundtrack audio streams exactly. The earlier website movie files and their original audio have been removed from this repository; immutable source films remain in the private workspace. Versioned URLs avoid reusing cached copies.

These are concept films, not App Store previews or app recordings. The third-person film now uses the approved adult Black woman from the illustrated cast; sixteen waveforms appear individually. The new movies, matching captions, and poster use `media/videos/woman-4k-v1/` so cached copies of the previous singer cannot replace the approved revision. Its per-video `data-film-root` controls the randomized movie and caption paths together. The approved framing and wave animation are preserved. Near-opaque character pixels are normalized in the render material to avoid transparent patches; the source artwork is unchanged. The headset-perspective film uses `media/videos/headset-4k-v1/` with its own `data-film-root`, matching poster and captions. Its original 16.5 mm camera, sixteen waveforms, timing and audio are preserved; only the native render resolution changes. Earlier public media URLs remain available for cached pages. Both perspectives now use only the four supplied songs. The App Store previews and built-in demo recordings are separate and unchanged.

On phones and tablets, playback is tap-to-play through native controls. No autoplay attempts, custom Play overlay, shared mute/volume writes, viewport pause/resume, or visibility/fullscreen handlers run. Starting another film pauses the previous one; explicitly closing the wearer’s perspective pauses its video. Safari owns all other playback behavior. This replaces the earlier phone enhancement after continued physical-device startup failures.

Desktop films retain scroll autoplay with an audible attempt and muted policy fallback, explicit mute/pause preferences, reduced-motion support, and fullscreen protection. Both paths choose a stable randomized song before enabling metadata preload, assign video.src directly without a second load(), and leave media already started before the deferred script untouched. A real media error exposes an Open video link to the same selected file. The wearer’s view is expanded by default.

External caption elements are detached while selecting the visit's video source and restored after `loadedmetadata`. On a physical iPhone 15 Pro Max running iOS 27.2, attaching the text track during source selection reproduced `MEDIA_ERR_SRC_NOT_SUPPORTED`; restoring it after metadata allowed one-tap playback. A video started before the deferred script arrives keeps its source, captions, and playback position untouched.

Run `node tests/film-playback.cjs` for the playback-controller regression checks, including randomized song assignment, resource/caption consistency, caption initialization, stale play promises, one-tap recovery from blocked autoplay, native mute/pause behavior, reduced motion, and fullscreen/picture-in-picture ownership. Media uses H.264 High L4.0, yuv420p, AAC-LC, and fast-start MP4; the live host supports HTTP byte ranges. Browser checks include an iPhone-width layout, Safari on the iOS 26.5 simulator, and the physical iPhone startup comparison above.

## Link previews

Open Graph and large-image social-card metadata use the text-free main illustration (1672 × 941 JPEG), an absolute HTTPS image URL, descriptive image alt text and concise conversational title/description. Metadata is present in the initial static HTML, so social crawlers do not need JavaScript.

## Publication state

Acapella Spatial 1.0 was approved and released on the App Store on 5 November 2026. The page says **available now on Apple Vision Pro** and links to the region-neutral listing https://apps.apple.com/app/acapella-spatial/id6807963888 (Apple redirects each visitor to their own storefront) from the header and footer navigation, the hero, the footer line, and the support and privacy pages; `apple-itunes-app` adds Safari's Smart App Banner where the app can run. It still shows no price, reviews or official App Store badge. The app is not yet sold in the EU (no Digital Services Act trader status declared), so keep availability claims worldwide-neutral.

The original Acapella Air display font is self-hosted at `fonts/AcapellaAir.woff2` and used only for headings. Its copyright/provenance notice is in `fonts/NOTICE.txt`; body and legal text use system fonts.

The header/footer wordmark uses `media/images/acapella-air-coral-800.png`, an 800 × 215 transparent delivery copy of the original 1600 × 430 dimensional coral render. It uses the same custom Acapella Air letterforms as the headings. The original remains in the private marketing workspace.
