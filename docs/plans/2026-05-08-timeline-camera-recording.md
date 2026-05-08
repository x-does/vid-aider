# Timeline Camera Recording Implementation Plan

> **For Hermes:** Use TDD for pure timeline/recorder helpers, then integrate UI in small verified steps.

**Goal:** Add interactive camera controls, staged object/camera keyframing, timeline playback/editing, and start/pause/resume/stop WebM recording to Vid Aider.

**Architecture:** Keep core animation math in `src/lib/timeline.ts` and recorder state transitions in `src/lib/recorder.ts` so they are testable without React/Three. Use `OrbitControls` inside `model-studio.tsx`, add `TimelinePanel` and `RecordingControls` as presentational components, and make preview + recording use the same timeline playback path.

**Tech Stack:** Next.js, React, TypeScript, Three.js, native MediaRecorder, Node `tsx --test`.

---

## Implementation sequence

1. Write failing tests for `src/lib/timeline.ts` covering keyframe sorting, asset interpolation, camera interpolation, split/cut, trim, delete, active clips, and enabled clip sequencing.
2. Implement `src/lib/timeline.ts` minimally to pass tests.
3. Write failing tests for `src/lib/recorder.ts` state transitions.
4. Implement `src/lib/recorder.ts` minimally to pass tests.
5. Add `src/components/timeline-panel.tsx` with stage selector, transport controls, scrubber, keyframe/clip edit buttons, current time, duration, and visible stage copy.
6. Add `src/components/recording-controls.tsx` with idle/recording/paused/stopped controls and download affordance.
7. Integrate `OrbitControls` in `src/components/model-studio.tsx`: orbit/pan/zoom, reset view, fit selected, fit all, target lock, damping updates, disable during playback/recording.
8. Wire timeline state and one playback path into `model-studio.tsx`: scrubbing updates object + camera immediately; playback applies object/camera keyframes together; recording plays enabled clips in order.
9. Run `npm test` and `npm run build`; fix regressions.
10. Commit and push to `main`, then verify live GitHub Pages if deployment is requested.

## MVP constraints

- Linear interpolation only.
- No audio.
- No ffmpeg.wasm.
- Timeline editing affects animation clips, not finished WebM bytes.
- Existing simple spin remains active when no timeline keyframes exist.
