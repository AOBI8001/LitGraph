# Canvas, language and interaction

Updated: 2026-09-08.

## Backgrounds

The thumbnail-only background picker follows this order: pure white, pure black, purple stardust, ivory paper, soft pink, lavender, lagoon, dark cosmos. After the fixed first three entries, light presets precede dark ones.

Light artwork uses low-contrast grid marks, petals, orbital lines and contour waves. Particles are decorative cached artwork rather than continuously animated simulation objects, avoiding unnecessary rendering work.

Choosing day mode resets the canvas to pure white; choosing night mode resets it to pure black. Selecting a background afterward changes only the canvas. The application chrome retains its selected theme. Refresh preserves the stored background.

## 3D model rotation

The first entry into each viewpoint 3D layout fits the actual model bounds and viewport aspect ratio to roughly 80% of the available extent. Framing tracks the initial force-layout settling period and stops immediately on manual camera/model interaction. At most 5% of extreme isolated outliers are excluded from first-entry framing only; all nodes and their positions remain intact. Fit-to-canvas includes the full viewpoint model. Existing year-tree initial viewing angles are unchanged.

Viewpoint theory / semantic layouts rotate the graph root around the main model body's bounding-box center when dragging empty canvas, using the same robust point selection as initial framing. Isolated distant nodes remain visible and rotate with the model, but cannot pull its rotation pivot away from the main body. The pivot is fixed once rotation starts. Camera position, orientation and target stay unchanged; starting a drag cancels any unfinished fit/zoom animation at its current pose. Node positions remain in simulation-local coordinates; node objects and edges receive the same transform.

Camera position, direction and controls target do not change during this gesture. Wheel zoom and keyboard camera movement remain separate operations. Node dragging and selection retain their own handlers. Rotation is held per project / view / layout slot in the current page session.

Year-tree theory / semantic layouts instead use left-drag on empty canvas to pan the camera and its target together, keeping the heading and the model/year planes unchanged. Right-drag offers limited orbit (±45° horizontal, ±20° vertical around the initial interaction heading, avoiding poles), with world Y up and no roll. Wheel zoom and WASD/arrow navigation remain available. Initial viewing distances and angles are unchanged. The lower-left bilingual legend explains these separate mouse controls.

## Language

Static chrome and dynamic windows use Chinese / English strings. Original paper titles, authors, abstracts and user messages are research data, not automatically rewritten to match the UI language.

AI summaries use `aiSummaryZh` / `aiSummaryEn`. If the requested version is missing and a model is connected, a translation-only request preserves the existing conclusion, uncertainty and inference labels. Its result is cached in the current project; repeated toggles do not repeat the request. Editing a summary invalidates the other translation.

Without a usable model, the UI explains that translation is unavailable instead of displaying Chinese as an English summary. This is a network/model operation, not an offline translation guarantee.
