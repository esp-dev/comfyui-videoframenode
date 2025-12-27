import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[VideoFrameNode] extension loaded");

async function uploadMp4(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const resp = await api.fetchApi("/videoframenode/upload", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`upload failed (${resp.status}): ${t}`);
  }

  const data = await resp.json();
  const uploadedName = data?.name;
  if (!uploadedName) throw new Error("missing response name");
  return uploadedName;
}

function setNodeVideoValue(node, value) {
  const videoWidget = node?.widgets?.find((w) => w?.name === "video");
  if (videoWidget) {
    videoWidget.value = value;
    node.setDirtyCanvas?.(true, true);
    return true;
  }
  return false;
}

function getSelectedVideoFrameNode() {
  const canvas = app?.canvas;
  const selected = canvas?.selected_nodes || canvas?.graph?.selected_nodes;
  if (selected) {
    for (const k in selected) {
      const n = selected[k];
      if (n?.type === "VideoFirstLastFrame" || n?.comfyClass === "VideoFirstLastFrame") return n;
    }
  }
  const n = canvas?.node_selected;
  if (n?.type === "VideoFirstLastFrame" || n?.comfyClass === "VideoFirstLastFrame") return n;
  return null;
}

function getVideoFrameNodeUnderPointer(e) {
  try {
    const canvas = app?.canvas;
    const graph = canvas?.graph;
    if (!canvas || !graph) return null;

    // Try common LiteGraph helpers used across ComfyUI builds.
    let pos = null;
    if (typeof canvas.convertEventToCanvasOffset === "function") {
      pos = canvas.convertEventToCanvasOffset(e);
    } else if (typeof canvas.convertEventToCanvas === "function") {
      pos = canvas.convertEventToCanvas(e);
    }

    if (pos && typeof graph.getNodeOnPos === "function") {
      const node = graph.getNodeOnPos(pos[0], pos[1]);
      if (node?.type === "VideoFirstLastFrame" || node?.comfyClass === "VideoFirstLastFrame") return node;
    }
  } catch (_) {
    // ignore
  }
  return null;
}

function installGlobalDropHandlerOnce() {
  if (window.__VideoFrameNodeDropInstalled) return;
  window.__VideoFrameNodeDropInstalled = true;

  document.addEventListener(
    "dragover",
    (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      if (dt.types && !dt.types.includes("Files")) return;
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    "drop",
    async (e) => {
      try {
        const files = e.dataTransfer?.files;
        if (!files || !files.length) return;

        const file = files[0];
        if (!file?.name || !file.name.toLowerCase().endsWith(".mp4")) return;

        const node = getVideoFrameNodeUnderPointer(e) || getSelectedVideoFrameNode();
        if (!node) return;

        e.preventDefault();
        e.stopPropagation();

        console.log("[VideoFrameNode] drop captured, uploading", file.name);
        const uploadedName = await uploadMp4(file);
        setNodeVideoValue(node, uploadedName);
      } catch (err) {
        console.warn("[VideoFrameNode] global drop failed", err);
      }
    },
    true
  );
}

app.registerExtension({
  name: "VideoFrameNode.DragDropPreview",

  setup() {
    installGlobalDropHandlerOnce();
  },

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== "VideoFirstLastFrame") return;

    const origOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = origOnNodeCreated?.apply(this, arguments);

      // Enable dropping an .mp4 file onto the node to upload into ComfyUI/input
      this.onDropFile = async (file) => {
        try {
          if (Array.isArray(file)) file = file[0];
          if (!file?.name || !file.name.toLowerCase().endsWith(".mp4")) {
            return false;
          }

          console.log("[VideoFrameNode] node drop, uploading", file.name);
          const uploadedName = await uploadMp4(file);
          setNodeVideoValue(this, uploadedName);

          return true;
        } catch (e) {
          console.warn("VideoFrameNode drop error", e);
          return false;
        }
      };

      // Some builds require this to allow drop.
      this.onDragOver = () => true;

      return r;
    };

    // No need to override onExecuted: ComfyUI will render ui.images automatically.
  },
});
