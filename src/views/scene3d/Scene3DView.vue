<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Scene colors live here, like map colors live in src/views/map/.
const COLORS = {
    skyTop: "#9fb4c9",
    skyHorizon: "#e4e9ee",
    floorA: "#c3cad2",
    floorB: "#d3d8de",
    hemiSky: "#dfe8f2",
    hemiGround: "#8a8f96",
    sun: "#fff4e6",
    block: "#e07a3f",
};

// World frame is NED: +X north, +Y east, +Z down (floor at z = 0, altitude = -z).
const UP = new THREE.Vector3(0, 0, -1);

const FLOOR_SIZE = 200; // m
const CELL_SIZE = 1; // m per checker square

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

// stand-in for the drone GLB, for debugging only
function createBlock() {
    const block = new THREE.Mesh(
        new RoundedBoxGeometry(0.6, 0.6, 0.15, 4, 0.03),
        new THREE.MeshStandardMaterial({ color: COLORS.block, roughness: 0.45, metalness: 0.1 }),
    );
    block.position.set(0, 0, -1.5); // NED: 1.5 m altitude
    block.castShadow = true;
    return block;
}

onMounted(() => {
    const el = container.value;

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // same cap as the map
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x; radius softens instead
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.skyHorizon, 30, FLOOR_SIZE / 2);

    // soft image-based light so materials read as real surfaces, not flat-shaded
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    scene.add(createSky(), createFloor(renderer.capabilities.getMaxAnisotropy()), ...createLights());
    const block = createBlock();
    scene.add(block);

    camera = new THREE.PerspectiveCamera(50, 1, 0.05, FLOOR_SIZE * 2);
    camera.up.copy(UP);
    camera.position.set(-5, -4, -3); // south-west of the block, 3 m up

    // right-drag orbit (like the map), left-drag pan, wheel zoom; no damping so nothing moves after release
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.cursorStyle = "grab"; // grab at rest, grabbing while dragging any button
    controls.target.copy(block.position);
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
        obj.material?.map?.dispose();
        obj.material?.dispose();
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
