import * as THREE from 'three';

class Scene3JS {
  constructor() {
    const scene = new THREE.Scene();
    initScene3JS(scene);
    return scene;
  }
}

function initScene3JS(scene) {
  // Light
  const color = 0xffffff;
  const intens = 1;
  const light = new THREE.DirectionalLight(color, intens);
  light.position.set(-1, 2, 4);
  scene.add(light);

  // Meshes
  const geometry = new THREE.CylinderGeometry(0.03, 0.03, 1.02, 32);

  // eslint-disable-next-line no-shadow
  function makeInstance(geometry, color) {
    const material = new THREE.MeshPhongMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    return cube;
  }
  // 4 cylinders
  const c1 = makeInstance(geometry, 0x2194ce);
  c1.position.set(-0.5, 0, 0);

  const c2 = makeInstance(geometry, 0x2194ce);
  c2.position.set(0.5, 0, 0);

  const c3 = makeInstance(geometry, 0x2194ce);
  c3.rotation.z = Math.PI / 2;
  c3.position.set(0, 0.5, 0);

  const c4 = makeInstance(geometry, 0x2194ce);
  c4.rotation.z = Math.PI / 2;
  c4.position.set(0, -0.5, 0);
}

export default Scene3JS;
