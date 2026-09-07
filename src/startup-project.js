export function emptyProject(id = 'project-' + crypto.randomUUID(), language = 'zh') {
  return {
    meta: {id, schemaVersion: '0.2', title: language === 'en' ? 'Untitled literature project' : '未命名文献项目', mock: false},
    theories: [{id: 'unclassified', label: '待分类', labelEn: 'Unclassified', color: '#5d7185'}],
    nodes: [], semanticLinks: [], citationLinks: []
  };
}

export function initialWorkspace(library, activeId, sample, language = 'zh') {
  const projects = library && typeof library === 'object' && !Array.isArray(library) ? {...library} : {};
  if (!projects['sample-project']?.data) projects['sample-project'] = {id: 'sample-project', title: sample.meta.title, data: structuredClone(sample)};
  const project = projects[activeId]?.data || emptyProject(undefined, language);
  return {library: projects, project, activeId: project.meta.id};
}
