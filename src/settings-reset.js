// Explicit preference keys only. Never delete unknown/new keys: they may hold
// research data. Project graphs, full text, summaries, chats and history survive.
export const preferenceKeys = Object.freeze([
  'litgraph.aiConfig', 'litgraph.institutionLibraryUrl', 'litgraph.language',
  'litgraph.canvasBackground', 'litgraph.sidebarWidth', 'litgraph.inspectorWidth',
  'litgraph.uiDensityVersion', 'litgraph.dataColumnWidths',
  'litgraph.researchMode', 'litgraph.citationStyle'
]);
export function withoutPreferences(state) {
  return Object.fromEntries(Object.entries(state).filter(([key]) => !preferenceKeys.includes(key)));
}
