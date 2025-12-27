# comfyui-videoframenode (ComfyUI)

Custom node for ComfyUI that loads an MP4 video and outputs two images:

- first frame
- last frame

## Install

1. Copy/clone this repo folder into your ComfyUI:

    - `ComfyUI/custom_nodes/comfyui-videoframenode` (this repo root is the node folder)

    Note: the folder name can be different, but ComfyUI-Manager/Registry installs typically use the project name.

2. Install dependencies:

    - `pip install -r requirements.txt`

    Note about `torch` / Pylance

        This node uses `torch` because ComfyUI images are `torch.Tensor`. If Pylance shows `Import "torch" could not be resolved`, install dependencies from `requirements.txt`.

3. Restart ComfyUI.

## Publishing / Compatibility notes

- This repo includes `pyproject.toml` for Comfy Registry / ComfyUI-Manager publishing. Fill in `PublisherId` before publishing.
- Versioning: follow SemVer. Changing node identifiers, input names, output names, or types should be treated as a breaking change.
- Security: no `eval/exec`, no runtime `pip install` from within the node.
- API-mode: the core node works in API mode, but the drag&drop upload feature is UI-only (it adds a custom upload route + frontend JS).

## Publish to Registry (GitHub Actions)

1. Create a Registry publishing API key and add it as a GitHub repo secret named `REGISTRY_ACCESS_TOKEN`.
2. Ensure `pyproject.toml` has the correct `PublisherId` and `Repository`.
3. Bump `version` in `pyproject.toml` and push to `main`.

## Node

- Name: **Video: First & Last Frame**
- Input: `video` (filename in `ComfyUI/input` or an absolute path)
- Outputs: `FIRST_FRAME`, `LAST_FRAME` (ComfyUI `IMAGE`)

### Drag & drop workflow

1. Drag & drop your `.mp4` directly onto the node.
2. The file is uploaded into `ComfyUI/input` and the node input is set to the uploaded filename.
3. The node displays a preview (first frame) after execution.
