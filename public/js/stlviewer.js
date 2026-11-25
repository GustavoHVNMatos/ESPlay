// Visualizador 3D leve para arquivos STL binário/ASCII usando WebGL (com fallback em Canvas 2D).

import { $ } from './util.js';
import { reduced } from './preview.js';

export function parseStl(buffer) {
  const len = buffer.byteLength;
  const dv = new DataView(buffer);
  if (len >= 84) {
    const triCount = dv.getUint32(80, true);
    if (84 + triCount * 50 === len) {
      return parseBinaryStl(dv, triCount);
    }
  }
  return parseAsciiStl(new TextDecoder().decode(buffer));
}

function parseBinaryStl(dv, count) {
  const raw = new Float32Array(count * 9);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const off = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const p = off + v * 12;
      const x = dv.getFloat32(p, true);
      const y = dv.getFloat32(p + 4, true);
      const z = dv.getFloat32(p + 8, true);
      const idx = i * 9 + v * 3;
      raw[idx] = x; raw[idx + 1] = y; raw[idx + 2] = z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  return finalizeMesh(raw, count, minX, minY, minZ, maxX, maxY, maxZ);
}

function parseAsciiStl(text) {
  const verts = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const re = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
    verts.push(x, y, z);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const count = Math.floor(verts.length / 9);
  const raw = new Float32Array(verts.slice(0, count * 9));
  return finalizeMesh(raw, count, minX, minY, minZ, maxX, maxY, maxZ);
}

function finalizeMesh(raw, count, minX, minY, minZ, maxX, maxY, maxZ) {
  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.8 / maxDim;

  // 6 floats por vértice: x, y, z, nx, ny, nz
  const data = new Float32Array(count * 3 * 6);
  for (let i = 0; i < count; i++) {
    const i9 = i * 9;
    const ax = (raw[i9] - cx) * scale;
    const ay = (raw[i9 + 1] - cy) * scale;
    const az = (raw[i9 + 2] - cz) * scale;
    const bx = (raw[i9 + 3] - cx) * scale;
    const by = (raw[i9 + 4] - cy) * scale;
    const bz = (raw[i9 + 5] - cz) * scale;
    const cxv = (raw[i9 + 6] - cx) * scale;
    const cyv = (raw[i9 + 7] - cy) * scale;
    const czv = (raw[i9 + 8] - cz) * scale;

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cxv - ax, vy = cyv - ay, vz = czv - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    const o = i * 18;
    data[o] = ax; data[o + 1] = ay; data[o + 2] = az; data[o + 3] = nx; data[o + 4] = ny; data[o + 5] = nz;
    data[o + 6] = bx; data[o + 7] = by; data[o + 8] = bz; data[o + 9] = nx; data[o + 10] = ny; data[o + 11] = nz;
    data[o + 12] = cxv; data[o + 13] = cyv; data[o + 14] = czv; data[o + 15] = nx; data[o + 16] = ny; data[o + 17] = nz;
  }

  return { count, data, size };
}

function makePerspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function makeModelView(rx, rz, dist) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // Ordem: primeiro rotaciona em Z (eixo vertical do OpenSCAD), depois inclina em X e afasta em Z.
  return new Float32Array([
    cz, cx * sz, -sx * sz, 0,
    -sz, cx * cz, -sx * cz, 0,
    0, sx, cx, 0,
    0, 0, -dist, 1,
  ]);
}

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function initStlViewer(host, url) {
  if (!host) return;
  const cv = $('canvas', host);
  const status = $('[data-stl-status]', host);
  const btnSpin = $('[data-stl="spin"]', host);
  const btnReset = $('[data-stl="reset"]', host);
  const btnIn = $('[data-stl="in"]', host);
  const btnOut = $('[data-stl="out"]', host);

  const INIT = { rx: -1.0, rz: 0.45, zoom: 1.0 };
  let rx = INIT.rx, rz = INIT.rz, zoom = INIT.zoom;
  let spinning = !reduced;
  let dragging = false, lx = 0, ly = 0;
  let mesh = null;
  let visible = true;

  const updateSpinBtn = () => {
    if (btnSpin) {
      btnSpin.setAttribute('aria-pressed', String(spinning));
      btnSpin.textContent = spinning ? 'Pausar giro' : 'Girar 3D';
    }
  };
  updateSpinBtn();

  let drawFn = () => {};

  function setupWebGL(m) {
    const gl = cv.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) return false;

    const vs = compileShader(gl, gl.VERTEX_SHADER, `
      attribute vec3 aPos;
      attribute vec3 aNorm;
      uniform mat4 uProj;
      uniform mat4 uView;
      varying vec3 vNorm;
      void main() {
        gl_Position = uProj * uView * vec4(aPos, 1.0);
        vNorm = normalize(mat3(uView) * aNorm);
      }
    `);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vNorm;
      void main() {
        vec3 n = normalize(vNorm);
        if (!gl_FrontFacing) n = -n;
        float key = max(dot(n, normalize(vec3(0.45, 0.75, 0.55))), 0.0);
        float fill = max(dot(n, normalize(vec3(-0.6, -0.3, 0.5))), 0.0);
        vec3 base = vec3(0.89, 0.84, 0.50);
        vec3 col = base * (0.28 + 0.62 * key + 0.18 * fill);
        gl_FragColor = vec4(col, 1.0);
      }
    `);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aNorm = gl.getAttribLocation(prog, 'aNorm');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);

    const uProj = gl.getUniformLocation(prog, 'uProj');
    const uView = gl.getUniformLocation(prog, 'uView');

    gl.enable(gl.DEPTH_TEST);

    drawFn = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(240, Math.round(cv.clientWidth * dpr));
      const h = Math.max(180, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.04, 0.06, 0.09, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uProj, false, makePerspective(0.68, w / h, 0.1, 20));
      gl.uniformMatrix4fv(uView, false, makeModelView(rx, rz, 2.55 / zoom));
      gl.drawArrays(gl.TRIANGLES, 0, m.count * 3);
    };
    return true;
  }

  function setupFallback2D(m) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    drawFn = () => {
      const w = cv.width = Math.max(240, cv.clientWidth);
      const h = cv.height = Math.max(180, cv.clientHeight);
      ctx.fillStyle = '#0A0E14';
      ctx.fillRect(0, 0, w, h);
      const mv = makeModelView(rx, rz, 2.55 / zoom);
      const sc = Math.min(w, h) * 0.85;
      const tris = [];
      for (let i = 0; i < m.count; i++) {
        const o = i * 18;
        let zSum = 0;
        const pts = [];
        for (let v = 0; v < 3; v++) {
          const p = o + v * 6;
          const x = m.data[p], y = m.data[p + 1], z = m.data[p + 2];
          const vx = mv[0] * x + mv[4] * y + mv[8] * z + mv[12];
          const vy = mv[1] * x + mv[5] * y + mv[9] * z + mv[13];
          const vz = mv[2] * x + mv[6] * y + mv[10] * z + mv[14];
          zSum += vz;
          const pr = 1.6 / Math.max(0.4, -vz);
          pts.push([w / 2 + vx * pr * sc, h / 2 - vy * pr * sc]);
        }
        const nx = m.data[o + 3], ny = m.data[o + 4], nz = m.data[o + 5];
        const vnx = mv[0] * nx + mv[4] * ny + mv[8] * nz;
        const vny = mv[1] * nx + mv[5] * ny + mv[9] * nz;
        const vnz = mv[2] * nx + mv[6] * ny + mv[10] * nz;
        const lum = Math.abs(vnx * 0.45 + vny * 0.75 + vnz * 0.55);
        tris.push({ z: zSum / 3, pts, lum });
      }
      tris.sort((a, b) => a.z - b.z);
      for (const t of tris) {
        const k = 0.3 + 0.65 * Math.min(1, t.lum);
        ctx.fillStyle = `rgb(${Math.round(227 * k)},${Math.round(214 * k)},${Math.round(128 * k)})`;
        ctx.beginPath();
        ctx.moveTo(t.pts[0][0], t.pts[0][1]);
        ctx.lineTo(t.pts[1][0], t.pts[1][1]);
        ctx.lineTo(t.pts[2][0], t.pts[2][1]);
        ctx.closePath();
        ctx.fill();
      }
    };
  }

  cv.addEventListener('pointerdown', (e) => {
    dragging = true;
    spinning = false;
    updateSpinBtn();
    lx = e.clientX; ly = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    rz += dx * 0.01;
    rx = Math.max(-1.55, Math.min(0.2, rx + dy * 0.01));
    drawFn();
  });
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => { dragging = false; }));

  if (btnSpin) btnSpin.addEventListener('click', () => { spinning = !spinning; updateSpinBtn(); });
  if (btnReset) btnReset.addEventListener('click', () => { rx = INIT.rx; rz = INIT.rz; zoom = INIT.zoom; drawFn(); });
  if (btnIn) btnIn.addEventListener('click', () => { zoom = Math.min(2.2, zoom + 0.2); drawFn(); });
  if (btnOut) btnOut.addEventListener('click', () => { zoom = Math.max(0.6, zoom - 0.2); drawFn(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(host);
  }

  function tick() {
    if (mesh && visible && spinning && !dragging) {
      rz += 0.006;
      drawFn();
    }
    requestAnimationFrame(tick);
  }

  fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((buf) => {
      mesh = parseStl(buf);
      if (!setupWebGL(mesh)) setupFallback2D(mesh);
      drawFn();
      if (status) {
        const sx = Math.round(mesh.size.x), sy = Math.round(mesh.size.y), sz = Math.round(mesh.size.z);
        status.textContent = `${sx} × ${sy} × ${sz} mm · ${mesh.count.toLocaleString('pt-BR')} triângulos · arraste para girar`;
      }
      requestAnimationFrame(tick);
    })
    .catch(() => {
      if (status) status.textContent = 'Não foi possível carregar o visualizador 3D.';
    });
}
