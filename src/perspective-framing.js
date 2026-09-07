// A tiny number of isolated outliers must not shrink the entire initial view.
// Defines the main body for initial framing and in-place model rotation.
// Never changes node positions, graph visibility, or removes data.
export function initialFramingPoints(points) {
  const valid=points.filter(p=>['x','y','z'].every(a=>Number.isFinite(p[a])));
  if(valid.length<20)return valid;
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);const m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;};
  const center=['x','y','z'].map(a=>median(valid.map(p=>p[a])));
  const ranked=valid.map(p=>({p,d:Math.hypot(p.x-center[0],p.y-center[1],p.z-center[2])})).sort((a,b)=>a.d-b.d);
  const mid=median(ranked.map(p=>p.d));
  const mad=median(ranked.map(p=>Math.abs(p.d-mid)));
  const limit=Math.max(mid*3,mid+6*mad,40);
  const removable=Math.floor(valid.length*.05);
  return ranked.filter((p,i)=>i<ranked.length-removable||p.d<=limit).map(entry=>entry.p);
}

// Fit node centers in camera-local space; depth matters as much as XY extent.
export function framePerspectiveModel(points, camera, THREE, occupancy = .8) {
  const valid=points.filter(p=>['x','y','z'].every(a=>Number.isFinite(p[a])));
  if(!valid.length)return null;
  const target=new THREE.Vector3(...['x','y','z'].map(a=>(Math.min(...valid.map(p=>p[a]))+Math.max(...valid.map(p=>p[a])))/2));
  const inverse=camera.quaternion.clone().invert();
  const tanY=Math.tan(camera.fov*Math.PI/360)*occupancy;
  const tanX=tanY*Math.max(.1,camera.aspect);
  const local=valid.map(p=>({point:new THREE.Vector3(p.x,p.y,p.z).sub(target).applyQuaternion(inverse),radius:Math.max(12,Number(p.radius)||0)}));
  let low=Math.max(...local.map(p=>p.point.z+p.radius))+.1;
  let high=Math.max(low+1,...local.flatMap(({point:p,radius:r})=>[p.z+r+(Math.abs(p.x)+r)/tanX,p.z+r+(Math.abs(p.y)+r)/tanY]));
  // Find the tightest perspective frustum that contains the projected model.
  // Lateral offset avoids shrinking an asymmetric, deep cloud into one corner.
  const envelope=distance=>{
    let xmin=-Infinity,xmax=Infinity,ymin=-Infinity,ymax=Infinity;
    for(const {point:p,radius:r} of local){
      const depth=distance-p.z-r;
      xmin=Math.max(xmin,p.x+r-tanX*depth);xmax=Math.min(xmax,p.x-r+tanX*depth);
      ymin=Math.max(ymin,p.y+r-tanY*depth);ymax=Math.min(ymax,p.y-r+tanY*depth);
    }
    return {xmin,xmax,ymin,ymax,valid:xmin<=xmax&&ymin<=ymax};
  };
  for(let i=0;i<36;i++){const mid=(low+high)/2;if(envelope(mid).valid)high=mid;else low=mid;}
  const distance=high*1.005;
  const range=envelope(distance);
  const offset=new THREE.Vector3((range.xmin+range.xmax)/2,(range.ymin+range.ymax)/2,0).applyQuaternion(camera.quaternion);
  target.add(offset);
  const position=new THREE.Vector3(0,0,distance).applyQuaternion(camera.quaternion).add(target);
  return {position,target};
}
