// Retarget three Rokoko everyday idles onto the shared Polyfork 22-bone rig.
//
// Source: Rokoko "10 free everyday idle animations" (FBX, Mixamo skeleton,
// commercial use — https://www.rokoko.com/resources/rokoko-mocap-10-free-everyday-idle-animations).
// The zip is not committed. Pass its extracted directory:
//
//   mkdir -p /tmp/rokoko-tool && cd /tmp/rokoko-tool && npm install three@0.160.1
//   cp tools/retarget-rokoko-idles.mjs /tmp/rokoko-tool/bake.mjs
//   node /tmp/rokoko-tool/bake.mjs /path/to/EVERYDAY-IDLES-MOCAP web/assets/polyfork/idles.json
//
// Copy, don't symlink: Node resolves `three` from the real script path,
// and a symlink still lives in this repo, which does not depend on three.
//
// Mixamo bones point along +Y and rest with a non-identity local rotation.
// Polyfork bones rest at identity and point along their child offset, so
// copying quaternions flips the limbs. Each frame takes the Mixamo world
// rotation, multiplies by the bind-pose offset into the Polyfork world,
// then converts back to local. Hips stay at the authored rest translation
// (the takes wander; the street already pins root drift). A 5 s window
// whose ends already agree is closed by repeating the first pose, so the
// loop does not pop. Fingers and face are dropped — the rig has neither.

import { writeFileSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';

const MAP = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

// Planted takes, and the 5 s window whose ends already agree (measured
// against spine/head/arms). Leaning, pointing, and the long hip-drifts stay out.
const TAKES = [
  { name: 'IdleChat', file: 'Idle_Conversation_Loop_MIXAMO_769_segment-2.fbx', start: 19 },
  { name: 'IdleWatch', file: 'Idle_WatchingSomething_Loop_MIXAMO_769_segment.fbx', start: 10 },
  { name: 'IdleLook', file: 'Idle_LookingAround_MIXAMO_769.fbx', start: 23 },
];

const FPS = 12;
const WINDOW = 5;
const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)));
const guessed = join(HERE, '..');
const REPO = existsSync(join(guessed, 'web/assets/polyfork/passenger-ac425a.glb'))
  ? guessed
  : (process.env.GRUNDS_ROOT || '/Users/udingethe/Dev/grunds');
const TARGET_GLB = join(REPO, 'web/assets/polyfork/passenger-ac425a.glb');

function ab(p) {
  const b = readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

const dir = process.argv[2];
const outPath = process.argv[3];
if (!dir || !outPath) {
  console.error('usage: retarget-rokoko-idles.mjs <EVERYDAY-IDLES-MOCAP dir> <out.json>');
  process.exit(2);
}

const gltf = await new GLTFLoader().parseAsync(ab(TARGET_GLB), '');
const target = gltf.scene;
const tBones = {};
for (const n of MAP) {
  tBones[n] = target.getObjectByName(n);
  if (!tBones[n]) throw new Error('target missing ' + n);
}
target.updateMatrixWorld(true);

const clips = [];
for (const take of TAKES) {
  const fbx = new FBXLoader().parse(ab(`${dir}/${take.file}`));
  const sBones = {};
  for (const n of MAP) {
    sBones[n] = fbx.getObjectByName('mixamorig' + n);
    if (!sBones[n]) throw new Error(take.file + ' missing mixamorig' + n);
  }
  fbx.updateMatrixWorld(true);
  const offset = {};
  for (const n of MAP) {
    const sw = sBones[n].getWorldQuaternion(new Quaternion());
    const tw = tBones[n].getWorldQuaternion(new Quaternion());
    offset[n] = sw.clone().invert().multiply(tw);
  }
  const src = fbx.animations[0];
  const mixer = new AnimationMixer(fbx);
  mixer.clipAction(src).play();

  const frames = FPS * WINDOW;
  const times = [];
  const values = Object.fromEntries(MAP.map(n => [n, []]));
  const prev = {};
  for (let i = 0; i <= frames; i++) {
    const t = i === frames ? WINDOW : i / FPS;
    const sampleAt = i === frames ? take.start : take.start + i / FPS;
    mixer.setTime(sampleAt);
    fbx.updateMatrixWorld(true);
    const world = {};
    for (const n of MAP) world[n] = sBones[n].getWorldQuaternion(new Quaternion()).multiply(offset[n]);
    times.push(round4(t));
    for (const n of MAP) {
      const parent = tBones[n].parent;
      let local = world[n].clone();
      if (parent && world[parent.name]) local = world[parent.name].clone().invert().multiply(world[n]);
      if (prev[n] && prev[n].dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      prev[n] = local.clone();
      if (i === frames) {
        // Close the loop on the first pose so the seam is exact.
        const first = values[n].slice(0, 4);
        values[n].push(...first);
      } else {
        values[n].push(round4(local.x), round4(local.y), round4(local.z), round4(local.w));
      }
    }
  }
  const tracks = MAP.map(n => new QuaternionKeyframeTrack(n + '.quaternion', times, values[n]));
  const clip = new AnimationClip(take.name, WINDOW, tracks);
  clips.push(clip);

  // The pose has to stay a person: hands within reach of the hips, feet
  // under the body. Checked at the middle of the window.
  const check = new AnimationMixer(target);
  const action = check.clipAction(clip);
  action.play();
  check.setTime(WINDOW / 2);
  target.updateMatrixWorld(true);
  const hips = new Vector3();
  tBones.Hips.getWorldPosition(hips);
  for (const n of ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'Head']) {
    const p = new Vector3();
    tBones[n].getWorldPosition(p);
    const d = p.distanceTo(hips);
    const limit = n.endsWith('Foot') ? 1.15 : n === 'Head' ? 0.7 : 0.95;
    if (d > limit) throw new Error(`${take.name} ${n} is ${d.toFixed(2)} m from the hips`);
  }
  check.stopAllAction();
  target.traverse(o => { if (o.isBone) o.quaternion.identity(); });
  console.log(take.name, 'frames', frames + 1, 'from', take.file, '@', take.start + 's');
}

const json = {
  source: 'Rokoko everyday idles, retargeted onto the Polyfork rig',
  clips: clips.map(c => {
    const j = AnimationClip.toJSON(c);
    delete j.uuid;
    delete j.blendMode;
    return j;
  }),
};
writeFileSync(outPath, JSON.stringify(json));
console.log('wrote', outPath, (JSON.stringify(json).length / 1024).toFixed(0) + ' KB');
