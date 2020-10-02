/* eslint-disable no-else-return */
/* eslint-disable no-useless-escape */
import React, { Component } from 'react';
import AugmentedStream from './AugmentedStream';
import Screensaver from './Screensaver';
import DeviceMenu from './DeviceMenu';
import ModelMenu from './ModelMenu';
import checkBrowserUserAgent from '../utils';

import models from '../models-config';

const initialState = {
  error: null,
  isWaitingCamera: false,
  isWaitingForDevice: false,
  isWaitingForModel: false,
  isReadyForStreaming: false,
  browserCheckPassed: true,
};

class App extends Component {
  state = {}
  stream = null

  componentDidMount = () => {
    // Some ads blockers can disable access to media device api. We should check if it possible to request media device
    if (!navigator.mediaDevices.getUserMedia) {
      this.setState({
        ...initialState,
        error: 'Can\'t request device camera. Please, disable ad blocker or try to update your browser.',
      });

      return;
    }

    // Check browswer compatibility
    const browserCheckPassed = checkBrowserUserAgent();

    this.setState({ browserCheckPassed });

    // Do not request media device if browser check failed
    if (!browserCheckPassed) return;

    // Request access to media devices and get device list for allow user choose the device
    this.setState({ isWaitingCamera: true });

    navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      .then((stream) => {
        this.stream = stream;
        this.setState({ ...initialState, isWaitingForDevice: true });
      })
      .catch(this.handleMediaDeviceError);
  }

  /**
   * Invokes when user choose camera
   */
  handleDeviceChoose = (deviceId) => {
    // Stop all running tracks to start new tracks from choosed device
    this.stream.getTracks().forEach((track) => track.stop());

    navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId } })
      .then((stream) => {
        this.stream = stream;
        this.setState({ ...initialState, isWaitingForModel: true });
      })
      .catch(this.handleMediaDeviceError);
  }

  /**
   * Invokes when user choose model
   */
  handleModelChoose = (choosedModelConfig) => {
    this.setState({ ...initialState, isReadyForStreaming: true, choosedModelConfig });
  }

  handleDispose = () => {
    this.setState({
      isReadyForStreaming: false,
      isWaitingForModel: true,
    });
  }

  handleMediaDeviceError = () => {
    this.setState({
      ...initialState,
      error: "Can't get access to your web-camera, please check its connection and reload this page.",
    });
  }

  render = () => {
    const { state } = this;

    if (!state.browserCheckPassed) {
      return <Screensaver icon="../icons/error.svg" message={'You  must be on a mobile or tablet device to continue to Novastack.app'} />;
    } else if (state.isReadyForStreaming) {
      return <AugmentedStream onDispose={this.handleDispose} stream={this.stream} choosedModelConfig={state.choosedModelConfig} />;
    } if (state.isWaitingForModel) {
      return <ModelMenu models={models} onModelChoose={this.handleModelChoose} />;
    } if (state.isWaitingForDevice) {
      return <DeviceMenu onDeviceChoose={this.handleDeviceChoose} />;
    } if (state.isWaitingCamera) {
      return <Screensaver icon="../icons/camera.svg" message="Please, allow access to your camera." />;
    } else if (state.error) {
      return <Screensaver icon="../icons/error.svg" message={state.error} />;
    } else {
      return <Screensaver icon="../icons/trolley.svg" message="Loading..." />;
    }
  }
}

export default App;
