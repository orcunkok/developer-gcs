<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Scene colors live here, like map colors live in src/views/map/.
const COLORS = {
    skyTop: "#9fb4c9",
    skyHorizon: "#e4e9ee",
    floorA: "#c3cad2",
    floorB: "#d3d8de",
    hemiSky: "#dfe8f2",
    hemiGround: "#8a8f96",
    sun: "#fff4e6",
    north: "#4a5562",
};

// World frame is NED: +X north, +Y east, +Z down (floor at z = 0, altitude = -z).
const UP = new THREE.Vector3(0, 0, -1);

const FLOOR_SIZE = 200; // m
const CELL_SIZE = 1; // m per checker square

// URLs of every .glb under /assets
const MODEL_URLS = Object.values(import.meta.glob("/assets/*.glb", { query: "?url", import: "default", eager: true }));
const MODEL_SIZE = 0.6; // m, longest side after scaling
const MODEL_SPACING = 1; // m between model centers, along east
const MODEL_ALTITUDE = 1.5; // m
// glTF models face +Z with +Y up (+X left); map that to NED: forward -> north, up -> up, left -> west
const GLTF_TO_NED = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)),
);
const NORTH_MARKER_SIZE = 1.6; // m
const NORTH_MARKER_DISTANCE = 4; // m north of the origin

const container = ref(null);
let renderer, scene, camera, controls, resizeObserver;
let frame = 0;

// renders only when something changes; no continuous loop
function requestRender() {
    frame ||= requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
    });
}

function createSky() {
    const geometry = new THREE.SphereGeometry(FLOOR_SIZE, 32, 16);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            top: { value: new THREE.Color(COLORS.skyTop) },
            horizon: { value: new THREE.Color(COLORS.skyHorizon) },
        },
        vertexShader: `
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform vec3 top;
            uniform vec3 horizon;
            varying vec3 vDir;
            void main() {
                float t = pow(max(-vDir.z, 0.0), 0.6); // NED: up is -z
                gl_FragColor = vec4(mix(horizon, top, t), 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const sky = new THREE.Mesh(geometry, material);
    sky.renderOrder = -1;
    return sky;
}

function createFloor(maxAnisotropy) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.floorA;
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = COLORS.floorB;
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(0, 1, 1, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.setScalar(FLOOR_SIZE / (2 * CELL_SIZE));
    texture.magFilter = THREE.NearestFilter; // crisp square edges up close
    texture.anisotropy = maxAnisotropy; // no shimmer at grazing angles

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 }),
    );
    floor.rotation.x = Math.PI; // plane lies in XY; flip so its face points up (-z)
    floor.receiveShadow = true;
    return floor;
}

// chevron + "N" painted flat on the floor, pointing north (+X)
function createNorthMarker(maxAnisotropy) {
    const px = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.north;
    ctx.beginPath(); // chevron, tip at the top (north)
    ctx.moveTo(px * 0.5, px * 0.04);
    ctx.lineTo(px * 0.8, px * 0.36);
    ctx.lineTo(px * 0.5, px * 0.26);
    ctx.lineTo(px * 0.2, px * 0.36);
    ctx.closePath();
    ctx.fill();
    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-sans");
    ctx.font = `600 ${px * 0.48}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", px * 0.5, px * 0.7);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;

    const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(NORTH_MARKER_SIZE, NORTH_MARKER_SIZE),
        new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            roughness: 0.9,
            metalness: 0,
            polygonOffset: true, // sits on the floor without z-fighting
            polygonOffsetFactor: -1,
        }),
    );
    // texture right -> east (+Y), texture up -> north (+X), face up (-Z)
    marker.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)),
    );
    marker.position.set(NORTH_MARKER_DISTANCE, 0, 0);
    marker.receiveShadow = true;
    return marker;
}

function createLights() {
    const hemi = new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.2);
    hemi.position.copy(UP); // hemisphere light's sky direction is its position

    const sun = new THREE.DirectionalLight(COLORS.sun, 2.2);
    sun.position.set(4, 6, -12); // NED: 12 m up
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
    sun.shadow.camera.right = sun.shadow.camera.top = 10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    return [hemi, sun];
}

// loads each model, scales it to MODEL_SIZE and lines them up side by side along east, centered on the origin
function loadModels() {
    const loader = new GLTFLoader();
    MODEL_URLS.forEach((url, i) => {
        loader.load(url, ({ scene: model }) => {
            if (!scene) return; // unmounted while loading
            model.quaternion.copy(GLTF_TO_NED);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            model.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z));
            box.setFromObject(model);
            const east = (i - (MODEL_URLS.length - 1) / 2) * MODEL_SPACING;
            model.position.sub(box.getCenter(new THREE.Vector3())).add(new THREE.Vector3(0, east, -MODEL_ALTITUDE));
            model.traverse((obj) => (obj.castShadow = obj.isMesh));
            scene.add(model);
            renderer.shadowMap.needsUpdate = true;
            requestRender();
        });
    });
}

onMounted(() => {
    const el = container.value;

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // same cap as the map
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x; radius softens instead
    // shadows depend on the light and objects, not the camera: draw them once, set needsUpdate when objects move
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.skyHorizon, 30, FLOOR_SIZE / 2);

    // soft image-based light so materials read as real surfaces, not flat-shaded
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    scene.add(createSky(), createFloor(maxAnisotropy), createNorthMarker(maxAnisotropy), ...createLights());
    loadModels();

    camera = new THREE.PerspectiveCamera(50, 1, 0.05, FLOOR_SIZE * 2);
    camera.up.copy(UP);
    camera.position.set(-5, -4, -3); // south-west of the models, 3 m up

    // right-drag orbit (like the map), left-drag pan, wheel zoom; no damping so nothing moves after release
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.cursorStyle = "grab"; // grab at rest, grabbing while dragging any button
    controls.target.set(0, 0, -MODEL_ALTITUDE);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // stay above the floor
    controls.minDistance = 0.5;
    controls.maxDistance = 80;
    controls.screenSpacePanning = false; // pan along the floor
    controls.update();
    controls.addEventListener("change", requestRender);

    resizeObserver = new ResizeObserver(() => {
        const { clientWidth: w, clientHeight: h } = el;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        requestRender();
    });
    resizeObserver.observe(el);
});

onUnmounted(() => {
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    controls?.dispose();
    scene?.traverse((obj) => {
        obj.geometry?.dispose();
        for (const material of [obj.material ?? []].flat()) {
            for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
            material.dispose();
        }
    });
    scene?.environment?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    renderer = scene = camera = controls = resizeObserver = null;
});
</script>

<template>
    <div ref="container" class="scene3d-container" @contextmenu.prevent></div>
</template>

<style scoped>
.scene3d-container {
    width: 100%;
    height: 100%;
}

.scene3d-container :deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
