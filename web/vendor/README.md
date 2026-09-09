# web/vendor

Vendored copies of Three.js r160 (`three.module.js`) and the optional loaders
used by the deferred 3D asset pipeline (`GLTFLoader.js`, `BufferGeometryUtils.js`).

**Nothing in `web/index.html` or `web/js/*.js` currently imports `GLTFLoader` or
`BufferGeometryUtils`.** The merged demo (`feat/connected-district`, PR #1) is
fully procedural: the dollhouse café is built from `BoxGeometry`,
`SphereGeometry`, `CylinderGeometry`, `PlaneGeometry`, `ConeGeometry`,
`TorusGeometry`, and `CanvasTexture` calls inside `web/js/world.js`. No
external 3D assets are required to run `python3 -m grunds spatial`.

The loaders are vendored here for the **next phase** (Convex multiplayer + asset
pipeline) so the working tree is ready when something needs to load a `.glb`.
They are MIT-licensed (Three.js examples) and are committed unmodified so the
demo continues to need zero network and zero CDN at boot.

If a future change actually uses one of these loaders, update this README's
"currently imported by" line so the next maintainer doesn't have to grep.
