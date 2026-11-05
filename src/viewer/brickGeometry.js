import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as THREE from "three";

export const UNIT = 1;
/** 1×1 brick height ≈ 3 plates */
export const BRICK_H = 0.96;
const STUD_R = 0.3;
const STUD_H = 0.18;

/**
 * Single solid 1×1 brick: rounded body + cylinder stud with soft dome.
 * Shared geometry for InstancedMesh.
 */
export function createBrickGeometry() {
  const body = new RoundedBoxGeometry(
    UNIT * 0.98,
    BRICK_H * 0.98,
    UNIT * 0.98,
    2,
    0.08
  );
  body.translate(0, 0, 0);

  const stud = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16);
  stud.translate(0, BRICK_H * 0.49 + STUD_H / 2, 0);

  const dome = new THREE.SphereGeometry(STUD_R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, BRICK_H * 0.49 + STUD_H, 0);

  const brick = mergeGeometries([body, stud, dome]);
  return brick;
}

function mergeGeometries(geos) {
  // Manual merge to avoid extra dependency on BufferGeometryUtils path quirks
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let indexOffset = 0;

  for (const geo of geos) {
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      else normals.push(0, 1, 0);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
    }
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + indexOffset);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + indexOffset);
    }
    indexOffset += pos.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}
