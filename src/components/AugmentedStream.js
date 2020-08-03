import React, { Component } from 'react'
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'stats.js'
import ProgressBar from './ProgressBar'
import Container from './Container'

var onProcess, addMarker, finalizeMarkers;

var video, module, modelScene, camera, cameraControls, cameraScale, renderer,
    imageWidth, imageHeight, bufferSize, onProcess, canvasOutput;

// This is virtual canvas element that used for capture video frames
let frameCaptureCanvas = document.createElement('canvas');
let canvasContext = frameCaptureCanvas.getContext('2d');
// This parameters improve performance
canvasContext.imageSmoothingEnabled = false;
canvasContext.globalCompositeOperation = 'copy';

// Configure metrics
const statsFPS = new Stats();
statsFPS.dom.style.top = '64px'
statsFPS.showPanel(0);
// document.body.appendChild(statsFPS.dom);

window.Module = {
  onRuntimeInitialized: () => {
    module = window.Module
  },
};

function setCamera(par) {
  let k = cameraScale;
  camera.position.set(par[1]*k, par[2]*k, par[3]*k);
  camera.lookAt(par[4], par[5], par[6]);
  camera.up.set(par[7], par[8], par[9]);
}

function addMarkerFromImg(module, addMarker, markerData, width, height) {
  console.log('Load Marker');
  let bufferSizeMarker = width * height * 4;

  let markerBuf = module._malloc(bufferSizeMarker);
  module.HEAPU8.set(markerData.data, markerBuf);

  addMarker(markerBuf, width, height);
  module._free(markerBuf);
  module._free(markerData);
}

async function addMarkers(module, addMarker, finalizeMarkers) {
  const markersFolderPath = './images/ar_markers/';
  const nmarkers = 6;
  const markersLoading = [];

  // Virtual canvas element for capture image data from img
  const canvasImg = document.createElement('canvas');
  const contextImg = canvasImg.getContext('2d');

  for (let i = 1; i <= nmarkers; i++) {
    let imagePath = `${markersFolderPath}M${i}.png`;
    let img = new Image();
    img.src = imagePath;
    markersLoading.push(new Promise(resolve => {
      img.onload = () => {
        resolve(img);
      }
    }));
  }

  const loadedMarkers = await Promise.all(markersLoading)

  loadedMarkers.forEach(img => {
    canvasImg.width = img.width;
    canvasImg.height = img.height;
    contextImg.drawImage(img, 0, 0);
    const markerData = contextImg.getImageData(0, 0, img.width, img.height);
    addMarkerFromImg(module, addMarker, markerData, img.width, img.height);
  });

  finalizeMarkers();
};

function calculateCameraScale() {
  let videoAspectRatio = video.videoWidth / video.videoHeight;
  let videoPixelHeight = canvasOutput.offsetWidth / videoAspectRatio;
  // let videoPixelWidth = window.innerHeight * videoAspectRatio;
  if (videoPixelHeight < canvasOutput.offsetHeight) {
    cameraScale = canvasOutput.offsetHeight / videoPixelHeight;
  } else {
    cameraScale = 1;
  }
}

async function initEmscriptenFunctions() {
  // Prepare Emscripten functions
  const onInitDef = module.cwrap('onInitDef', null, ['number', 'number', 'number']);
  addMarker = module.cwrap('addMarker', null, ['number', 'number', 'number']);
  onProcess = module.cwrap('onProcess', 'number', ['number', 'number', 'number', 'number']);
  finalizeMarkers = module.cwrap('finalizeMarkers', null);

  // Prepare space for initial frame and result image{cv}
  // It will be rewritten everytime - you do not need to free memory in the loop
  imageWidth = frameCaptureCanvas.width;
  imageHeight = frameCaptureCanvas.height;

  canvasContext.drawImage(video, 0, 0, imageWidth, imageHeight);
  let imageData = canvasContext.getImageData(0, 0, imageWidth, imageHeight);
  // console.log(ImageData);

  // Initialize engine in Emscipten code. It get a 'pointer' to the image and works with it
  // After using, we need to delete allocated space, it cannot be done automaically.
  bufferSize = imageWidth * imageHeight * 4;
  let inputBuf = module._malloc(bufferSize);
  let temp1 = new Uint8ClampedArray(module.HEAPU8.buffer, inputBuf, bufferSize);
  temp1.set(imageData.data, 0);

  onInitDef(inputBuf, imageWidth, imageHeight);
  module._free(inputBuf);
  module._free(temp1);
  module._free(imageData);

  // Add marker-images that should be detected on the frame
  // When all markers are added, we call 'finalize' function to prepare right id for markers.
  await addMarkers(module, addMarker, finalizeMarkers);
}

// Capture variables
let imageData, inputBuf2, cam_par, result;

class AugmentedStream extends Component {
  state = {
    isModelLoading: true,
    isExploring: false
  }
  video = React.createRef()
  canvasOutput = React.createRef()

  init = async () => {
    if (!onProcess && !addMarker) {
      await initEmscriptenFunctions();
    }

    calculateCameraScale();

    // Prepare THREE.js renderer and scene
    const aspectRatio = canvasOutput.offsetWidth / canvasOutput.offsetHeight;
    camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 100);

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(canvasOutput.offsetWidth, canvasOutput.offsetHeight, false);

    this.props.modelScene.onModelLoading = this.handleModelLoading;
    this.props.modelScene.onReady = this.handleModelReady;
    this.props.modelScene.init(renderer);

    window.addEventListener('resize', this.handleWindowResize);

    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.enableDamping = true;
		cameraControls.dampingFactor = 0.05;
		cameraControls.rotateSpeed = 0.87;

    this.setState(
      state => Object.assign(state, {isStreaming: true}),
      () => this.capture()
    )
  }

  capture = () => {
    statsFPS.begin()

    const {isExploring} = this.state;

    // Get new image data if user is not exploring model or image data not initialized
    // Else pass saved image data
    if (!isExploring || !imageData) {
      canvasContext.drawImage(video, 0, 0, imageWidth, imageHeight);
      imageData = canvasContext.getImageData(0, 0, imageWidth, imageHeight).data;
    }

    inputBuf2 = module._malloc(bufferSize);
    module.HEAPU8.set(imageData, inputBuf2);
    result = onProcess(inputBuf2, imageWidth, imageHeight, 1); // Last parameter is frameNum

    cam_par = []
    // We return array with C++ float type. So we need to get them in JS by using HEAP and memory
    for (let v = 0; v < 10; v++) {
      cam_par.push(Module.HEAPF32[result / Float32Array.BYTES_PER_ELEMENT + v]);
    }

    if (modelScene.scene && cam_par[0] >= 0) {
      !isExploring && setCamera(cam_par);
      renderer.render(modelScene.scene, camera);
    } else {
      renderer.clear();
    }

    module._free(inputBuf2);
    module._free(result);
    cam_par = null;

    cameraControls.update();

    statsFPS.end()

    if (this.state.isStreaming) {
      requestAnimationFrame(this.capture);
    }
  }

  handleWindowResize = () => {
    try {
      renderer.setSize(canvasOutput.offsetWidth, canvasOutput.offsetHeight, false);
      camera.aspect = canvasOutput.offsetWidth / canvasOutput.offsetHeight;
      camera.updateProjectionMatrix();
      calculateCameraScale();
    } catch (e) {
      console.error(e);
    }
  }

  handleModelLoading = (xhr) => {
    let newState = { isModelLoading: true }
    if ( xhr.lengthComputable ) {
  		var percentComplete = xhr.loaded / xhr.total * 100;
      newState.modelLoadingProgress = Math.round(percentComplete)
  	}
    this.setState(newState)
  }

  handleModelReady = () => {
    this.setState({
      isModelLoading: false
    })
  }

  componentDidMount = () => {
    video = this.video.current;
    canvasOutput = this.canvasOutput.current;
    modelScene = this.props.modelScene
    video.srcObject = this.props.stream;
    video.onloadedmetadata = () => {
      frameCaptureCanvas.width = video.videoWidth;
      frameCaptureCanvas.height = video.videoHeight;

      video.play();
      this.init();
    };
  }

  componentWillUnmount = () => {
    window.removeEventListener('resize', this.handleWindowResize);
  }

  dispose = () => {
    this.setState(
      state => Object.assign(state, {isStreaming: false}),
      () => {
        modelScene.dispose();
        renderer.renderLists.dispose();
        this.props.onDispose();
      }
    );
  }

  explore = () => {
    this.setState(state => Object.assign(state, {isExploring: !state.isExploring}))
  }

  render = () => {
    return <div>
      {this.state.isModelLoading
        ? <LoadingProgressOverlay progress={this.state.modelLoadingProgress} />
        : <React.Fragment>
          <AppBar position="fixed">
            <Toolbar>
              <IconButton edge="start" color="inherit" aria-label="menu">
                <MenuIcon />
              </IconButton>
              <Button onClick={this.dispose} color="inherit">Dispose</Button>
              <Button onClick={this.explore} color={this.state.isExploring ? "secondary" : "inherit"}>Explore</Button>
            </Toolbar>
          </AppBar>
        </React.Fragment>
      }
      <video id="video" ref={this.video}></video>
      <canvas id="canvasOutput" ref={this.canvasOutput}></canvas>
    </div>
  }
}

const LoadingProgressOverlay = (props) => (
  <div className="loading-progress-overlay">
    <Container>
      <Typography variant="h5">Loading</Typography>
      {props.progress && <ProgressBar value={props.progress} />}
    </Container>
  </div>
)

export default AugmentedStream