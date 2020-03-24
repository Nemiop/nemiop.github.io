import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';

const fbxLoader = new FBXLoader();

var tgaLoaderManager = new THREE.LoadingManager();
tgaLoaderManager.setURLModifier(( url ) => {
  url = 'textures/' + url;
	return url;
});
const tgaLoader = new TGALoader(tgaLoaderManager);

THREE.DefaultLoadingManager.addHandler( /\.tga$/i, tgaLoader );

const fbxModelsConfig = `{
      "models": [
        {"id": 1, "path" : "models/ar1.fbx", "position" : [0.1, -0.1, 0.0], "rotation" : [1.57079, 0.0, 0.0], "scale" : 0.06},
        {"id": 2, "path" : "models/ar1m/Gorilla_Grodd.fbx", "position" : [0.0, 0.0, 0.0], "rotation" : [1.57, -1.0, 0.0], "scale" : 0.4}
        ]}`;

// const fbxModelsConfig = `{
//       "models": [
//         {"id": 1, "path" : "models/ar1m/Gorilla_Grodd.fbx", "position" : [0.0, 0.0, 0.0], "rotation" : [1.57, -1.0, 0.0], "scale" : 0.4}
//         ]}`;


class ModelsTesting {

  static initFBXModelScenes(scenesMap) {
    let config = JSON.parse(fbxModelsConfig);
    config.models.forEach((m) => {
      fbxLoader.load(m.path, (g) => {
        console.log('Loaded model ID:', m.id);
        // const model = g.scene;
        // model.scale.set(m.scale, m.scale, m.scale);
        // model.rotation.set(m.rotation[0], m.rotation[1], m.rotation[2]);
        // model.position.set(m.position[0], m.position[1], m.position[2]);

        const sceneModel = new THREE.Scene();
        sceneModel.add(g);
        // addLight(sceneModel);

        scenesMap.set(m.id, sceneModel);
        console.log('Scene added');
      }, (xhr) => {
        console.log( 'Loading model:', Math.round( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      }, ( err ) => {
        console.error(err);
      });
    });
  }

}

export default ModelsTesting;
