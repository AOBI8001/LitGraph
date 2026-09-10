import {scholarlyService} from './scholarly-service.js';
import {acquisitionCore} from './acquisition-core.js';
import {routeInstitution} from './institution-routing.js';
export {publicAddress, validInstitution} from './institution-routing.js';
export const SCANSCI_REVISION='c7022a8000d266442c260623cf8b12b63b10c1e3';

// Only the necessary public core is retained. Metadata and PDF transport are
// native Node, and institutional browsing stays in the authenticated Electron
// session. No Python installation, subprocess, extra browser or cookie export.
export function scansciService(_root, {scholarly=scholarlyService(), download, ...limits}={}) {
  const acquire=acquisitionCore({scholarly, download, ...limits});
  return {
    available:()=>true,
    status:async()=>({available:true,engine:'LitGraph retrieval core',revision:SCANSCI_REVISION,
      capabilities:['verified-metadata','open-access-pdf','webvpn-routing','ezproxy-routing'],
      institution:'Requires the desktop application’s authenticated institution session.'}),
    route:async(input,signal)=>{signal?.throwIfAborted();return routeInstitution(input);},
    search:(input,signal)=>scholarly.search(input,signal),
    acquire
  };
}
