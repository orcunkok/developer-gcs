import { watch } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fpvUrl from "/assets/fpv.glb?url";
import { messages, onMessage } from "../../link.js";
import { useLayoutStore } from "../../stores/layout.js";

// model URL by MAV_TYPE (HEARTBEAT.type)
const MODEL_BY_TYPE = { 2: fpvUrl };
const MODEL_SIZE = 0.6; // m, longest side after scaling
const SCALE_DISTANCE = 8; // m, true size inside this camera distance, growing linearly beyond it
const MAX_SCALE = 6; // x, growth cap
// glTF models face +Z with +Y up (+X left); map that to NED: forward -> north, up -> up, left -> west
const GLTF_TO_NED = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)),
);
const FOLLOW_GLIDE_MS = 400; // ease time to the followed centroid
const FOLLOW_DISTANCE = 6; // m, closest comfortable view of one vehicle
const FOLLOW_SPREAD_FIT = 3; // x group radius kept between camera and centre

const loader = new GLTFLoader();
const models = new Map(); // url -> promise of the gltf; each file loads once per page, clones share its geometry
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const centroid = new THREE.Vector3();
const glideFrom = new THREE.Vector3();
const delta = new THREE.Vector3();
const offset = new THREE.Vector3();

/**
 * Vehicles in the 3D scene: models posed from telemetry, zoom scaling, and the camera follow (layout store `follow`).
 * Unchanged poses (landed, idle) are skipped, so nothing renders while vehicles are still.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} controls
 * @param {() => void} requestRender schedules a frame
 */
export function createVehicles(renderer, scene, camera, controls, requestRender) {
    const layout = useLayoutStore();
    const groups = new Map(); // key -> THREE.Group holding position and attitude
    let following = false; // a glide to the current follow target has started
    let gliding = false;
    let glideStart = 0;
    let glideDistanceFrom = 0; // m
    let glideDistanceTo = 0; // m

    // vehicles moved: shadows are stale
    function changed() {
        renderer.shadowMap.needsUpdate = true;
        requestRender();
    }

    // creates the group once the type is known; the model sits on the group origin, lowest point at z = 0
    function add(key) {
        const url = MODEL_BY_TYPE[messages[key]?.HEARTBEAT?.type];
        if (!url) return;
        const group = new THREE.Group();
        groups.set(key, group);
        scene.add(group);
        if (!models.has(url)) models.set(url, loader.loadAsync(url));
        models.get(url).then(({ scene: loaded }) => {
            if (groups.get(key) !== group) return; // removed or unmounted while loading
            const model = loaded.clone();
            model.quaternion.copy(GLTF_TO_NED);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            model.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z));
            box.setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.set(-center.x, -center.y, -box.max.z); // NED: max z is the lowest point
            model.traverse((obj) => (obj.castShadow = obj.isMesh));
            group.add(model);
            changed();
        });
        return group;
    }

    function onVehicleMessage(key, name, fields) {
        const group = groups.get(key) ?? (name && add(key));
        if (!group) return;
        if (name === null) {
            scene.remove(group);
            groups.delete(key);
        } else if (name === "LOCAL_POSITION_NED") {
            if (group.position.equals(fields)) return;
            group.position.set(fields.x, fields.y, fields.z);
        } else if (name === "ATTITUDE") {
            quaternion.setFromEuler(euler.set(fields.roll, fields.pitch, fields.yaw, "ZYX"));
            if (quaternion.equals(group.quaternion)) return;
            group.quaternion.copy(quaternion);
        } else return;
        changed();
    }

    // sets the centroid of the followed vehicles that exist and returns how many there are
    function followCentroid() {
        let count = 0;
        centroid.set(0, 0, 0);
        for (const key of layout.follow) {
            const group = groups.get(key);
            if (!group) continue;
            centroid.add(group.position);
            count++;
        }
        if (count) centroid.divideScalar(count);
        return count;
    }

    // glides onto the followed centroid, then keeps it fixed on screen by moving target and camera together
    function follow() {
        const count = followCentroid();
        controls.enablePan = !count;
        if (!count) {
            following = gliding = false;
            return;
        }
        if (!following) {
            following = gliding = true;
            glideStart = performance.now();
            glideFrom.copy(controls.target);
            let radius = 0;
            for (const key of layout.follow) {
                const group = groups.get(key);
                if (group) radius = Math.max(radius, group.position.distanceTo(centroid));
            }
            const fit = Math.max(FOLLOW_DISTANCE, radius * FOLLOW_SPREAD_FIT);
            glideDistanceFrom = controls.getDistance();
            glideDistanceTo = count === 1 ? Math.min(glideDistanceFrom, fit) : fit;
        }
        if (gliding) {
            const t = Math.min((performance.now() - glideStart) / FOLLOW_GLIDE_MS, 1);
            const eased = t * t * (3 - 2 * t);
            gliding = t < 1;
            offset.copy(camera.position).sub(controls.target); // keeps the user's orbit angles
            offset.setLength(THREE.MathUtils.lerp(glideDistanceFrom, glideDistanceTo, eased));
            controls.target.lerpVectors(glideFrom, centroid, eased);
            camera.position.copy(controls.target).add(offset);
        } else {
            delta.copy(centroid).sub(controls.target);
            controls.target.add(delta);
            camera.position.add(delta);
        }
        controls.update();
    }

    // keeps vehicles a roughly constant size on screen when zoomed out
    function scale() {
        for (const group of groups.values()) {
            const s = THREE.MathUtils.clamp(group.position.distanceTo(camera.position) / SCALE_DISTANCE, 1, MAX_SCALE);
            if (group.scale.x === s) continue;
            group.scale.setScalar(s);
            renderer.shadowMap.needsUpdate = true;
        }
    }

    for (const key of Object.keys(messages)) add(key);
    const unsubscribe = onMessage(onVehicleMessage);
    // the store replaces the array on every change, so a shallow watch is enough
    const stopWatch = watch(
        () => layout.follow,
        () => {
            following = false; // the next frame glides to the new target
            requestRender();
        },
        { immediate: true },
    );

    return {
        /** per frame, before rendering: camera follow, then zoom scaling; returns true while it needs another frame */
        update() {
            follow();
            scale();
            return gliding;
        },
        dispose() {
            unsubscribe();
            stopWatch();
            groups.clear(); // also makes in-flight model loads skip their vehicle
        },
    };
}
