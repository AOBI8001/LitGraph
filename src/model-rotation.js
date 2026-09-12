import { initialFramingPoints } from './perspective-framing.js';
import { panTimelineCamera, orbitTimelineCamera } from './timeline-navigation.js';

// Rotate the model, never the camera. Keep simulation coordinates in model space
// so picking, node dragging, edges and year planes share the same transform.
export function modelCenter(nodes, THREE) {
  // Match the visible main body used for initial framing. A remote outlier must
  // not turn an in-place rotation into an orbit around a distant, empty point.
  const core = initialFramingPoints(nodes);
  const points = core.length ? core : nodes;
  return new THREE.Vector3(...['x', 'y', 'z'].map(axis => {
    const values = points.map(n => Number(n[axis])).filter(Number.isFinite);
    return values.length ? (Math.min(...values) + Math.max(...values)) / 2 : 0;
  }));
}

export function mountModelRotation(graph, THREE, host, options) {
  const states = new Map();
  const raycaster = new THREE.Raycaster();
  let gesture = null;
  let lastPointer = null;
  // 3d-force-graph emits a synthetic touch pointerup with ID 0 after a node
  // drag. OrbitControls now tracks real IDs; forwarding 0 leaves its mouse
  // pointer registered and can enter an invalid one-touch state. Preserve the
  // original pointer identity for that cleanup event (not for real gestures).
  const repairPointerUp = event => {
    if (event.isTrusted || event.pointerType !== 'touch' || event.pointerId !== 0 || !lastPointer || lastPointer.id === 0) return;
    event.stopImmediatePropagation();
    host.ownerDocument.dispatchEvent(new PointerEvent('pointerup', { pointerId: lastPointer.id, pointerType: lastPointer.type }));
  };
  const scene = graph.scene(), previousBeforeRender = scene.onBeforeRender;
  function holdCamera() {
    if (!gesture) return;
    const camera = graph.camera();
    camera.position.copy(gesture.cameraPosition);
    camera.quaternion.copy(gesture.cameraRotation);
    graph.controls().target.copy(gesture.cameraTarget);
    camera.updateMatrixWorld(true);
  }
  // Rendering/tween callbacks may still update the camera after pointer events.
  // Enforce the captured pose immediately before rendering, not just on move.
  const beforeRender = function (...args) { previousBeforeRender?.apply(this,args); holdCamera(); };
  scene.onBeforeRender = beforeRender;
  const root = () => graph.scene().children.find(child => typeof child.graphData === 'function');
  const timeline = () => options.mode?.() === 'timeline';
  const state = () => {
    const slot = options.slot();
    if (!states.has(slot)) states.set(slot, { rotation: new THREE.Quaternion(), pivot: modelCenter(graph.graphData().nodes, THREE) });
    return states.get(slot);
  };
  function sync() {
    const s = state();
    if (timeline()) s.rotation.identity();
    for (const object of [root(), options.guides()].filter(Boolean)) {
      object.quaternion.copy(s.rotation);
      object.position.copy(s.pivot).sub(s.pivot.clone().applyQuaternion(s.rotation));
      object.updateMatrixWorld(true);
    }
  }
  function hitsNode(event) {
    const rect = host.getBoundingClientRect();
    raycaster.setFromCamera({x:(event.clientX-rect.left)/rect.width*2-1,y:1-(event.clientY-rect.top)/rect.height*2},graph.camera());
    const model = root();
    if (!model) return false;
    model.updateMatrixWorld(true);
    return raycaster.intersectObject(model, true).some(hit => {
      let object = hit.object;
      while (object && !object.__graphObjType) object = object.parent;
      return object?.__graphObjType === 'node';
    });
  }
  const down = event => {
    lastPointer = { id: event.pointerId, type: event.pointerType };
    if ((event.button !== 0 && event.button !== 2) || !options.enabled() || !root() || (event.button === 0 && hitsNode(event))) return;
    const s = state();
    if (s.rotation.angleTo(new THREE.Quaternion()) < 1e-8) s.pivot.copy(modelCenter(graph.graphData().nodes, THREE));
    event.preventDefault(); event.stopImmediatePropagation();
    host.focus({preventScroll:true});
    // Cancel any in-flight fit/zoom tween at its CURRENT pose before rotating.
    // Clone both values: cancelling a tween can synchronously change the camera.
    const controls = graph.controls();
    const camera = graph.camera(), position = camera.position.clone(), cameraRotation = camera.quaternion.clone();
    // During a tween the controls target can be ahead of the rendered heading.
    // Anchor it along the current heading so release cannot cause a final turn.
    const target = camera.getWorldDirection(new THREE.Vector3())
      .multiplyScalar(position.distanceTo(controls.target)).add(position);
    graph.cameraPosition(position, target, 0);
    const mode = event.button === 2 ? 'pan' : (timeline() ? 'orbit' : 'model');
    if (timeline() && !s.orbitLimits) s.orbitLimits = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    gesture = { mode, x:event.clientX, y:event.clientY, id:event.pointerId, controlsEnabled:graph.enableNavigationControls(), cameraPosition:position, cameraRotation, cameraTarget:target };
    graph.enableNavigationControls(false);
    holdCamera();
    host.setPointerCapture(event.pointerId); host.style.cursor = 'grabbing';
    options.onStart?.();
  };
  const move = event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    event.preventDefault(); event.stopImmediatePropagation();
    holdCamera();
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    gesture.x=event.clientX;gesture.y=event.clientY;
    const camera=graph.camera(), speed=Math.PI/Math.max(220,host.getBoundingClientRect().height);
    if (gesture.mode !== 'model') {
      const height = host.getBoundingClientRect().height;
      const next = gesture.mode === 'pan'
        ? panTimelineCamera(gesture.cameraPosition, gesture.cameraTarget, gesture.cameraRotation, camera.fov, height, dx, dy, THREE)
        : orbitTimelineCamera(gesture.cameraPosition, gesture.cameraTarget, state().orbitLimits, dx, dy, height, THREE);
      gesture.cameraPosition.copy(next.position);
      gesture.cameraTarget.copy(next.target);
      if (gesture.mode === 'orbit') {
        camera.position.copy(next.position);camera.up.set(0,1,0);camera.lookAt(next.target);
        gesture.cameraRotation.copy(camera.quaternion);
      }
      holdCamera();
      return;
    }
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const rotation=new THREE.Quaternion().setFromAxisAngle(up,dx*speed)
      .multiply(new THREE.Quaternion().setFromAxisAngle(right,dy*speed));
    state().rotation.premultiply(rotation).normalize(); sync();
  };
  const finish = event => {
    if (!gesture) return;
    event.stopImmediatePropagation();
    holdCamera();
    const completed = gesture;
    gesture=null;
    graph.enableNavigationControls(completed.controlsEnabled);
    if(host.hasPointerCapture(completed.id))host.releasePointerCapture(completed.id);
    host.style.cursor='grab';
    options.onEnd?.();
  };
  const contextMenu = event => {if(options.enabled())event.preventDefault();};
  graph.controls().enableRotate=false;
  graph.controls().enablePan=false;
  host.addEventListener('pointerdown',down,true);
  host.addEventListener('pointermove',move,true);
  host.addEventListener('pointerup',finish,true);
  host.addEventListener('pointercancel',finish,true);
  host.addEventListener('lostpointercapture',finish,true);
  host.addEventListener('contextmenu',contextMenu,true);
  host.ownerDocument.addEventListener('pointerup',repairPointerUp,true);
  return { sync, reset() {states.delete(options.slot());sync();}, get pivot(){return state().pivot;}, get rotation(){return state().rotation;}, dispose(){
    if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previousBeforeRender;
    if (gesture) {graph.enableNavigationControls(gesture.controlsEnabled);gesture=null;}
    host.removeEventListener('pointerdown',down,true);host.removeEventListener('pointermove',move,true);
    host.removeEventListener('pointerup',finish,true);host.removeEventListener('pointercancel',finish,true);host.removeEventListener('lostpointercapture',finish,true);
    host.removeEventListener('contextmenu',contextMenu,true);
    host.ownerDocument.removeEventListener('pointerup',repairPointerUp,true);
  }};
}
