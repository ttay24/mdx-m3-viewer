import Bucket from '../../bucket';

/**
 * An MDX bucket.
 */
export default class extends Bucket {
  /**
   * @param {MdxModelView} modelView
   */
  constructor(modelView) {
    super(modelView);

    let model = this.model;
    let batchSize = model.batchSize;
    let gl = model.viewer.gl;
    let numberOfBones = model.bones.length + 1;

    this.boneArrayInstanceSize = numberOfBones * 16;
    this.boneArray = new Float32Array(this.boneArrayInstanceSize * batchSize);

    this.boneTexture = gl.createTexture();
    this.boneTextureWidth = numberOfBones * 4;
    this.boneTextureHeight = batchSize;
    this.vectorSize = 1 / this.boneTextureWidth;
    this.rowSize = 1 / this.boneTextureHeight;

    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, this.boneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.boneTextureWidth, this.boneTextureHeight, 0, gl.RGBA, gl.FLOAT, this.boneArray);

    // Team colors (per instance)
    this.teamColorArray = new Uint8Array(batchSize);
    this.teamColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.teamColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.teamColorArray, gl.DYNAMIC_DRAW);

    // Vertex color (per instance)
    this.vertexColorArray = new Uint8Array(4 * batchSize);
    this.vertexColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexColorArray, gl.DYNAMIC_DRAW);

    // Geoset colors (per instance per geoset)
    this.geosetColorArrays = [];
    this.geosetColorBuffers = [];

    // Layer alphas (per instance per layer)
    this.layerAlphaArrays = [];
    this.layerAlphaBuffers = [];

    // Texture coordinate animations (per instance per layer)
    this.uvOffsetArrays = [];
    this.uvOffsetBuffers = [];

    this.uvScaleArrays = [];
    this.uvScaleBuffers = [];

    this.uvRotArrays = [];
    this.uvRotBuffers = [];

    // Batches
    if (model.batches.length > 0) {
      for (let i = 0, l = model.geosets.length; i < l; i++) {
        this.geosetColorArrays[i] = new Uint8Array(4 * batchSize);
        this.geosetColorBuffers[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geosetColorBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, this.geosetColorArrays[i], gl.DYNAMIC_DRAW);
      }

      for (let i = 0, l = model.layers.length; i < l; i++) {
        this.uvOffsetArrays[i] = new Float32Array(4 * batchSize);
        this.uvOffsetBuffers[i] = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvOffsetBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvOffsetArrays[i], gl.DYNAMIC_DRAW);

        this.layerAlphaArrays[i] = new Uint8Array(batchSize);
        this.layerAlphaBuffers[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.layerAlphaBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, this.layerAlphaArrays[i], gl.DYNAMIC_DRAW);

        this.uvScaleArrays[i] = new Float32Array(batchSize);
        this.uvScaleBuffers[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvScaleBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvScaleArrays[i], gl.DYNAMIC_DRAW);

        this.uvRotArrays[i] = new Float32Array(batchSize * 2);
        this.uvRotBuffers[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvRotBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvRotArrays[i], gl.DYNAMIC_DRAW);
      }
    }
  }

  /**
   * Fill this bucket with scene data.
   *
   * @param {Object} data
   * @return {number}
   */
  fill(data) {
    let baseIndex = data.baseIndex;
    let model = this.model;
    let gl = model.viewer.gl;
    let batchSize = model.batchSize;
    let geosetCount = model.geosets.length;
    let layerCount = model.layers.length;
    let boneCount = model.bones.length;
    let boneArray = this.boneArray;
    let teamColorArray = this.teamColorArray;
    let vertexColorArray = this.vertexColorArray;
    let geosetColorArrays = this.geosetColorArrays;
    let layerAlphaArrays = this.layerAlphaArrays;
    let uvOffsetArrays = this.uvOffsetArrays;
    let uvScaleArrays = this.uvScaleArrays;
    let uvRotArrays = this.uvRotArrays;
    let instanceOffset = 0;
    let instances = data.instances;
    let particleEmitters = data.particleEmitters;
    let particleEmitters2 = data.particleEmitters2;
    let ribbonEmitters = data.ribbonEmitters;
    let eventObjectEmitters = data.eventObjectEmitters;

    for (let l = instances.length; baseIndex < l && instanceOffset < batchSize; baseIndex++) {
      let instance = instances[baseIndex];

      if (instance.rendered && !instance.culled) {
        let vertexColor = instance.vertexColor;
        let worldMatrices = instance.worldMatrices;
        let geosetColors = instance.geosetColors;
        let layerAlphas = instance.layerAlphas;
        let uvOffsets = instance.uvOffsets;
        let uvScales = instance.uvScales;
        let uvRots = instance.uvRots;
        let base = 16 + instanceOffset * (16 + boneCount * 16);
        let particleEmitterViews = instance.particleEmitters;
        let particleEmitter2Views = instance.particleEmitters2;
        let ribbonEmitterViews = instance.ribbonEmitters;
        let eventObjectEmitterViews = instance.eventObjectEmitters;
        let instanceOffset4 = instanceOffset * 4;

        // Bones
        for (let j = 0, k = boneCount * 16; j < k; j++) {
          boneArray[base + j] = worldMatrices[j];
        }

        // Team color
        teamColorArray[instanceOffset] = instance.teamColor;

        // Vertex color
        vertexColorArray[instanceOffset4] = vertexColor[0];
        vertexColorArray[instanceOffset4 + 1] = vertexColor[1];
        vertexColorArray[instanceOffset4 + 2] = vertexColor[2];
        vertexColorArray[instanceOffset4 + 3] = vertexColor[3];

        for (let geosetIndex = 0; geosetIndex < geosetCount; geosetIndex++) {
          let geosetColorArray = geosetColorArrays[geosetIndex];
          let geosetIndex4 = geosetIndex * 4;

          // Geoset color
          geosetColorArray[instanceOffset4] = geosetColors[geosetIndex4];
          geosetColorArray[instanceOffset4 + 1] = geosetColors[geosetIndex4 + 1];
          geosetColorArray[instanceOffset4 + 2] = geosetColors[geosetIndex4 + 2];
          geosetColorArray[instanceOffset4 + 3] = geosetColors[geosetIndex4 + 3];
        }

        for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
          let layerAlphaArray = layerAlphaArrays[layerIndex];
          let uvOffsetArray = uvOffsetArrays[layerIndex];
          let uvScaleArray = uvScaleArrays[layerIndex];
          let uvRotArray = uvRotArrays[layerIndex];
          let layerIndex4 = layerIndex * 4;

          // Layer alpha
          layerAlphaArray[instanceOffset] = layerAlphas[layerIndex];

          // Texture coordinate animation + sprite animation
          uvOffsetArray[instanceOffset4] = uvOffsets[layerIndex4];
          uvOffsetArray[instanceOffset4 + 1] = uvOffsets[layerIndex4 + 1];
          uvOffsetArray[instanceOffset4 + 2] = uvOffsets[layerIndex4 + 2];
          uvOffsetArray[instanceOffset4 + 3] = uvOffsets[layerIndex4 + 3];

          uvScaleArray[instanceOffset] = uvScales[layerIndex];

          uvRotArray[instanceOffset * 2] = uvRots[layerIndex * 2];
          uvRotArray[instanceOffset * 2 + 1] = uvRots[layerIndex * 2 + 1];
        }

        for (let i = 0, l = particleEmitters.length; i < l; i++) {
          particleEmitters[i].fill(particleEmitterViews[i]);
        }

        for (let i = 0, l = particleEmitters2.length; i < l; i++) {
          particleEmitters2[i].fill(particleEmitter2Views[i]);
        }

        for (let i = 0, l = ribbonEmitters.length; i < l; i++) {
          ribbonEmitters[i].fill(ribbonEmitterViews[i]);
        }

        for (let i = 0, l = eventObjectEmitters.length; i < l; i++) {
          eventObjectEmitters[i].fill(eventObjectEmitterViews[i]);
        }

        instanceOffset += 1;
      }
    }

    // Save the number of instances of which data was copied.
    this.count = instanceOffset;

    if (instanceOffset) {
      gl.activeTexture(gl.TEXTURE15);
      gl.bindTexture(gl.TEXTURE_2D, this.boneTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.boneTextureWidth, instanceOffset, gl.RGBA, gl.FLOAT, boneArray);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.teamColorBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, teamColorArray);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexColorArray);

      for (let i = 0; i < geosetCount; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geosetColorBuffers[i]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, geosetColorArrays[i]);
      }

      for (let i = 0; i < layerCount; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.layerAlphaBuffers[i]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, layerAlphaArrays[i]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvOffsetBuffers[i]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvOffsetArrays[i]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvScaleBuffers[i]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvScaleArrays[i]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvRotBuffers[i]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvRotArrays[i]);
      }
    }

    return baseIndex;
  }
}
