import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as satellite from 'satellite.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_UNITS = 100;
const KM_TO_UNITS = EARTH_RADIUS_UNITS / EARTH_RADIUS_KM;
const MAX_SATS = 120;
const TRAIL_POINT_CAP = 40;
const TRAIL_SAMPLE_MS = 5000;
const AIRCRAFT_REFRESH_MS = 15000;
const MAX_AIRCRAFT = 300;

const app = document.getElementById('app');
const utcTimeEl = document.getElementById('utcTime');
const satCountEl = document.getElementById('satCount');
const satInfoEl = document.getElementById('satInfo');
const aircraftInfoEl = document.getElementById('aircraftInfo');
const sourceInfoEl = document.getElementById('sourceInfo');
const airSourceInfoEl = document.getElementById('airSourceInfo');
const aircraftCountEl = document.getElementById('aircraftCount');
const speedInput = document.getElementById('speed');
const speedLabel = document.getElementById('speedLabel');
const realtimeBtn = document.getElementById('realtimeBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const showSelectedOrbitEl = document.getElementById('showSelectedOrbit');
const showTrailsEl = document.getElementById('showTrails');
const showAircraftEl = document.getElementById('showAircraft');
const tooltip = document.getElementById('tooltip');

let simTime = new Date();
let lastFrameMs = performance.now();
let timeScale = Number(speedInput.value);
let paused = false;

let satellites = [];
let aircraft = [];
let hovered = null;
let selectedSat = null;
let selectedAircraft = null;
let lastTrailSample = 0;
let lastOrbitRebuildMs = 0;
let aircraftFetchInFlight = false;
let lastAircraftFetchMs = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040c);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 130, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
app.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 130;
controls.maxDistance = 800;

scene.add(new THREE.AmbientLight(0x4c5a75, 0.32));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(500, 100, 200);
scene.add(sunLight);

const textureLoader = new THREE.TextureLoader();
const txDay = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg');
const txNight = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png');
const txClouds = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png');
const txStars = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/galaxy_starfield.png');

const starGeo = new THREE.SphereGeometry(2500, 64, 64);
const starMat = new THREE.MeshBasicMaterial({ map: txStars, side: THREE.BackSide });
scene.add(new THREE.Mesh(starGeo, starMat));

const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 96, 96);
const earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayMap: { value: txDay },
    nightMap: { value: txNight },
    sunDir: { value: sunLight.position.clone().normalize() },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
      vUv = uv;
      vNormalW = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3 sunDir;
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
      vec3 day = texture2D(dayMap, vUv).rgb;
      vec3 night = texture2D(nightMap, vUv).rgb;
      float ndl = max(dot(normalize(vNormalW), normalize(sunDir)), -0.2);
      float dayFactor = smoothstep(-0.08, 0.2, ndl);
      vec3 color = mix(night * 1.2, day, dayFactor);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(earthGeo, earthMat));

const cloud = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.007, 64, 64),
  new THREE.MeshLambertMaterial({ map: txClouds, transparent: true, opacity: 0.28, depthWrite: false })
);
scene.add(cloud);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.03, 64, 64),
  new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vNormal; void main(){ float i = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.0); gl_FragColor = vec4(0.35,0.6,1.0,1.0) * i; }`,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })
);
scene.add(atmosphere);

const satGroup = new THREE.Group();
const satTrailGroup = new THREE.Group();
const selectedOrbitGroup = new THREE.Group();
const aircraftGroup = new THREE.Group();
scene.add(satGroup, satTrailGroup, selectedOrbitGroup, aircraftGroup);

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 3;
const pointer = new THREE.Vector2();

function geodeticToVec3(latRad, lonRad, heightKm) {
  const r = EARTH_RADIUS_UNITS + heightKm * KM_TO_UNITS;
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    r * cosLat * Math.cos(lonRad),
    r * Math.sin(latRad),
    r * cosLat * Math.sin(lonRad)
  );
}

function setPointer(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

function formatSatelliteInfo(s) {
  if (!s || !s.lastGeo) return 'Click a satellite…';
  const altKm = s.lastGeo.height?.toFixed(2) ?? 'n/a';
  const latDeg = satellite.degreesLat(s.lastGeo.latitude).toFixed(3);
  const lonDeg = satellite.degreesLong(s.lastGeo.longitude).toFixed(3);
  const speed = s.lastSpeedKmS ? `${s.lastSpeedKmS.toFixed(3)} km/s` : 'n/a';
  return `Name: ${s.name}\nNORAD: ${s.norad || 'n/a'}\nLat: ${latDeg}°\nLon: ${lonDeg}°\nAlt: ${altKm} km\nSpeed: ${speed}\nEpoch: ${s.epoch || 'n/a'}`;
}

function formatAircraftInfo(a) {
  if (!a || !a.data) return 'Click an aircraft…';
  const d = a.data;
  return `Callsign: ${d.callsign || 'n/a'}\nICAO24: ${d.icao24}\nCountry: ${d.origin_country || 'n/a'}\nLat: ${d.latitude.toFixed(3)}°\nLon: ${d.longitude.toFixed(3)}°\nAlt: ${d.altitudeKm?.toFixed(2) ?? 'n/a'} km\nSpeed: ${d.velocity ? d.velocity.toFixed(1) + ' m/s' : 'n/a'}\nHeading: ${d.true_track ? d.true_track.toFixed(1) + '°' : 'n/a'}`;
}

function clearSatSelection() {
  if (!selectedSat) return;
  selectedSat.mesh.scale.setScalar(1);
  selectedSat.mesh.material.emissiveIntensity = 0.5;
  selectedSat = null;
  satInfoEl.textContent = 'Click a satellite…';
  selectedOrbitGroup.clear();
}

function selectSatellite(s) {
  clearAircraftSelection();
  if (selectedSat && selectedSat !== s) {
    selectedSat.mesh.scale.setScalar(1);
    selectedSat.mesh.material.emissiveIntensity = 0.5;
  }
  selectedSat = s;
  selectedSat.mesh.scale.setScalar(1.8);
  selectedSat.mesh.material.emissiveIntensity = 1.5;
  satInfoEl.textContent = formatSatelliteInfo(selectedSat);
  rebuildSelectedOrbit();
}

function clearAircraftSelection() {
  if (!selectedAircraft) return;
  selectedAircraft.mesh.scale.setScalar(1);
  selectedAircraft.mesh.material.emissiveIntensity = 0.2;
  selectedAircraft = null;
  aircraftInfoEl.textContent = 'Click an aircraft…';
}

function selectAircraft(a) {
  clearSatSelection();
  if (selectedAircraft && selectedAircraft !== a) {
    selectedAircraft.mesh.scale.setScalar(1);
    selectedAircraft.mesh.material.emissiveIntensity = 0.2;
  }
  selectedAircraft = a;
  selectedAircraft.mesh.scale.setScalar(2.0);
  selectedAircraft.mesh.material.emissiveIntensity = 0.9;
  aircraftInfoEl.textContent = formatAircraftInfo(selectedAircraft);
}

function makeSatVisual(name) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe29a, emissive: 0xff9a2f, emissiveIntensity: 0.75 })
  );
  mesh.userData.kind = 'sat';

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = name;
  labelEl.style.display = 'none';
  const label = new CSS2DObject(labelEl);
  label.position.set(0, 2.2, 0);
  mesh.add(label);

  const trailLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x7ed7ff, transparent: true, opacity: 0.95, depthTest: false })
  );
  trailLine.renderOrder = 5;
  trailLine.visible = false;
  satTrailGroup.add(trailLine);

  return { mesh, labelEl, trailLine };
}

function buildTrailGeometry(s) {
  if (s.trailPositions.length < 2) {
    s.trailLine.visible = false;
    return;
  }
  s.trailLine.geometry.setFromPoints(s.trailPositions);
  s.trailLine.visible = showTrailsEl.checked;
}

function rebuildSelectedOrbit() {
  selectedOrbitGroup.clear();
  if (!selectedSat || !showSelectedOrbitEl.checked) return;

  const periodMin = selectedSat.satrec?.no ? (2 * Math.PI / selectedSat.satrec.no) : 96;
  const totalMinutes = Math.min(220, Math.max(70, periodMin));
  const points = [];
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * totalMinutes * 60 * 1000;
    const d = new Date(simTime.getTime() + t);
    const pv = satellite.propagate(selectedSat.satrec, d);
    if (!pv.position) continue;
    const gmst = satellite.gstime(d);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    points.push(geodeticToVec3(geo.latitude, geo.longitude, geo.height));
  }

  if (points.length >= 2) {
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x00ffd5, transparent: true, opacity: 0.98, depthTest: false })
    );
    orbit.renderOrder = 6;
    selectedOrbitGroup.add(orbit);
  }
}

async function loadTLEs() {
  const urls = [
    'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
    'https://celestrak.org/NORAD/elements/stations.txt',
  ];

  let tleText = '';
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      tleText = await res.text();
      sourceInfoEl.textContent = `${url}`;
      break;
    } catch {
      // try next source
    }
  }

  if (!tleText) {
    sourceInfoEl.textContent = 'Failed to load Celestrak. Using fallback TLE set.';
    tleText = `ISS (ZARYA)\n1 25544U 98067A   26061.59097222  .00016332  00000+0  29788-3 0  9992\n2 25544  51.6394  14.8382 0006152 246.0876 164.7286 15.50037705441021\nHST\n1 20580U 90037B   26061.19363426  .00000589  00000+0  24769-4 0  9998\n2 20580  28.4694  37.8027 0002412  57.3929 302.7468 15.23723044749084\nNOAA 19\n1 33591U 09005A   26061.54958764  .00000070  00000+0  68301-4 0  9990\n2 33591  99.1938 131.4331 0014293 158.4561 201.7334 14.12426052885033`;
  }

  const lines = tleText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = [];
  for (let i = 0; i < lines.length - 2 && parsed.length < MAX_SATS; i++) {
    const name = lines[i];
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (l1?.startsWith('1 ') && l2?.startsWith('2 ')) {
      try {
        const satrec = satellite.twoline2satrec(l1, l2);
        const norad = (l1.slice(2, 7) || '').trim();
        parsed.push({
          name,
          satrec,
          norad,
          epoch: satrec?.epochyr ? `${satrec.epochyr}-${satrec.epochdays?.toFixed(3)}` : 'n/a'
        });
        i += 2;
      } catch {
        // ignore malformed set
      }
    }
  }

  satellites = parsed.map((s) => {
    const visual = makeSatVisual(s.name);
    satGroup.add(visual.mesh);
    return {
      ...s,
      mesh: visual.mesh,
      labelEl: visual.labelEl,
      trailLine: visual.trailLine,
      trailPositions: [],
      lastGeo: null,
      lastSpeedKmS: null
    };
  });

  satCountEl.textContent = String(satellites.length);
}

function updateSatellites(nowDate, sampleTrailNow) {
  for (const s of satellites) {
    const pv = satellite.propagate(s.satrec, nowDate);
    if (!pv.position || !pv.velocity) {
      s.mesh.visible = false;
      s.trailLine.visible = false;
      continue;
    }
    s.mesh.visible = true;

    const gmst = satellite.gstime(nowDate);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    s.lastGeo = geo;

    const speedKmS = Math.sqrt(
      pv.velocity.x * pv.velocity.x +
      pv.velocity.y * pv.velocity.y +
      pv.velocity.z * pv.velocity.z
    );
    s.lastSpeedKmS = speedKmS;

    const p = geodeticToVec3(geo.latitude, geo.longitude, geo.height);
    s.mesh.position.copy(p);

    const dist = camera.position.distanceTo(s.mesh.position);
    s.labelEl.style.display = (selectedSat === s || dist < 320) ? 'block' : 'none';

    if (showTrailsEl.checked && sampleTrailNow) {
      s.trailPositions.push(p.clone());
      if (s.trailPositions.length > TRAIL_POINT_CAP) s.trailPositions.shift();
      buildTrailGeometry(s);
    } else if (!showTrailsEl.checked) {
      s.trailLine.visible = false;
    }
  }
}

function makeAircraftVisual() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x4dffd2, emissive: 0x1f8f74, emissiveIntensity: 0.55 })
  );
  mesh.userData.kind = 'aircraft';
  return mesh;
}

async function refreshAircraftLayer() {
  if (!showAircraftEl.checked || aircraftFetchInFlight) return;
  aircraftFetchInFlight = true;
  try {
    airSourceInfoEl.textContent = 'Updating aircraft…';
    const res = await fetch('/api/aircraft?limit=' + MAX_AIRCRAFT, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const states = payload.states || [];

    const nextMap = new Map();
    for (const row of states) {
      const icao24 = row[0]?.trim();
      const callsign = row[1]?.trim() || '';
      const origin_country = row[2] || '';
      const longitude = row[5];
      const latitude = row[6];
      const baroAlt = row[7];
      const on_ground = !!row[8];
      const velocity = row[9];
      const true_track = row[10];
      if (!icao24 || typeof latitude !== 'number' || typeof longitude !== 'number') continue;
      if (on_ground) continue;

      const altitudeKm = typeof baroAlt === 'number' ? Math.max(0.5, baroAlt / 1000) : 10;
      nextMap.set(icao24, {
        icao24,
        callsign,
        origin_country,
        latitude,
        longitude,
        altitudeKm,
        velocity,
        true_track,
      });
    }

    const existing = new Map(aircraft.map((a) => [a.id, a]));
    const nextAircraft = [];

    for (const [id, data] of nextMap) {
      let obj = existing.get(id);
      if (!obj) {
        const mesh = makeAircraftVisual();
        aircraftGroup.add(mesh);
        obj = { id, mesh, data };
      } else {
        existing.delete(id);
        obj.data = data;
      }
      const p = geodeticToVec3(THREE.MathUtils.degToRad(data.latitude), THREE.MathUtils.degToRad(data.longitude), data.altitudeKm);
      obj.mesh.position.copy(p);
      obj.mesh.userData.ref = obj;
      obj.mesh.visible = showAircraftEl.checked;
      nextAircraft.push(obj);
    }

    for (const removed of existing.values()) {
      if (selectedAircraft === removed) clearAircraftSelection();
      aircraftGroup.remove(removed.mesh);
      removed.mesh.geometry.dispose();
      removed.mesh.material.dispose();
    }

    aircraft = nextAircraft;
    aircraftCountEl.textContent = String(aircraft.length);
    airSourceInfoEl.textContent = `OpenSky via local proxy (/api/aircraft), updated ${new Date().toISOString()}`;
    if (selectedAircraft) {
      const refreshed = aircraft.find((a) => a.id === selectedAircraft.id);
      if (refreshed) {
        selectedAircraft = refreshed;
        selectedAircraft.mesh.scale.setScalar(2.0);
        selectedAircraft.mesh.material.emissiveIntensity = 0.9;
        aircraftInfoEl.textContent = formatAircraftInfo(selectedAircraft);
      } else {
        clearAircraftSelection();
      }
    }
  } catch (err) {
    airSourceInfoEl.textContent = `Aircraft update failed: ${err.message}`;
  } finally {
    aircraftFetchInFlight = false;
  }
}

window.addEventListener('pointermove', (ev) => {
  setPointer(ev);
  raycaster.setFromCamera(pointer, camera);
  const satMeshes = satellites.map((s) => s.mesh);
  const airMeshes = showAircraftEl.checked ? aircraft.map((a) => a.mesh) : [];
  const hits = raycaster.intersectObjects([...satMeshes, ...airMeshes], false);
  hovered = null;
  if (hits.length) {
    const top = hits[0].object;
    hovered = top.userData.kind === 'aircraft' ? top.userData.ref : satellites.find((s) => s.mesh === top) || null;
    tooltip.textContent = top.userData.kind === 'aircraft' ? (hovered?.data?.callsign || hovered?.id || 'Aircraft') : (hovered?.name || 'Satellite');
    tooltip.style.left = `${ev.clientX}px`;
    tooltip.style.top = `${ev.clientY}px`;
    tooltip.classList.add('show');
  } else {
    tooltip.classList.remove('show');
  }
});

window.addEventListener('click', (ev) => {
  setPointer(ev);
  raycaster.setFromCamera(pointer, camera);
  const satMeshes = satellites.map((s) => s.mesh);
  const airMeshes = showAircraftEl.checked ? aircraft.map((a) => a.mesh) : [];
  const hits = raycaster.intersectObjects([...satMeshes, ...airMeshes], false);
  if (!hits.length) return;
  const top = hits[0].object;
  if (top.userData.kind === 'aircraft' && top.userData.ref) {
    selectAircraft(top.userData.ref);
  } else {
    const sat = satellites.find((s) => s.mesh === top);
    if (sat) selectSatellite(sat);
  }
});

speedInput.addEventListener('input', () => {
  timeScale = Number(speedInput.value);
  speedLabel.textContent = `${timeScale}×`;
});

realtimeBtn.addEventListener('click', () => {
  simTime = new Date();
  timeScale = 1;
  speedInput.value = '1';
  speedLabel.textContent = '1×';
  paused = false;
});

pauseBtn.addEventListener('click', () => { paused = true; });
resumeBtn.addEventListener('click', () => { paused = false; });

showSelectedOrbitEl.addEventListener('change', () => rebuildSelectedOrbit());
showTrailsEl.addEventListener('change', () => {
  for (const s of satellites) s.trailLine.visible = showTrailsEl.checked;
});

showAircraftEl.addEventListener('change', () => {
  const on = showAircraftEl.checked;
  for (const a of aircraft) a.mesh.visible = on;
  if (!on) {
    clearAircraftSelection();
    airSourceInfoEl.textContent = 'Aircraft API idle (layer off).';
    aircraftCountEl.textContent = '0';
    for (const a of aircraft) {
      aircraftGroup.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mesh.material.dispose();
    }
    aircraft = [];
  } else {
    refreshAircraftLayer();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);

  const nowMs = performance.now();
  const dtSec = Math.max(0, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;

  if (!paused) simTime = new Date(simTime.getTime() + dtSec * 1000 * timeScale);

  const sampleTrailNow = (nowMs - lastTrailSample) >= TRAIL_SAMPLE_MS;
  if (sampleTrailNow) lastTrailSample = nowMs;

  if (showAircraftEl.checked && nowMs - lastAircraftFetchMs >= AIRCRAFT_REFRESH_MS) {
    lastAircraftFetchMs = nowMs;
    refreshAircraftLayer();
  }

  if (selectedSat && nowMs - lastOrbitRebuildMs >= 15000) {
    lastOrbitRebuildMs = nowMs;
    rebuildSelectedOrbit();
  }

  utcTimeEl.textContent = simTime.toISOString().replace('T', ' ').replace('Z', ' UTC');
  earthMat.uniforms.sunDir.value.copy(sunLight.position).normalize();

  cloud.rotation.y += dtSec * 0.01;
  updateSatellites(simTime, sampleTrailNow);

  if (selectedSat) satInfoEl.textContent = formatSatelliteInfo(selectedSat);

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

await loadTLEs();
if (showAircraftEl.checked) {
  lastAircraftFetchMs = performance.now();
  refreshAircraftLayer();
}
animate();
