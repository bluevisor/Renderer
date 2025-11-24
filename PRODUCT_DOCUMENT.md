# 🎨 Renderer – Audio‑Reactive Particle Visualizer
**Product Document** – *Generated on 2025‑11‑22*

---

## 1. Overview

The **Renderer** is a browser‑based, real‑time visualisation engine that turns live webcam video and microphone audio into a 3‑D particle field. It is built with **React**, **react‑three‑fiber**, **Three.js**, and **Leva** for UI controls.

- **Live video texture** drives the colour of each particle.
- **Audio analyser** drives displacement, size, and colour modulation in three frequency bands (low / mid / high).
- A **rich control panel** lets users tweak visual mode, colour palette, particle size, depth clipping, video contrast/brightness, overlay opacity, and audio‑response damping.

The result is a premium‑looking, interactive visual experience suitable for music visualisers, art installations, or as a reusable component in larger web‑apps.

---

## 2. Goals & Success Criteria

| Goal | Success Metric |
|------|----------------|
| **Real‑time performance** – maintain ≥ 60 fps on a typical laptop (Intel i5 / integrated GPU). | FPS measured via `requestAnimationFrame` stats. |
| **Zero‑install media access** – webcam + mic start after a single user click. | Media streams obtained without additional permissions prompts after click. |
| **Highly customisable UI** – at least 12 distinct parameters exposed via Leva. | All controls appear, persist across sessions (Leva’s internal state). |
| **Extensible shader pipeline** – ability to add new visual modes without touching React code. | New GLSL files can be dropped into `src/shaders/` and referenced in `Visualizer`. |
| **Responsive layout** – works on desktop and mobile browsers (touch‑friendly). | UI scales, canvas fills viewport, controls remain usable on < 600 px width. |

---

## 3. Technical Stack

| Layer | Library / Tool | Reason |
|-------|----------------|--------|
| **UI** | React 18, TypeScript | Component model, type safety. |
| **3‑D Engine** | Three.js 0.164, `@react-three/fiber` | Declarative scene graph inside React. |
| **Helpers** | `@react-three/drei` (OrbitControls) | Camera interaction out‑of‑the‑box. |
| **Control Panel** | Leva 0.9 | Auto‑generated UI for numeric / enum controls, themeable. |
| **Build** | Vite (via `npm run dev`) | Fast HMR, ES‑module bundling. |
| **Styling** | Vanilla CSS (`src/index.css`) | Simple global styles for overlay text. |
| **Media** | WebRTC (`navigator.mediaDevices`) | Direct webcam & microphone access. |
| **Audio** | Web Audio API (`AudioContext`, `AnalyserNode`) | Real‑time frequency analysis. |
| **Shader Language** | GLSL (vertex & fragment shaders in `src/shaders/particles.ts`) | GPU‑accelerated particle rendering. |

---

## 4. System Architecture

```
+-------------------+        +-------------------+        +-------------------+
|  App.tsx         |  -->   |  Visualizer.tsx   |  -->   |  Shaders (GLSL)  |
|  - useMediaInputs |        |  - Video texture  |        |  - vertexShader   |
|  - Leva UI        |        |  - Audio analyser |        |  - fragmentShader |
|  - Canvas (R3F)   |        |  - Uniforms       |        |                   |
+-------------------+        +-------------------+        +-------------------+
        ^                         ^                         ^
        |                         |                         |
        |                         |                         |
        |                         |                         |
        |                +-------------------+               |
        +----------------| useMediaInputs.ts |---------------+
                         +-------------------+
```

* **App.tsx** – entry point. Handles media permission flow, start‑button interaction, renders the `<Canvas>` and the Leva control panel.
* **useMediaInputs.ts** – custom hook that creates a webcam `<video>` element and a microphone `AnalyserNode`. Returns a ready flag and any error.
* **Visualizer.tsx** – core visual component.
  * Builds a static grid of points (320 × 180). 
  * Creates a `VideoTexture` from the webcam stream. 
  * Pulls audio frequency data each frame, smooths it, and writes to shader uniforms. 
  * Renders a `<points>` mesh with a custom `<shaderMaterial>` that consumes the uniforms. 
  * Optionally draws a background overlay plane showing the raw video. 
* **Shaders** – compute particle position, colour, size, and displacement based on the supplied uniforms.

---

## 5. Component Deep‑Dive

### 5.1 `App.tsx`

| Section | Responsibility |
|---------|----------------|
| **Media Hook** (`useMediaInputs`) | Starts webcam & mic, provides `video`, `audioAnalyser`, `audioContext`, `isReady`, `error`. |
| **Start Interaction** (`handleStart`) | Resumes suspended `AudioContext` (required by browsers) and flips `started` flag. |
| **Error UI** | Shows a red error screen with a friendly message. |
| **Loading UI** | Simple “Initializing Media…” spinner while streams are being prepared. |
| **Canvas** (`<Canvas>`) | Sets camera, DPR handling, background colour. |
| **Leva** | Exposes the control panel (collapsed = false, width = 400 px). |
| **Overlay Text** (`.ui‑overlay`) | Static heading & description, styled with a subtle text‑shadow for readability. |

#### Key Props Passed to `Visualizer`

```tsx
<Visualizer video={video} audioAnalyser={audioAnalyser} />
```

Only the `HTMLVideoElement` and `AnalyserNode` are required – the component internally creates its own texture and audio buffers.

---

### 5.2 `useMediaInputs.ts`

| Step | Description |
|------|-------------|
| **Video** | `navigator.mediaDevices.getUserMedia({ video: { width:1280, height:720, facingMode:'user' } })` → `<video>` element (muted, loop, playsInline). |
| **Audio** | Separate `getUserMedia({ audio:true })` → `AudioContext` → `createMediaStreamSource` → `AnalyserNode` (FFT size = 512). |
| **State Management** | React `useState` for each resource, plus `isReady` flag and `error` string. |
| **Cleanup** | Currently a placeholder – can be expanded to stop tracks on unmount. |

> **Note:** The hook deliberately separates video and audio streams to avoid feedback loops and to give developers the freedom to use either source independently.

---

### 5.3 `Visualizer.tsx`

| Concern | Implementation |
|---------|----------------|
| **Refs** | `pointsRef` (THREE.Points), `videoTextureRef` (VideoTexture), `bgPlaneRef` (Mesh). |
| **Audio Smoothing** | `audioLevels` ref holds `{low,mid,high}`; each frame lerps towards the new raw values using `audioSmoothing` (0 → 1 damping). |
| **Leva Controls** | Organized into folders: **General**, **Video Adjustments**, **Depth Simulation**, **Audio Response**. Each control maps directly to a shader uniform. |
| **Geometry** | Fixed grid (320 × 180) → 57 600 points. Positions are centred on a 16 × 9 plane to match typical video aspect. |
| **Uniforms** | `uTime`, `uTexture`, `uAudioLow/Mid/High`, `uDisplacementStrength`, `uParticleSize`, `uMode`, `uColorMode`, `uContrast`, `uBrightness`, `uMinDepth`, `uMaxDepth`. |
| **Frame Loop** (`useFrame`) | 1️⃣ Pull audio data → 2️⃣ Compute band averages → 3️⃣ Apply smoothing → 4️⃣ Update all uniforms → 5️⃣ Update background overlay visibility & opacity. |
| **Background Overlay** | `<mesh>` with a `planeGeometry` placed behind the particle field (`z = -5`). Visibility toggled by `showOverlay`. |
| **Shader Material** | `<shaderMaterial>` with `transparent`, `depthWrite={false}`, `blending={THREE.AdditiveBlending}` for a glowing effect. |

#### Visual Modes (exposed via `mode` enum)

| Value | Name | Intended Effect |
|-------|------|-----------------|
| 0 | Classic | Baseline particle field. |
| 1 | Wave | Sinusoidal displacement. |
| 2 | Glitch | Random jitter + colour shift. |
| 3 | Vortex | Radial swirl around centre. |
| 4 | Rain | Downward falling particles. |

#### Colour Palettes (exposed via `colorMode` enum)

| Value | Palette |
|-------|----------|
| 0 | Original (video‑based) |
| 1 | Cyberpunk (neon magenta / cyan) |
| 2 | Heatmap (warm reds → yellows) |
| 3 | Neon (high‑contrast bright colours) |

---

## 6. Shader Details

*The actual GLSL source lives in `src/shaders/particles.ts`. The following uniform mapping is required:*

| Uniform | Type | Source |
|---------|------|--------|
| `uTime` | `float` | `state.clock.elapsedTime` |
| `uTexture` | `sampler2D` | `videoTextureRef.current` |
| `uAudioLow` / `uAudioMid` / `uAudioHigh` | `float` | Smoothed audio band values |
| `uDisplacementStrength` | `float` | Leva `displacementStrength` |
| `uParticleSize` | `float` | Leva `particleSize` |
| `uMode` | `int` | Leva `mode` |
| `uColorMode` | `int` | Leva `colorMode` |
| `uContrast` | `float` | Leva `contrast` |
| `uBrightness` | `float` | Leva `brightness` |
| `uMinDepth` / `uMaxDepth` | `float` | Leva depth clipping values |

**Typical vertex shader flow**

1. Sample video texture at UV.
2. Apply contrast/brightness.
3. Displace vertex along normal based on selected mode and audio band(s).
4. Scale point size with `uParticleSize` and depth factor (`uMinDepth`/`uMaxDepth`).

**Typical fragment shader flow**

1. Use the sampled colour (or a palette lookup if `uColorMode` ≠ 0).
2. Apply additive blending for glow.
3. Fade out particles outside depth range.

---

## 7. UI / Controls (Leva)

| Folder | Control | Type | Range / Options | Default |
|--------|---------|------|----------------|---------|
| **General** | `mode` | Enum | Classic / Wave / Glitch / Vortex / Rain | Classic |
|  | `colorMode` | Enum | Original / Cyberpunk / Heatmap / Neon | Original |
|  | `particleSize` | Number | 1 – 30 | 4 |
|  | `displacementStrength` | Number | 0 – 20 | 2 |
| **Video Adjustments** | `contrast` | Number | 0 – 3 | 1 |
|  | `brightness` | Number | –1 – 1 | 0 |
|  | `showOverlay` | Boolean | – | false |
|  | `overlayOpacity` | Number | 0 – 1 | 0.5 |
| **Depth Simulation** | `minDepth` | Number | 0 – 1 | 0 |
|  | `maxDepth` | Number | 0 – 1 | 1 |
| **Audio Response** | `audioGain` | Number | 0 – 5 | 1 |
|  | `audioSmoothing` | Number | 0 – 0.99 | 0.8 |

All controls are persisted in Leva’s internal state, so a user can experiment and then reload the page to keep the last values (Leva stores them in `localStorage` by default).

---

## 8. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| **GPU load** – 57 600 points + video texture | Use `THREE.AdditiveBlending` (no depth write) + `requestAnimationFrame` throttling automatically on hidden tabs. |
| **Audio smoothing** – per‑frame lerp | Simple linear interpolation; negligible CPU cost. |
| **Video texture updates** – each frame | `VideoTexture` internally updates only when the underlying video frame changes. |
| **Memory** – large Float32 buffers | Geometry buffers are allocated once (`useMemo`). |
| **Mobile** – limited GPU | Reduce `cols/rows` via a `gridResolution` control (future extension). |

---

## 9. Extensibility & Future Enhancements

| Feature | Implementation Path |
|---------|---------------------|
| **Additional visual modes** | Add new enum values in Leva, extend `mode` handling in the fragment shader. |
| **Custom shader hot‑swap** | Expose a `shaderPath` prop; use dynamic `import()` to load GLSL at runtime. |
| **Preset configurations** | Store JSON presets; load via a “Load Preset” button that calls `Leva.set()` programmatically. |
| **Audio source selection** | Allow user to upload an audio file or select an `<audio>` element as source. |
| **Export video** | Capture the canvas with `MediaRecorder` and provide a download link. |
| **Responsive UI** | Replace static overlay text with a React portal that adapts to screen size; optionally hide Leva on mobile. |
| **Depth of field / post‑processing** | Add `EffectComposer` and `DepthOfField` from `drei`. |
| **Track cleanup** | Implement proper `MediaStreamTrack.stop()` in `useMediaInputs` cleanup. |
| **Theming** | Use CSS variables for dark / light mode; Leva supports custom themes. |

---

## 10. Deployment & Usage

1. **Clone the repo**

```bash
git clone https://github.com/your-org/renderer.git
cd renderer
```

2. **Install dependencies**

```bash
npm install
```

3. **Run locally**

```bash
npm run dev   # Vite dev server, opens http://localhost:5173
```

4. **Production build**

```bash
npm run build   # Generates `dist/` for static hosting
```

5. **Hosting** – any static‑file host (Netlify, Vercel, GitHub Pages) works because the app is pure client‑side.

---

## 11. Appendix

### 11.1 Leva Control Reference (JSON)

```json
{
  "General": {
    "mode": 0,
    "colorMode": 0,
    "particleSize": 4,
    "displacementStrength": 2
  },
  "Video Adjustments": {
    "contrast": 1,
    "brightness": 0,
    "showOverlay": false,
    "overlayOpacity": 0.5
  },
  "Depth Simulation": {
    "minDepth": 0,
    "maxDepth": 1
  },
  "Audio Response": {
    "audioGain": 1,
    "audioSmoothing": 0.8
  }
}
```

### 11.2 Uniform‑to‑Control Mapping Table

| Uniform | Leva Control | Description |
|---------|--------------|-------------|
| `uMode` | `General.mode` | Switches visual algorithm. |
| `uColorMode` | `General.colorMode` | Palette selection. |
| `uParticleSize` | `General.particleSize` | Point size multiplier. |
| `uDisplacementStrength` | `General.displacementStrength` | Amplitude of audio‑driven displacement. |
| `uContrast` | `Video Adjustments.contrast` | Linear contrast multiplier on video texture. |
| `uBrightness` | `Video Adjustments.brightness` | Additive brightness offset. |
| `uMinDepth` / `uMaxDepth` | `Depth Simulation.minDepth` / `maxDepth` | Clip particles based on Z‑depth. |
| `uAudioLow` / `uAudioMid` / `uAudioHigh` | (derived) | Smoothed audio band values. |
| `uAudioGain` | `Audio Response.audioGain` | Global gain applied to all bands. |
| `uAudioSmoothing` | `Audio Response.audioSmoothing` | Damping factor for lerp smoothing. |
| `uOverlayOpacity` (via material) | `Video Adjustments.overlayOpacity` | Opacity of the background video plane. |

---

### 11.3 Glossary

- **Leva** – a React UI library that automatically generates a control panel from a config object.
- **R3F** – short for `react-three-fiber`, a React renderer for Three.js.
- **Uniform** – a global shader variable that stays constant for a draw call.
- **FFT size** – number of frequency bins used by the `AnalyserNode`.

---

## 12. Sign‑off

*Prepared by **Antigravity** – AI‑powered coding assistant (Google DeepMind Advanced Agentic Coding).*

All sections reflect the current source code in **/Users/bluevisor/Developer/Renderer** as of **2025‑11‑22 15:58 UTC‑05:00**.

---
