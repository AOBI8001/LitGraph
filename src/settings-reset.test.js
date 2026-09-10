import assert from 'node:assert/strict';
import {preferenceKeys,withoutPreferences} from './settings-reset.js';
const data={
  'litgraph.projects.v1':'graph JSON', 'litgraph.activeProjectId':'project-a',
  'litgraph.discoveryHistory.v1':'import history', 'litgraph.chat.v2.project-a.paper.a':'chat',
  'litgraph.summary.a':'edited analysis', 'litgraph.future.data':'unknown retained data'
};
assert.deepEqual(withoutPreferences({...data,...Object.fromEntries(preferenceKeys.map(key=>[key,'setting']))}),data);
assert.deepEqual(withoutPreferences(withoutPreferences(data)),data);
console.log('Settings reset preserves all research keys, active project, history and unknown data.');
