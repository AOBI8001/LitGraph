export function researchChatKey(projectId,tab){
 if(!projectId)throw Error('A research conversation requires a project');
 return `litgraph.chat.v2.${projectId}.${tab.type}.${[...(tab.nodeIds||[])].sort().join('.')}`;
}
export function withoutResearchData(state){
 return Object.fromEntries(Object.entries(state).filter(([key])=>!/^litgraph\.(?:chat\.|summary\.|projects\.|activeProjectId$|discoveryHistory\.|researchTabs\.)/.test(key)));
}
