import { imageToMosaic, buildSteps, drawMosaicCanvas } from "./lego/mosaic.js";
import { BrickViewer } from "./viewer/BrickViewer.js";

const fileInput = document.getElementById("file");
const dropzone = document.getElementById("dropzone");
const sizeInput = document.getElementById("size");
const sizeLabel = document.getElementById("sizeLabel");
const depthInput = document.getElementById("depth");
const depthLabel = document.getElementById("depthLabel");
const knockBg = document.getElementById("knockBg");
const canvas2d = document.getElementById("preview2d");
const viewport = document.getElementById("viewport");
const hint2d = document.getElementById("hint2d");
const hint3d = document.getElementById("hint3d");
const stats = document.getElementById("stats");
const dimEl = document.getElementById("dim");
const brickCountEl = document.getElementById("brickCount");
const partsBlock = document.getElementById("partsBlock");
const partsList = document.getElementById("parts");
const stepsBlock = document.getElementById("stepsBlock");
const stepLabel = document.getElementById("stepLabel");
const stepParts = document.getElementById("stepParts");
const prevStep = document.getElementById("prevStep");
const nextStep = document.getElementById("nextStep");

const viewer = new BrickViewer(viewport);

let sourceImage = null;
let mosaic = null;
let steps = [];
let stepIndex = 0;
let cameraDirty = true;

function openPicker() {
  fileInput.click();
}

dropzone.addEventListener("click", openPicker);
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openPicker();
  }
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  if (!file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    URL.revokeObjectURL(url);
    cameraDirty = true;
    process();
  };
  img.src = url;
}

sizeInput.addEventListener("input", () => {
  sizeLabel.textContent = sizeInput.value;
  cameraDirty = true;
  process();
});

depthInput.addEventListener("input", () => {
  depthLabel.textContent = depthInput.value;
  cameraDirty = true;
  process();
});

knockBg.addEventListener("change", () => {
  cameraDirty = true;
  process();
});

prevStep.addEventListener("click", () => {
  if (stepIndex > 0) {
    stepIndex -= 1;
    renderStep({ fitCamera: false });
  }
});

nextStep.addEventListener("click", () => {
  if (stepIndex < steps.length - 1) {
    stepIndex += 1;
    renderStep({ fitCamera: false });
  }
});

function renderParts(target, parts) {
  target.innerHTML = "";
  for (const p of parts) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="swatch" style="background:${p.hex}"></span>
      <span>${p.name}</span>
      <span class="qty">×${p.qty}</span>
    `;
    target.appendChild(li);
  }
}

function renderStep({ fitCamera = false } = {}) {
  if (!steps.length) return;
  const step = steps[stepIndex];
  stepLabel.textContent = `Step ${step.step} / ${steps.length}`;
  prevStep.disabled = stepIndex === 0;
  nextStep.disabled = stepIndex === steps.length - 1;
  renderParts(
    stepParts,
    step.parts.sort((a, b) => b.qty - a.qty)
  );

  // Solid progressive build: only ground → current level (no ghost bricks)
  const builtThroughRow = step.row;
  drawMosaicCanvas(canvas2d, mosaic, { builtThroughRow });
  viewer.setMosaic(mosaic, {
    builtThroughRow,
    fitCamera: fitCamera || cameraDirty,
  });
  cameraDirty = false;
}

function process() {
  if (!sourceImage) return;

  mosaic = imageToMosaic(sourceImage, {
    width: Number(sizeInput.value),
    maxDepth: Number(depthInput.value),
    knockBackground: knockBg.checked,
  });
  steps = buildSteps(mosaic);
  // Start on the finished figure so the 3D form is obvious
  stepIndex = Math.max(0, steps.length - 1);

  hint2d.hidden = true;
  hint3d.hidden = true;
  canvas2d.hidden = false;
  viewport.hidden = false;
  stats.hidden = false;
  partsBlock.hidden = false;
  stepsBlock.hidden = false;

  dimEl.textContent = `${mosaic.width}×${mosaic.height}`;
  brickCountEl.textContent = String(mosaic.totalBricks);
  renderParts(partsList, mosaic.parts);
  renderStep({ fitCamera: true });
}
