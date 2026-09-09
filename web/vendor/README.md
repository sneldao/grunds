# web/vendor

Vendored copies of Three.js r160 (`three.module.js`) and the optional loaders
used by the 3D asset pipeline (`GLTFLoader.js`, `BufferGeometryUtils.js`).

**As of 2026-09-09, `web/js/world.js` is the only consumer of the GLTFLoader
(via `web/js/loader.js`).** The remaining world meshes (facades, street trees,
benches, rival café, menu board, sign) stay procedural; the Kenney kit only
covers the café interior. The vendored loaders' internal `from 'three'` and
`from '../utils/...'` imports have been retargeted to the local `three.module.js`
so Node-based headless tests can import them without npm.

The loaders are MIT-licensed (Three.js examples) and are committed unmodified
so the demo continues to need zero network and zero CDN at boot.
