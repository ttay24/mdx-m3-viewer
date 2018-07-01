import Blp from '../blp/handler';
import Tga from '../tga/handler';
import ImageTexture from '../imagetexture/handler';
import Model from './model';
import ModelView from './modelview';
import Bucket from './bucket';
import ModelInstance from './modelinstance';
import shaders from './shaders';

export default {
  load(viewer) {
    viewer.addHandler(Blp);
    viewer.addHandler(Tga);
    viewer.addHandler(ImageTexture);

    let standardShader = viewer.loadShader('MdxStandardShader', shaders.vs, shaders.fs);
    let particleShader = viewer.loadShader('MdxParticleShader', shaders.vsParticles, shaders.fsParticles);

    // If a shader failed to compile, don't allow the handler to be registered, and send an error instead.
    return standardShader.ok && particleShader.ok;
  },

  extensions: [['.mdx', 'arrayBuffer'], ['.mdl', 'text']],
  Constructor: Model,
  View: ModelView,
  Bucket: Bucket,
  Instance: ModelInstance,
};
