# VideoFrameNode for ComfyUI

![VideoFrameNode icon](./icon-256.png)

**Video: First & Last Frame** extracts the first and last frames of an MP4 or an image batch. Both outputs, `FIRST_FRAME` and `LAST_FRAME`, are ComfyUI `IMAGE` values.

## Usage

1. Add **Video: First & Last Frame** from the **video** category.
2. Choose a source:
   - Enter a filename from `ComfyUI/input` or an absolute path to an MP4 in `video`.
   - Choose an MP4 from the `recent` dropdown. It shows up to 50 MP4s from the top level of the ComfyUI input and output folders. Use **Refresh** to update the list.
   - Use **Browse…** or drop an MP4 onto the node to upload it to the ComfyUI input folder. If the name is already in use, the upload gets a numbered suffix and the node selects the new file.
   - Connect a path string, a dictionary containing a path or filename, or an `IMAGE` batch to `video_in`. A supported wired input takes precedence over `video`.
3. Connect the frame outputs you need and queue the workflow. For MP4 files, the node also shows a preview of the first frame.

For ComfyUI's native `VIDEO` output, use **Get Video Components** and connect its `images` output to `video_in`.

When submitting a workflow through the API, set `video` to a path on the ComfyUI server (for example, `input/clip.mp4` or `output/clip.mp4`) or wire a supported `video_in`. The file picker, drag and drop, and recent list are browser controls.

## Install with ComfyUI Manager

1. Open **Manager** and search for `comfyui-videoframenode`.
2. Install the node and restart ComfyUI.

## Manual installation

1. From ComfyUI's `custom_nodes` directory, run:

   ```sh
   git clone https://github.com/esp-dev/comfyui-videoframenode.git
   ```

2. If dependencies are missing, install them using the Python interpreter that **runs ComfyUI**. Run one of the following commands from the new `comfyui-videoframenode` directory. Replace the example paths with your actual paths.

   **Windows Portable** (PowerShell, bundled Python)

   ```powershell
   & "C:\ComfyUI_windows_portable\python_embeded\python.exe" -m pip install -r requirements.txt
   ```

   **Windows with a virtual environment** (PowerShell)

   ```powershell
   & "C:\ComfyUI\.venv\Scripts\python.exe" -m pip install -r requirements.txt
   ```

   **Linux or macOS with a virtual environment**

   ```sh
   "/path/to/ComfyUI/.venv/bin/python" -m pip install -r requirements.txt
   ```

   **If your ComfyUI environment uses uv**, for example a Desktop environment without pip, use `uv pip install` and point it at ComfyUI's existing interpreter:

   ```powershell
   uv pip install --python "C:\path\to\ComfyUI\.venv\Scripts\python.exe" -r requirements.txt
   ```

   Add `--dry-run` to preview the dependency changes. If the resolver proposes changing NumPy or other packages used by your ComfyUI setup, review those changes before installing. Avoid `uv sync` and `uv pip sync` for this installation. Syncing can remove packages outside the project's dependency list, including ComfyUI's PyTorch build. The node uses the PyTorch already provided by ComfyUI.

3. Restart ComfyUI.
