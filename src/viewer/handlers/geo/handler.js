import Model from './model';
import Bucket from './bucket';
import ModelInstance from './modelinstance';
import shaders from './shaders';

export default {
  load(viewer) {
    this.shader = viewer.webgl.createShaderProgram(shaders.vs, shaders.ps);

    // If a shader failed to compile, don't allow the handler to be registered, and send an error instead.
    return this.shader.ok;
  },

  extensions: [['.geo']],
  Constructor: Model,
  Bucket: Bucket,
  Instance: [ModelInstance],

  shader: null,
};
