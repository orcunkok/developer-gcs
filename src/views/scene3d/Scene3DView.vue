<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createVehicles } from "./vehicles.js";

// Scene colors live here, like map colors live in src/views/map/.
const COLORS = {
    skyTop: "#7fa6d1",
    skyHorizon: "#d2e2f1",
    floorA: "#c3cad2",
    floorB: "#d3d8de",
    hemiSky: "#dfe8f2",
    hemiGround: "#8a8f96",
    sun: "#fff4e6",
    north: "#4a5562",
};

// World frame is NED: +X north, +Y east, +Z down (floor at z = 0, altitude = -z).
const UP = new THREE.Vector3(0, 0, -1);

const FLOOR_SIZE = 2000; // m
const CELL_SIZE = 1; // m per checker square
const FLOOR_DROP = 0.01; // m below z = 0

// orbit pivot height; the camera can orbit down to the horizon, so this is also its lowest eye height
const CAMERA_TARGET_HEIGHT = 0.1; // m
const NORTH_MARKER_SIZE = 1.6; // m
const NORTH_MARKER_DISTANCE = 4; // m north of the origin
const NORTH_MARKER_SCALE_DISTANCE = 8; // m, true size inside this camera distance, growing linearly beyond it
const NORTH_MARKER_MAX_SCALE = 6; // x, growth cap

const container = ref(null);
let renderer, scene, camera, controls, resizeObserver, northMarker, vehicles;
let frame = 0;

// renders only when something changes; no continuous loop
function requestRender() {
    frame ||= requestAnimationFrame(() => {
        const animating = vehicles.update(); // frame is still set here, so a controls "change" it causes does not queue another frame
        frame = 0;
        // north marker keeps a roughly constant size on screen when zoomed out; its position stays fixed
        const distance = camera.position.distanceTo(northMarker.position);
        northMarker.scale.setScalar(THREE.MathUtils.clamp(distance / NORTH_MARKER_SCALE_DISTANCE, 1, NORTH_MARKER_MAX_SCALE));
        renderer.render(scene, camera);
        if (animating) requestRender();
    });
}

function createSky() {
    const geometry = new THREE.SphereGeometry(FLOOR_SIZE * 0.75, 32, 16);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false, // exact sky colours; fog is applied after tone mapping, so this also matches the floor's fogged horizon
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
    texture.minFilter = THREE.LinearMipmapLinearFilter; // trilinear mipmaps fade distant checkers to their average
    texture.anisotropy = maxAnisotropy; // no shimmer at grazing angles

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 }),
    );
    floor.rotation.x = Math.PI; // plane lies in XY; flip so its face points up (-z)
    floor.position.z = FLOOR_DROP; // NED: slightly below z = 0 so nothing at ground level z-fights with it
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
            // pulled towards the camera in depth so it wins over the floor at any distance (no z-fighting far out)
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -4,
            roughness: 0.9,
            metalness: 0,
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
    sun.position.set(12, 18, -36); // NED: 36 m up, high enough to cover high flights
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top = 25; // 50 m square, about 2.4 cm per shadow texel
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    return [hemi, sun];
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
    scene.fog = new THREE.Fog(COLORS.skyHorizon, 200, FLOOR_SIZE / 2);

    // soft image-based light so materials read as real surfaces, not flat-shaded
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    northMarker = createNorthMarker(maxAnisotropy);
    scene.add(createSky(), createFloor(maxAnisotropy), northMarker, ...createLights());

    camera = new THREE.PerspectiveCamera(50, 1, 0.02, FLOOR_SIZE);
    camera.up.copy(UP);
    camera.position.set(-5, -4, -3); // south-west of the origin, 3 m up

    // right-drag orbit (like the map), left-drag pan, wheel zoom; no damping so nothing moves after release
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.cursorStyle = "grab"; // grab at rest, grabbing while dragging any button
    controls.target.set(0, 0, -CAMERA_TARGET_HEIGHT);
    controls.maxPolarAngle = Math.PI / 2; // down to the horizon, eye at target height; vehicles.js lifts it while following
    controls.minDistance = 0.1;
    controls.maxDistance = 300;
    controls.screenSpacePanning = false; // pan along the floor
    controls.update();
    controls.addEventListener("change", requestRender);
    vehicles = createVehicles(renderer, scene, camera, controls, requestRender);

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
    vehicles?.dispose();
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
    renderer = scene = camera = controls = resizeObserver = northMarker = vehicles = null;
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
