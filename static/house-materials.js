/* Prebaked PBR maps: works over HTTP and when opening index.html as file://. */
(() => {
  "use strict";
  function create(THREE, renderer, prefix = "") {
    const facadeLayout = prefix ? window.WOOD_FACADE_LAYOUT : window.HOUSE_FACADE_LAYOUT;
    if (!facadeLayout) throw new Error('Missing metric house facade atlas. Rebuild house textures.');
    const facadeRects = facadeLayout.rects.map(r => new THREE.Vector4(...r));
    function facadeTile(width, height, kind, phase = 0) {
      const key = `${width.toFixed(3)}:${height.toFixed(3)}`;
      if (!facadeLayout.tiles[key]) throw new Error(`Missing facade size ${key}. Rebuild house textures.`);
      return facadeLayout.tiles[key][kind + phase * 4];
    }
    const pending = [];
    const errors = [];
    function texture(key, srgb, repeat = false) {
      // Leave version at zero until the real image is decoded. Uploading a tiny
      // placeholder first allocates immutable WebGL2 storage at the wrong size;
      // replacing its image later cannot resize that storage in Three r160.
      const t = new THREE.Texture(); t.name = key;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      pending.push(new Promise(resolve => {
        const image = new Image();
        image.onload = () => { t.image = image; t.needsUpdate = true; resolve(); };
        image.onerror = () => { errors.push(key); resolve(); };
        const data = window.HOUSE_TEXTURE_DATA && window.HOUSE_TEXTURE_DATA[prefix + key];
        if (!data) { errors.push(key); resolve(); } else image.src = data;
      }));
      return t;
    }
    const maps = {
      color: texture("color", true),
      normal: texture("normal", false),
      rough: texture("rough", false),
      emission: texture("emission", true),
    };
    // Three's derivative tangent frame scales both axes by the larger one.
    // Undo the non-square atlas aspect so relief is equally strong in X and Y.
    const atlasShortSide = Math.min(facadeLayout.width, facadeLayout.height);
    const material = new THREE.MeshStandardMaterial({
      map: maps.color, normalMap: maps.normal,
      normalScale: new THREE.Vector2(facadeLayout.width / atlasShortSide, facadeLayout.height / atlasShortSide),
      roughnessMap: maps.rough, roughness: 1, metalness: 0,
      emissiveMap: maps.emission, emissive: 0xffffff, emissiveIntensity: 0.45,
    });
    material.name = prefix ? "Log facade atlas" : "Medieval stone facade atlas";
    material.onBeforeCompile = shader => {
      shader.uniforms = shader.uniforms || {};
      shader.uniforms.houseFacadeRects = { value: facadeRects };
      shader.vertexShader = `attribute vec4 houseFacade;\nuniform vec4 houseFacadeRects[${facadeRects.length}];\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `
        #include <uv_vertex>
        float tile = normal.x > 0.5 ? houseFacade.x : normal.x < -0.5 ? houseFacade.y : normal.z > 0.5 ? houseFacade.z : houseFacade.w;
        vec4 facadeRect = houseFacadeRects[int(tile + 0.5)];
        vec2 facadeUv = facadeRect.xy + uv * facadeRect.zw;
        vMapUv = facadeUv;
        vNormalMapUv = facadeUv;
        vRoughnessMapUv = facadeUv;
        vEmissiveMapUv = facadeUv;
      `);
    };
    material.customProgramCacheKey = () => `medieval-facade-metric-v2-${facadeRects.length}`;

    const roofMaps = { color: texture("roofColor", true, true), normal: texture("roofNormal", false, true) };
    const roofNormals = prefix ? [roofMaps.normal, texture("roofNormal1", false, true), texture("roofNormal2", false, true)] : [roofMaps.normal];
    const stoneMaps = { color: texture("stoneColor", true, true), normal: texture("stoneNormal", false, true) };
    function configureStoneMaterial(stoneMaterial) {
      stoneMaterial.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
          #include <uv_vertex>
          vec3 stoneScale = vec3(1.0);
          float stoneBaseY = 0.0;
          #ifdef USE_INSTANCING
            stoneScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            stoneBaseY = instanceMatrix[3].y;
          #endif
          float stoneX = (0.5 + (normal.z < 0.0 ? -position.x : position.x)) * stoneScale.x;
          vec2 stoneUv = vec2(stoneX, position.y * stoneScale.y + stoneBaseY) / 1.8;
          vMapUv = stoneUv;
          vNormalMapUv = stoneUv;
        `);
      };
      stoneMaterial.customProgramCacheKey = () => 'gable-stone-metric-v1';
    }
    // Project each flat slope in physical space, including instance scale.
    // Rows stay straight and tiles do not narrow towards a pyramid's apex.
    function configureRoofMaterial(roofMaterial) {
      roofMaterial.onBeforeCompile = shader => {
        if (prefix) {
          shader.uniforms.woodNormal1 = { value: roofNormals[1] };
          shader.uniforms.woodNormal2 = { value: roofNormals[2] };
          shader.vertexShader = 'attribute float roofNormalVariant;\nvarying float vRoofNormalVariant;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoofNormalVariant = roofNormalVariant;');
          shader.fragmentShader = `
            uniform sampler2D woodNormal1;
            uniform sampler2D woodNormal2;
            varying float vRoofNormalVariant;
            vec4 sampleWoodNormal(vec2 uv) {
              if (vRoofNormalVariant > 1.5) return texture2D(woodNormal2, uv);
              return texture2D(woodNormal1, uv);
            }
          ` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
            THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )',
              '(vRoofNormalVariant < 0.5 ? texture2D(normalMap, vNormalMapUv) : sampleWoodNormal(vNormalMapUv))'));
        }
        shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `
          #include <uv_vertex>
          vec3 roofScale = vec3(1.0);
          #ifdef USE_INSTANCING
            roofScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          #endif
          vec3 roofPoint = position * roofScale;
          vec3 roofN = normalize(normal / roofScale);
          vec3 roofU = abs(roofN.y) > 0.999 ? vec3(1.0,0.0,0.0) : normalize(vec3(roofN.z,0.0,-roofN.x));
          vec3 roofV = normalize(cross(roofN,roofU));
          // One texture repeat spans 0.9 m: tiles are 2x smaller on both axes.
          vec2 roofUv = vec2(dot(roofPoint,roofU),dot(roofPoint,roofV)) / 0.9;
          vMapUv = roofUv;
          vNormalMapUv = roofUv;
        `);
      };
      roofMaterial.customProgramCacheKey = () => prefix ? "wood-roof-instanced-variants-v1" : "roof-planar-metric-v3";
    }
    const result = { material, maps, roofMaps, roofNormals, stoneMaps, facadeTile, configureRoofMaterial, configureStoneMaterial, status: "loading", ready: null };
    result.ready = Promise.all(pending).then(() => {
      result.status = errors.length ? "error" : "ready";
      if (errors.length) console.error("House textures failed:", errors.join(", "));
      return result;
    });
    return result;
  }
  window.MedievalHouses = { create };
})();
