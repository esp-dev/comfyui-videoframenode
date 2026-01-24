# Changelog

## 1.1.0

- Add optional `video_in` input (accepts path-like inputs, dicts with a path/filename, or IMAGE frame batches).
- UI: add `recent` dropdown + `Refresh` + `Browse…` (uploads into `ComfyUI/input` and sets the `video` widget).
- Add `/videoframenode/recent` endpoint (shows recent MP4 from `input/` and `output/`).
- Backwards compatible: `video` STRING still works as before.

## 1.0.1

- Add project icon (1024 and 256) and set Registry icon URL.
- Registry metadata cleanup (PublisherId, repo rename links).

## 1.0.0

- Initial release.
- Loads MP4 and outputs FIRST_FRAME / LAST_FRAME as ComfyUI IMAGE.
- Optional UI enhancements: preview thumbnail + drag&drop upload into ComfyUI/input.
