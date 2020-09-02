import * as THREE from 'three'

class Scene {
  constructor(modelConfig) {
    this.modelConfig = modelConfig;
  }

  init(gltf, envMap) {
    let m = this.modelConfig;
    const model = gltf.scene;
    this.object = model;
    model.scale.set(m.scale, m.scale, m.scale);
    model.rotation.set(m.rotation[0], m.rotation[1], m.rotation[2]);
    model.position.set(m.position[0], m.position[1], m.position[2]);

    model.traverse( function ( node ) {
        if (envMap && node.material && ( node.material.isMeshStandardMaterial ||
            ( node.material.isShaderMaterial && node.material.envMap !== undefined ) ) ) {
          node.material.envMap = envMap;
          node.material.envMapIntensity = 1.5;
        }
    });

    const modelScene = new THREE.Scene();
    modelScene.add(model);
    this.addLights(modelScene);

    this.scene = modelScene
  }

  dispose() {
    if (this.object) {
      this.object.traverse(node => {
        if (node.geometry) {
          node.geometry.dispose()
        }
        if (node.material) {
          if (node.material.length) {
            for (let i = 0; i < node.material.length; ++i) {
              node.material[i].dispose()
            }
          } else {
            node.material.dispose()
          }
        }

        if (node.material && node.material.map) {
          node.material.map.dispose();
          node.material.map = undefined;
        }

        if (node.material && node.material.envMap && node.material.envMap.dispose) {
          node.material.envMap.dispose();
        }
      });
    }

    if (this.scene) {
      this.scene.children.forEach(obj => {
        this.scene.remove(obj)
      })
    }

    this.scene.dispose();
    this.scene = null
    this.object = null
  }

  addLights(scene) {
    var ambient = new THREE.AmbientLight( 0x222222 );
    scene.add( ambient );
  
    var directionalLight = new THREE.DirectionalLight( 0xdddddd, 4 );
    directionalLight.position.set( 0, 0, 1 ).normalize();
    scene.add( directionalLight );
  
    var spot1 = new THREE.SpotLight( 0xffffff, 1 );
    spot1.position.set( 5, 10, 5 );
    spot1.angle = 0.50;
    spot1.penumbra = 0.75;
    spot1.intensity = 100;
    spot1.decay = 2;
    spot1.castShadow = true;
    spot1.shadow.bias = 0.0001;
    spot1.shadow.mapSize.width = 2048;
    spot1.shadow.mapSize.height = 2048;
  
    scene.add( spot1 );
  }
}

export default Scene