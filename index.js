/* eslint-disable no-plusplus */
/* eslint-disable camelcase */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
/* eslint-disable prefer-const */
/* eslint-disable no-use-before-define */
/* eslint-disable no-var */
import * as THREE from 'three';

import Model3DScene from './scenes/3DModel.js';
import Scene3JS from './scenes/3JSModel.js';
import ModelsTesting from './scenes/ModelsTesting.js';

// Size of video stream
let VIDEO_WIDTH, VIDEO_HEIGHT;

// Output canvas where threejs renders scene
let canvasOutput = document.getElementById('canvasOutput');

// Scale value for make corrections for aspect ratio
let cameraScale;

let renderer;
let camera;

window.Module = {
  onRuntimeInitialized: () => bootstrap(Module),
};

// This is virtual canvas element that used for capture video frames
let frameCaptureCanvas = document.createElement('canvas');
let frameCaptureCanvasCtx2D = frameCaptureCanvas.getContext('2d');

window.addEventListener('resize', handleWindowResize);

// We should get access to camera and load video metadata before calling init()
function bootstrap(module) {
  requestMediaDevice()
    .then(success)
    .catch(cameraError);

  function success(stream) {
    updateSaver();
    const video = document.getElementById('video');
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      VIDEO_WIDTH = video.videoWidth;
      VIDEO_HEIGHT = video.videoHeight;
      calculateCameraScale();

      frameCaptureCanvas.width = VIDEO_WIDTH;
      frameCaptureCanvas.height = VIDEO_HEIGHT;
      video.play();
      init(module);
    };
  }

  function cameraError(err) {
    console.error(err);
    updateSaver("cameraError");
  }
}

function init(module) {
  // It's used to capture frame and invisible
  const canvasVideo = frameCaptureCanvas;
  const canvasContext = frameCaptureCanvasCtx2D;

  // Prepare Emscrypten functions
  const onInit = module.cwrap('onInit', null, ['number', 'number', 'number']);
  const addMarker = module.cwrap('addMarker', null, ['number', 'number', 'number']);
  const onProcess = module.cwrap('onProcess', 'number', ['number', 'number', 'number']);
  const finalizeMarkers = module.cwrap('finalizeMarkers', null);


  // Prepare space for initial frame and result image{cv}
  // It will be rewritten everytime - you do not need to free memory in the loop
  const imageWidth = canvasVideo.width;
  const imageHeight = canvasVideo.height;

  canvasContext.drawImage(video, 0, 0, canvasVideo.width, canvasVideo.height);
  let imageData = canvasContext.getImageData(0, 0, canvasVideo.width, canvasVideo.height);
  // console.log(ImageData);

  // Initialize engine in Emscipten code. It get a 'pointer' to the image and works with it
  // After using, we need to delete allocated space, it cannot be done automaically.
  const bufferSize = imageWidth * imageHeight * 4;
  let inputBuf = module._malloc(bufferSize);
  let temp1 = new Uint8ClampedArray(module.HEAPU8.buffer, inputBuf, bufferSize);
  temp1.set(imageData.data, 0);

  onInit(inputBuf, imageWidth, imageHeight);
  module._free(inputBuf);
  module._free(temp1);
  module._free(imageData);

  // Add marker-images that should be detected on the frame
  // When all markers are added, we call 'finalize' function to prepare right id for markers.
  addMarkers(module, addMarker, finalizeMarkers);


  // Now we initialize 3JS components: 'scene', 'camera' and 'render'
  // Scene consists 'light' and 'meshes'(objects with geometry and textures)

  const aspectRatio = canvasOutput.offsetWidth / canvasOutput.offsetHeight;
  camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 100);

  let scene = new Scene3JS();
  // let scene_models = new Model3DScene(); // Old models

  let scene_models = new Map();
  ModelsTesting.initFBXModelScenes(scene_models);

  renderer = new THREE.WebGLRenderer({
    canvas: canvasOutput,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    precision: "highp",
    logarithmicDepthBuffer: "auto"
  });
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(canvasOutput.offsetWidth, canvasOutput.offsetHeight, false);

  // Processing of the given frame in the loop:
  // Take frame image -> Send to Emscripten code to detect or track
  // markers on the frame (only 1 marker simultaniously)
  // -> Find position of the camera -> send it with id to JS
  // -> Add parameters to the camera -> Use given id to render right model
  const cam_par = [];
  // eslint-disable-next-line func-names
  const capture = function () {
    // var t0 = Date.now();

    canvasContext.drawImage(video, 0, 0, imageWidth, imageHeight);

    imageData = canvasContext.getImageData(0, 0, imageWidth, imageHeight).data;
    const inputBuf2 = module._malloc(bufferSize);
    module.HEAPU8.set(imageData, inputBuf2);

    // let t1 = Date.now();

    let result = onProcess(inputBuf2, imageWidth, imageHeight);

    // let t2 = Date.now();
    // console.log('onProcess time is:');
    // console.log(t2 - t1);

    // We return array with C++ float type. So we need to get them in JS by using HEAP and memory
    for (let v = 0; v < 10; v++) {
      cam_par.push(Module.HEAPF32[result / Float32Array.BYTES_PER_ELEMENT + v]);
    }
    // console.log(cam_par);

    // Rendering depends on marker id. If no marker in scene, it clear all.
    // It should be like ' current_3Dmodel = all_3Dmodels[ id ] '
    let id_marker = cam_par[0];

    if (id_marker > 0) {
      console.log('Marker ID:', id_marker);
    }

    if (id_marker === 0 || id_marker === 3) {
      camera = set_camera(camera, cam_par);
      renderer.render(scene, camera);
    } else if (id_marker > 0) {
      const scene3D = scene_models.get(id_marker);
      // console.log('3d Model');
      if (scene3D) {
        camera = set_camera(camera, cam_par);
        renderer.render(scene3D, camera);
      } else {
        console.warn('No scene associted with marker ID:', id_marker);
      }
    } else {
      renderer.clear();
    }


    // Delete object from array and clear C++ memory
    // There is a problem OOM in firefox because of 'imageData'. It does not delete it each time.
    for (let v = 0; v < 10; v++) {
      cam_par.pop();
    }
    module._free(inputBuf2);
    module._free(result);

    // let t4 = Date.now();
    // console.log('Total time is:');
    // console.log(t4 - t0);

    requestAnimationFrame(capture);
  };

  capture();

}

function set_camera(camera, par) {
  let k = cameraScale;
  camera.position.set(par[1]*k, par[2]*k, par[3]*k);
  camera.lookAt(par[4], par[5], par[6]);
  camera.up.set(par[7], par[8], par[9]);

  return camera;
}

// eslint-disable-next-line no-unused-vars
const getImageData = () => {
  console.log('[getImageData]');
  const canvas = frameCaptureCanvas;
  const ctx = frameCaptureCanvasCtx2D;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  //console.log(ImageData);
  return imageData;
};


const addMarkerFromImg = (module, addMarker, markerData, width, height) => {
  console.log('Load Marker');
  const bufferSizeMarker = width * height * 4;

  const markerBuf = module._malloc(bufferSizeMarker);
  module.HEAPU8.set(markerData.data, markerBuf);

  addMarker(markerBuf, width, height);
  module._free(markerBuf);
  module._free(markerData);
};


const addMarkers = (module, addMarker, finalizeMarkers) => {
  const markersFolderPath = './images/';
  const nmarkers = 5;

  // Virtual canvas element for capture image data from img
  const canvasImg = document.createElement('canvas');
  const contextImg = canvasImg.getContext('2d');

  for (let i = 1; i <= nmarkers; i++) {
    let imagePath = `${markersFolderPath}M${i}.png`;
    let img = new Image();
    img.src = imagePath;
    // console.log(img.width, img.height);
    canvasImg.width = img.width;
    canvasImg.height = img.height;

    contextImg.drawImage(img, 0, 0);
    const markerData = contextImg.getImageData(0, 0, img.width, img.height);

    addMarkerFromImg(module, addMarker, markerData, img.width, img.height);
  }

  finalizeMarkers();
};

// This function handles saver's state
const updateSaver = (status) => {
  const saverContent = document.querySelector('.saver-content');
  let message, iconSrc;
  if (status == "camera") {
    message = "Please, allow access to your camera.";
    iconSrc = "./icons/camera.svg";
  } else if (status == "error") {
    message = "Ooops! Something went wrong.";
    iconSrc = "./icons/error.svg";
  } else if (status == "mediaError") {
    iconSrc = "./icons/browser.svg";
    message = "Cant't get access to device camera. Disable ad blocker or try to update your browser.";
  } else if (status == "cameraError") {
    iconSrc = "./icons/error.svg";
    message = "Can't get access to your web-camera, please check its connection and reload this page.";
  } else if (status == 'choose') {
    message = "Choose your device camera:";
    iconSrc = "./icons/camera.svg";
  } else if (status == "loading") {
    message = "Loading...";
    iconSrc = "./icons/trolley.svg"
  }

  if (message && iconSrc) {
    saverContent.innerHTML = `
      <img src=${iconSrc} />
      <p>${message}</p>
    `;
  } else {
    document.querySelector('.saver').style.display = "none";
  }
}

function calculateCameraScale() {
  let videoAspectRatio = VIDEO_WIDTH / VIDEO_HEIGHT;
  let videoPixelHeight = canvasOutput.offsetWidth / videoAspectRatio;
  // let videoPixelWidth = window.innerHeight * videoAspectRatio;
  if (videoPixelHeight < canvasOutput.offsetHeight) {
    cameraScale = canvasOutput.offsetHeight / videoPixelHeight;
  } else {
    cameraScale = 1;
  }
}

function handleWindowResize() {
  try {
    renderer.setSize(canvasOutput.offsetWidth, canvasOutput.offsetHeight, false);
    camera.aspect = canvasOutput.offsetWidth / canvasOutput.offsetHeight;
    camera.updateProjectionMatrix();
    calculateCameraScale();
  } catch (e) {
    console.error(e);
  }
}

function requestMediaDevice() {
  return new Promise(function(resolve, reject) {
    updateSaver('camera');
    if (navigator.mediaDevices.getUserMedia) {
      // To get deviceId's and labels we should request access first
      navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        .then(success)
        .catch(reject);
    } else {
      console.error(err);
      updateSaver("mediaError");
    }

    function success(stream) {
      updateSaver('choose');
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          devices = devices.filter(d => d.kind === 'videoinput');

          let deviceList = document.createElement('ul');
          deviceList.classList.add('device-list');
          devices.forEach((device) => {
            let listItem = document.createElement('li');
            listItem.addEventListener('click', () => {
              updateSaver("loading");
              let deviceId = device.deviceId;
              navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId } })
                .then(resolve)
                .catch(reject)
            });
            listItem.innerHTML = device.label;
            deviceList.appendChild(listItem);
          });
          document.querySelector('.saver-content').appendChild(deviceList);
      })
      .then(() => {
        stream.getTracks().forEach(t => t.stop());
      })
    }
  });
}
