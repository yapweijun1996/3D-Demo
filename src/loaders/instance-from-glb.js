import * as THREE from 'three';

// Convert a GLTF into one or more InstancedMesh.
// Walks the scene, finds all meshes, and creates an InstancedMesh per geometry/material pair.
// `matrices` is an array of THREE.Matrix4 (one per instance).
// Returns a Group containing all generated InstancedMesh objects.
export function instanceFromGLB(gltf, matrices, opts = {}) {
  const { castShadow = true, receiveShadow = true } = opts;
  const group = new THREE.Group();
  const meshes = [];
  gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  if (meshes.length === 0) throw new Error('GLB has no mesh');

  for (const src of meshes) {
    const inst = new THREE.InstancedMesh(src.geometry, src.material, matrices.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    // Compose source mesh's local transform into each instance matrix
    const local = src.matrixWorld.clone(); // bake parent transforms
    src.updateWorldMatrix(true, false);
    const tmp = new THREE.Matrix4();
    for (let i = 0; i < matrices.length; i++) {
      tmp.multiplyMatrices(matrices[i], local);
      inst.setMatrixAt(i, tmp);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  return group;
}

// Helper: build matrices from {x, z, scale, rotY} positions.
export function matricesFromPlacements(placements) {
  const out = [];
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const t = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (const p of placements) {
    t.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    e.set(0, p.rotY ?? 0, 0); q.setFromEuler(e);
    s.setScalar(p.scale ?? 1);
    m.compose(t, q, s);
    out.push(m.clone());
  }
  return out;
}
