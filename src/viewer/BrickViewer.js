import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BRICK_H, UNIT, createBrickGeometry } from "./brickGeometry.js";

/**
 * Solid freestanding brick figure.
 * No transparent ghosts — build steps reveal completed levels only.
 */
export class BrickViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141618);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
    this.camera.position.set(32, 24, 36);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 180;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(24, 40, 18);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8bdd4, 0.45);
    fill.position.set(-24, 14, -8);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd7b0, 0.35);
    rim.position.set(4, 16, -28);
    this.scene.add(rim);

    this.group = null;
    this.materials = new Map();
    this.brickGeo = createBrickGeometry();
    this._mosaic = null;

    const grid = new THREE.GridHelper(90, 45, 0x2a3038, 0x1c2026);
    this.scene.add(grid);

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
    this._raf = requestAnimationFrame(() => this._tick());
  }

  _tick() {
    this._raf = requestAnimationFrame(() => this._tick());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _material(color) {
    if (this.materials.has(color.id)) return this.materials.get(color.id);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
      roughness: 0.38,
      metalness: 0.06,
      flatShading: false,
    });
    this.materials.set(color.id, mat);
    return mat;
  }

  clear() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group = null;
  }

  /**
   * @param builtThroughRow — image row index; show solid bricks for all rows
   *   from the ground (high y) through this row. Omit to show the full figure.
   */
  setMosaic(mosaic, { builtThroughRow, fitCamera = true } = {}) {
    this._mosaic = mosaic;
    this.clear();
    if (!mosaic || !mosaic.cells.length) return;

    this.group = new THREE.Group();
    const ox = -((mosaic.width - 1) * UNIT) / 2;

    /** @type {Map<number, THREE.Matrix4[]>} */
    const byColor = new Map();
    const dummy = new THREE.Object3D();

    let maxHalf = 1;
    let placed = 0;

    for (const cell of mosaic.cells) {
      // Progressive solid build: skip unfinished upper rows
      if (builtThroughRow !== undefined && cell.y < builtThroughRow) continue;

      maxHalf = Math.max(maxHalf, cell.half || 1);
      if (!byColor.has(cell.color.id)) byColor.set(cell.color.id, []);
      const list = byColor.get(cell.color.id);

      const wx = ox + cell.x * UNIT;
      const wy = (mosaic.height - 1 - cell.y) * BRICK_H + BRICK_H / 2;

      for (const z of cell.zOffsets) {
        dummy.position.set(wx, wy, z * UNIT);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        list.push(dummy.matrix.clone());
        placed++;
      }
    }

    if (!placed) return;

    for (const cell of mosaic.cells) {
      // materials keyed by first occurrence
      if (!this.materials.has(cell.color.id)) this._material(cell.color);
    }

    for (const [colorId, matrices] of byColor) {
      const color = mosaic.cells.find((c) => c.color.id === colorId).color;
      const mesh = new THREE.InstancedMesh(
        this.brickGeo,
        this._material(color),
        matrices.length
      );
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      this.group.add(mesh);
    }

    const baseW = mosaic.width * UNIT + 2.5;
    const baseD = maxHalf * 2 * UNIT + 2.5;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(baseW, 0.14, baseD),
      new THREE.MeshStandardMaterial({ color: 0x171a1e, roughness: 0.9 })
    );
    base.position.set(0, -0.07, 0);
    this.group.add(base);

    this.scene.add(this.group);

    if (fitCamera) this._fitCamera(mosaic, maxHalf);
    this.resize();
  }

  _fitCamera(mosaic, maxHalf) {
    const height = mosaic.height * BRICK_H;
    const depth = maxHalf * 2;
    const span = Math.max(mosaic.width, height, depth, 8);
    this.controls.target.set(0, height * 0.42, 0);
    this.camera.position.set(span * 0.9, height * 0.5 + span * 0.2, span * 1.05);
    this.controls.update();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.clear();
    this.brickGeo.dispose();
    for (const mat of this.materials.values()) mat.dispose();
    this.renderer.dispose();
  }
}
