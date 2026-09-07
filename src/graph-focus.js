// Hover is deliberately not an input: only a clicked paper focuses its edges.
export function linkMatchesSelection(link, selectedNode) {
  const id = endpoint => typeof endpoint === 'object' ? endpoint?.id : endpoint;
  return !selectedNode || id(link.source) === selectedNode.id || id(link.target) === selectedNode.id;
}
