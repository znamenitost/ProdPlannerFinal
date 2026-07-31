import { useEffect, useRef } from 'react';

/**
 * WebGL compositor for the Blender-rendered keychain passes.
 *
 * Passes (same resolution, aligned camera):
 *   beauty.png       bare-metal keychain, transparent bg
 *   print_white.png  print zone as white diffuse — scene lighting multiplier
 *   print_gloss.png  print zone as glossy white ink — (gloss - white) = specular
 *   uv.png           R/G = print-zone UV (0..1, v up), A = zone mask
 *
 * Logo transform lives in zone-UV space: centered rect of `draw` size,
 * translated/rotated/scaled like the CSS controls in MockupPanel.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D tBeauty;
uniform sampler2D tWhite;
uniform sampler2D tGloss;
uniform sampler2D tUV;
uniform sampler2D tLogo;

uniform vec2 uDraw;     // logo box size in zone-UV units
uniform vec2 uOffset;   // offset in zone-UV units
uniform float uRot;     // radians, counter-clockwise (y-up space)
uniform float uScale;
uniform float uHasLogo;

void main() {
  vec4 beauty = texture(tBeauty, vUv);
  vec4 zone = texture(tUV, vUv);
  vec3 col = beauty.rgb;
  float alpha = beauty.a;

  if (zone.a > 0.001 && uHasLogo > 0.5) {
    vec2 p = (zone.rg - 0.5) / uDraw;
    p -= uOffset;
    p /= uScale;
    float c = cos(uRot);
    float s = sin(uRot);
    p = mat2(c, -s, s, c) * p;
    vec2 luv = p + 0.5;

    if (all(greaterThanEqual(luv, vec2(0.0))) && all(lessThanEqual(luv, vec2(1.0)))) {
      vec4 logo = texture(tLogo, luv);
      vec3 lightMul = texture(tWhite, vUv).rgb;
      vec3 spec = max(texture(tGloss, vUv).rgb - lightMul, vec3(0.0));
      vec3 lit = logo.rgb * lightMul + spec * logo.a;
      float m = logo.a * zone.a;
      col = mix(col, lit, m);
      alpha = max(alpha, zone.a);
    }
  }

  // drawing buffer is premultiplied
  outColor = vec4(col * alpha, alpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  }
  return sh;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    img.src = src;
  });
}

function makeTexture(gl, img, { mipmaps = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mipmaps) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

// Zone physical aspect (mm) from the production spec
const ZONE_W_MM = 41.0993;
const ZONE_H_MM = 66.1002;
const LOGO_MARGIN = 0.85;

export default function KeychainMockupCanvas({ passesUrl, logoUrl, transform, className, style }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const texturesRef = useRef({});

  useEffect(() => {
    let gl;
    let prog;
    const canvas = canvasRef.current;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
      if (!gl) return undefined;

      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return undefined;
      }
      gl.useProgram(prog);
    } catch (e) {
      console.error('WebGL mockup init failed', e);
      return undefined;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {};
    for (const name of ['tBeauty', 'tWhite', 'tGloss', 'tUV', 'tLogo', 'uDraw', 'uOffset', 'uRot', 'uScale', 'uHasLogo']) {
      uniforms[name] = gl.getUniformLocation(prog, name);
    }

    stateRef.current = { gl, prog, uniforms, passes: null, logoTex: null, logoAspect: 1 };
    let cancelled = false;

    const passNames = ['beauty', 'print_white', 'print_gloss', 'uv'];
    Promise.all(passNames.map((n) => loadImage(`${passesUrl}/${n}.png`))).then((imgs) => {
      if (cancelled || !stateRef.current) return;
      const textures = imgs.map((img) => makeTexture(gl, img));
      texturesRef.current = Object.fromEntries(passNames.map((n, i) => [n, textures[i]]));
      stateRef.current.passes = texturesRef.current;
      draw();
    }).catch((e) => console.error(e));

    return () => {
      cancelled = true;
      stateRef.current = null;
      // NB: no WEBGL_lose_context here — React StrictMode remounts effects on the
      // same canvas, and getContext would return the already-lost context.
      for (const tex of Object.values(texturesRef.current)) gl.deleteTexture(tex);
      texturesRef.current = {};
      gl.deleteProgram(prog);
      gl.deleteBuffer(quad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passesUrl]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (!logoUrl) {
      st.logoTex = null;
      draw();
      return;
    }
    let cancelled = false;
    loadImage(logoUrl).then((img) => {
      if (cancelled || !stateRef.current) return;
      const { gl } = stateRef.current;
      if (stateRef.current.logoTex) gl.deleteTexture(stateRef.current.logoTex);
      stateRef.current.logoTex = makeTexture(gl, img, { mipmaps: true });
      stateRef.current.logoAspect = img.naturalWidth / img.naturalHeight || 1;
      draw();
    }).catch((e) => console.error(e));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform?.scale, transform?.x, transform?.y, transform?.rotation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const st = stateRef.current;
    const canvas = canvasRef.current;
    if (!st || !canvas) return;
    const { gl, uniforms, passes, logoTex, logoAspect } = st;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!passes) return;

    const bind = (unit, tex, uniformName) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniforms[uniformName], unit);
    };
    bind(0, passes.beauty, 'tBeauty');
    bind(1, passes.print_white, 'tWhite');
    bind(2, passes.print_gloss, 'tGloss');
    bind(3, passes.uv, 'tUV');

    const t = transform || {};
    const scale = t.scale ?? 1;
    const tx = t.x ?? 0;
    const ty = t.y ?? 0;
    const rot = t.rotation ?? 0;

    let drawW = LOGO_MARGIN;
    let drawH = LOGO_MARGIN;
    const k = ZONE_W_MM / ZONE_H_MM;
    if (logoAspect >= k) {
      drawH = LOGO_MARGIN * k / logoAspect;
    } else {
      drawW = LOGO_MARGIN * logoAspect / k;
    }

    if (logoTex) {
      bind(4, logoTex, 'tLogo');
      gl.uniform1f(uniforms.uHasLogo, 1);
    } else {
      gl.uniform1f(uniforms.uHasLogo, 0);
    }
    gl.uniform2f(uniforms.uDraw, drawW, drawH);
    // CSS: translate(x·40%, y·40%↓), rotate clockwise — convert to y-up space
    gl.uniform2f(uniforms.uOffset, tx * 0.4 * drawW, -ty * 0.4 * drawH);
    gl.uniform1f(uniforms.uRot, (rot * Math.PI) / 180);
    gl.uniform1f(uniforms.uScale, scale);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
