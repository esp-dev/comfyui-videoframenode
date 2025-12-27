from __future__ import annotations

import os
from typing import Optional, Tuple, TYPE_CHECKING

from uuid import uuid4

import numpy as np

if TYPE_CHECKING:
    import torch


def _to_comfy_image(frame_rgb: np.ndarray):
    import torch

    if frame_rgb is None:
        raise ValueError("Got empty frame")
    if frame_rgb.ndim != 3 or frame_rgb.shape[2] != 3:
        raise ValueError(f"Expected RGB HxWx3 frame, got shape={frame_rgb.shape}")

    frame_rgb = np.ascontiguousarray(frame_rgb)
    image = torch.from_numpy(frame_rgb).float() / 255.0
    # ComfyUI IMAGE is typically [B,H,W,C]
    return image.unsqueeze(0)


def _read_first_last_frames(video_path: str) -> Tuple[np.ndarray, np.ndarray]:
    if not isinstance(video_path, str) or not video_path.strip():
        raise ValueError("video_path is required")

    video_path = os.path.expandvars(os.path.expanduser(video_path.strip()))
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # Prefer OpenCV when available
    try:
        import cv2  # type: ignore

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video: {video_path}")

        # First frame
        ok, first_bgr = cap.read()
        if not ok or first_bgr is None:
            cap.release()
            raise ValueError("Failed to read the first frame")

        first_rgb = cv2.cvtColor(first_bgr, cv2.COLOR_BGR2RGB)

        # Try to jump to the last frame using frame count
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        last_rgb: Optional[np.ndarray] = None

        if frame_count > 1:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count - 1)
            ok, last_bgr = cap.read()
            if ok and last_bgr is not None:
                last_rgb = cv2.cvtColor(last_bgr, cv2.COLOR_BGR2RGB)

        # Fallback: scan to the end to find last decodable frame
        if last_rgb is None:
            last_bgr = first_bgr
            while True:
                ok, frame_bgr = cap.read()
                if not ok or frame_bgr is None:
                    break
                last_bgr = frame_bgr
            last_rgb = cv2.cvtColor(last_bgr, cv2.COLOR_BGR2RGB)

        cap.release()
        return first_rgb, last_rgb

    except ImportError:
        # Fallback to imageio if OpenCV isn't installed
        try:
            import imageio.v3 as iio  # type: ignore

            # Read first frame
            first = iio.imread(video_path, index=0)
            # Read last frame: imageio supports index=-1 for many backends
            last = iio.imread(video_path, index=-1)

            # Ensure RGB
            first = np.asarray(first)
            last = np.asarray(last)
            if first.ndim == 3 and first.shape[2] >= 3:
                first = first[:, :, :3]
            if last.ndim == 3 and last.shape[2] >= 3:
                last = last[:, :, :3]

            return first, last
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                "Could not read video frames. Install opencv-python (recommended) or imageio[ffmpeg]. "
                f"Original error: {e}"
            )


def _resolve_video_path(video: str) -> str:
    video = (video or "").strip()
    if not video:
        return video

    # If user provides a plain filename, resolve it relative to ComfyUI input.
    # This enables the drag&drop workflow: upload -> input folder -> set filename in widget.
    try:
        import folder_paths  # type: ignore

        input_dir = folder_paths.get_input_directory()
        candidate = os.path.join(input_dir, video)
        if os.path.isfile(candidate):
            return candidate
    except Exception:
        pass

    return video


def _save_temp_preview_png(frame_rgb: np.ndarray) -> Optional[dict]:
    try:
        import folder_paths  # type: ignore
        from PIL import Image

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)

        filename = f"videoframe_preview_{uuid4().hex}.png"
        path = os.path.join(temp_dir, filename)
        Image.fromarray(frame_rgb).save(path)

        return {"filename": filename, "subfolder": "", "type": "temp"}
    except Exception:
        return None


# Expose frontend assets (./web)
WEB_DIRECTORY = "./web"


# Optional upload endpoint for drag&drop in the node UI.
try:
    import folder_paths  # type: ignore
    from server import PromptServer  # type: ignore
    from aiohttp import web  # type: ignore

    @PromptServer.instance.routes.post("/videoframenode/upload")
    async def videoframenode_upload(request):
        try:
            post = await request.post()
        except Exception as e:
            return web.json_response({"error": f"invalid form data: {e}"}, status=400)

        file = post.get("file")

        if file is None:
            return web.json_response({"error": "missing file"}, status=400)

        filename = getattr(file, "filename", None) or ""
        if not filename.lower().endswith(".mp4"):
            return web.json_response({"error": "only .mp4 supported"}, status=400)

        input_dir = folder_paths.get_input_directory()
        os.makedirs(input_dir, exist_ok=True)

        safe_name = os.path.basename(filename)
        save_path = os.path.join(input_dir, safe_name)

        data = file.file.read()
        with open(save_path, "wb") as f:
            f.write(data)

        return web.json_response({"name": safe_name})

except Exception:
    # When importing outside ComfyUI, server/folder_paths won't exist.
    pass


class VideoFirstLastFrame:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                    },
                )
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("FIRST_FRAME", "LAST_FRAME")
    FUNCTION = "load"
    CATEGORY = "video"

    def load(self, video: str):
        video_path = _resolve_video_path(video)
        first_rgb, last_rgb = _read_first_last_frames(video_path)

        preview = _save_temp_preview_png(first_rgb)
        if preview is not None:
            return {
                "ui": {"images": [preview]},
                "result": (_to_comfy_image(first_rgb), _to_comfy_image(last_rgb)),
            }

        return (_to_comfy_image(first_rgb), _to_comfy_image(last_rgb))


NODE_CLASS_MAPPINGS = {
    "VideoFirstLastFrame": VideoFirstLastFrame,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VideoFirstLastFrame": "Video: First & Last Frame",
}
