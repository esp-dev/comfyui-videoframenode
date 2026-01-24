import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[VideoFrameNode] extension loaded");

async function fetchRecentMp4List() {
  try {
    const resp = await api.fetchApi("/videoframenode/recent", { method: "GET" });
    if (!resp.ok) return [];
    const data = await resp.json();
    const files = data?.files;
    return Array.isArray(files) ? files : [];
  } catch (_) {
    return [];
  }
}

function createHiddenFileInput(accept = ".mp4") {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";
  document.body.appendChild(input);
  return input;
}

let __VideoFrameNodeBrowseInput = null;
let __VideoFrameNodeBrowseTarget = null;

function getSharedBrowseInput() {
  if (__VideoFrameNodeBrowseInput) return __VideoFrameNodeBrowseInput;

  const fileInput = createHiddenFileInput(".mp4");
  fileInput.addEventListener("change", async () => {
    const node = __VideoFrameNodeBrowseTarget;
    __VideoFrameNodeBrowseTarget = null;
    try {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file || !node) return;
      if (!file.name?.toLowerCase().endsWith(".mp4")) return;

      const uploadedName = await uploadMp4(file);
      setNodeVideoValue(node, uploadedName);

      // Refresh recent values if present.
      const recentWidget = node.widgets?.find((w) => w?.name === "recent");
      if (recentWidget?.options) {
        const files = await fetchRecentMp4List();
        recentWidget.options.values = ["", ...files];
      }
    } catch (e) {
      console.warn("[VideoFrameNode] browse/upload failed", e);
    }
  });

  __VideoFrameNodeBrowseInput = fileInput;
  return fileInput;
}

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

      // Add UI helpers: recent list + browse/upload button.
      // These write into the existing STRING widget named "video".
      try {
        // Recent dropdown
        const recentWidget = this.addWidget(
          "combo",
          "recent",
          "",
          async (v) => {
            if (typeof v === "string" && v) setNodeVideoValue(this, v);
          },
          { values: [""], serialize: false }
        );

        const refreshRecent = async () => {
          const files = await fetchRecentMp4List();
          const values = ["", ...files];
          recentWidget.options.values = values;
          // If current selection no longer exists, reset to empty.
          if (!values.includes(recentWidget.value)) recentWidget.value = "";
          this.setDirtyCanvas?.(true, true);
        };

        // Refresh button
        this.addWidget(
          "button",
          "refresh recent",
          "Refresh",
          async () => {
            await refreshRecent();
          },
          { serialize: false }
        );

        this.addWidget(
          "button",
          "browse",
          "Browse…",
          () => {
            __VideoFrameNodeBrowseTarget = this;
            getSharedBrowseInput().click();
          },
          { serialize: false }
        );

        // Load recent list once.
        refreshRecent();
      } catch (e) {
        console.warn("[VideoFrameNode] failed to add UI widgets", e);
      }

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

          // Best-effort refresh of recent widget values.
          const recentWidget = this.widgets?.find((w) => w?.name === "recent");
          if (recentWidget?.options) {
            const files = await fetchRecentMp4List();
            recentWidget.options.values = ["", ...files];
          }

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
