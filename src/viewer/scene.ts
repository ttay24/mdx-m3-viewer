import { vec3, vec4 } from 'gl-matrix';
import ModelViewer from './viewer';
import Camera from './camera';
import Grid from './grid';
import ModelInstance from './modelinstance';
import BatchedInstance from './batchedinstance';
import ResourceMapper from './resourcemapper';
import RenderBatch from './renderbatch';
import EmittedObjectUpdater from './emittedobjectupdater';

/**
 * A scene.
 *
 * Every scene has its own list of model instances, and its own camera and viewport.
 *
 * In addition, every scene may have its own AudioContext if enableAudio() is called.
 * If audio is enabled, the AudioContext's listener's location will be updated automatically.
 * Note that due to browser policies, this may be done only after user interaction with the web page.
 */
export default class Scene {
  viewer: ModelViewer;
  camera: Camera = new Camera();
  grid: Grid = new Grid(-100000, -100000, 200000, 200000, 200000, 200000);
  visibleCells: number = 0;
  visibleInstances: number = 0;
  updatedParticles: number = 0;
  audioEnabled: boolean = false;
  audioContext?: AudioContext;
  instances: ModelInstance[] = [];
  currentInstance: number = 0;
  batchedInstances: BatchedInstance[] = [];
  currentBatchedInstance: number = 0;
  batches: Map<ResourceMapper, RenderBatch> = new Map();
  emittedObjectUpdater: EmittedObjectUpdater = new EmittedObjectUpdater();
  /**
   * Similar to WebGL's own `alpha` parameter.
   * 
   * If false, the scene will be cleared before rendering, meaning that scenes behind it won't be visible through it.
   * 
   * If true, alpha works as usual.
   */
  alpha: boolean = false;
  /**
   * The scene's background color.
   * 
   * Only used if `alpha` is false.
   */
  color: vec3 = vec3.create();
  /**
   * The area on the canvas in which this scene is rendered.
   * 
   * Defaults to the entire canvas.
   * 
   * The vector defines [x, y, width, height], sizes are in pixels, and everything is related to the bottom left corner of the canvas.
   */
  viewport: vec4 = vec4.create();

  constructor(viewer: ModelViewer) {
    this.viewer = viewer;

    let canvas = viewer.canvas;
    let width = canvas.width;
    let height = canvas.height;

    // Use the whole canvas by default.
    this.viewport[2] = width;
    this.viewport[3] = height;

    // And standard perspective projection.
    this.camera.perspective(Math.PI / 4, width / height, 8, 10000);
  }

  /**
   * Creates an AudioContext if one wasn't created already, and resumes it if needed.
   * 
   * The returned promise will resolve to whether it is actually running or not.
   * 
   * It may stay in suspended state indefinitly until the user interacts with the page, due to browser policies.
   */
  async enableAudio() {
    if (typeof AudioContext === 'function') {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state !== 'suspended') {
        await this.audioContext.resume();
      }

      this.audioEnabled = this.audioContext.state === 'running';

      return this.audioEnabled;
    }

    return false;
  }

  /**
   * Suspend the audio context.
   */
  disableAudio() {
    if (this.audioContext) {
      this.audioContext.suspend();
    }

    this.audioEnabled = false;
  }

  /**
   * Sets the scene of the given instance.
   * 
   * Equivalent to instance.setScene(scene).
   */
  addInstance(instance: ModelInstance) {
    if (instance.scene !== this) {
      if (instance.scene) {
        instance.scene.removeInstance(instance);
      }

      instance.scene = this;

      this.grid.moved(instance);

      return true;
    }

    return false;
  }

  /**
   * Remove the given instance from this scene.
   * 
   * Equivalent to ModelInstance.detach().
   */
  removeInstance(instance: ModelInstance) {
    if (instance.scene === this) {
      this.grid.remove(instance);

      instance.scene = undefined;

      return true;
    }

    return false;
  }

  /**
   * Clear this scene.
   */
  clear() {
    // First remove references to this scene stored in the instances.
    for (let cell of this.grid.cells) {
      for (let instance of cell.instances) {
        instance.scene = undefined;
      }
    }

    // Then remove references to the instances.
    this.grid.clear();
  }

  /**
   * Detach this scene from the viewer.
   * 
   * Equivalent to viewer.removeScene(scene).
   */
  detach() {
    if (this.viewer) {
      return this.viewer.removeScene(this);
    }

    return false;
  }

  addToBatch(instance: BatchedInstance) {
    let resourceMapper = instance.resourceMapper;
    let batches = this.batches;
    let batch = batches.get(resourceMapper);

    if (!batch) {
      batch = instance.getBatch(resourceMapper);

      batches.set(resourceMapper, batch);
    }

    batch.add(instance);
  }

  /**
   * Update this scene.
   */
  update(dt: number) {
    let camera = this.camera;

    // Update the camera.
    camera.update();

    // Update the audio context's position if it exists.
    if (this.audioContext) {
      let [x, y, z] = camera.location;
      let [forwardX, forwardY, forwardZ] = camera.directionY;
      let [upX, upY, upZ] = camera.directionZ;
      let listener = this.audioContext.listener;

      listener.setPosition(-x, -y, -z);
      listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }

    let frame = this.viewer.frame;

    let instances = this.instances;
    let batchedInstances = this.batchedInstances;

    let currentInstance = 0;
    let currentBatchedInstance = 0;

    this.visibleCells = 0;
    this.visibleInstances = 0;

    // Update and collect all of the visible instances.
    for (let cell of this.grid.cells) {
      if (cell.isVisible(camera)) {
        this.visibleCells += 1;

        for (let instance of cell.instances) {
          if (instance.rendered && instance.cullFrame < frame && instance.isVisible(camera)) {
            instance.cullFrame = frame;

            if (instance.updateFrame < frame) {
              instance.update(dt, this);
            }

            if (instance.isBatched()) {
              batchedInstances[currentBatchedInstance++] = <BatchedInstance>instance;
            } else {
              instances[currentInstance++] = instance;
            }

            this.visibleInstances += 1;
          }
        }
      }
    }

    batchedInstances.length = currentBatchedInstance;

    instances.length = currentInstance;
    instances.sort((a, b) => b.depth - a.depth);

    this.emittedObjectUpdater.update(dt);
    this.updatedParticles = this.emittedObjectUpdater.alive;
  }

  /**
   * Use the scene's viewport.
   * 
   * Should be called before `renderOpaque()` and `renderTranslucent()`.
   * 
   * Called automatically by `render()`.
   */
  startFrame() {
    let gl = this.viewer.gl;
    let viewport = this.viewport;

    // Set the viewport.
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);

    // Allow to render only in the viewport.
    gl.scissor(viewport[0], viewport[1], viewport[2], viewport[3]);

    // If this scene doesn't want alpha, clear it.
    if (!this.alpha) {
      let color = this.color;

      gl.depthMask(true);
      gl.clearColor(color[0], color[1], color[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  }

  /**
   * Render all opaque things in this scene.
   */
  renderOpaque() {
    // Clear all of the batches.
    for (let batch of this.batches.values()) {
      batch.clear();
    }

    // Add all of the batched instances to batches.
    for (let instance of this.batchedInstances) {
      this.addToBatch(instance);
    }

    // Render all of the batches.
    for (let batch of this.batches.values()) {
      batch.render();
    }

    // Render all of the opaque things of non-batched instances.
    for (let instance of this.instances) {
      instance.renderOpaque();
    }
  }

  /**
   * Renders all translucent things in this scene.
   */
  renderTranslucent() {
    for (let instance of this.instances) {
      instance.renderTranslucent();
    }
  }

  /**
   * Render this scene.
   */
  render() {
    this.startFrame();
    this.renderOpaque();
    this.renderTranslucent();
  }

  /**
   * Clear all of the emitted objects in this scene.
   */
  clearEmittedObjects() {
    for (let object of this.emittedObjectUpdater.objects) {
      object.health = 0;
    }
  }
}
