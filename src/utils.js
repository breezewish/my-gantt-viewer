import gh from 'parse-github-url';

export function parseDirectProjectLink(path) {
  if (path.trim() === '') {
    return null;
  }

  {
    // Example: https://github.com/orgs/pingcap/projects/8
    const m = path.match(/github\.com\/orgs\/([-\w\d\.\_]+)\/projects\/(\d+)/);
    if (m) {
      return {
        type: 'org_project',
        org: m[1],
        project_num: parseInt(m[2]),
      };
    }
  }
  {
    // Example: https://github.com/tikv/tikv/projects/26
    const m = path.match(
      /github\.com\/([-\w\d\.\_]+)\/([-\w\d\.\_]+)\/projects\/(\d+)/
    );
    if (m) {
      return {
        type: 'repo_project',
        org: m[1],
        repo: m[2],
        project_num: parseInt(m[3]),
      };
    }
  }

  return null;
}

export function parseProjectPath(path) {
  if (path.trim() === '') {
    return null;
  }

  {
    // Example: https://github.com/orgs/pingcap/projects/8
    // Example: https://github.com/tikv/tikv/projects/26
    const r = parseDirectProjectLink(path);
    if (r) {
      return r;
    }
  }

  {
    // Example: pingcap
    const m = path.match(/^([\w\d\.]+)$/);
    if (m) {
      return {
        type: 'org',
        org: m[1],
      };
    }
  }

  const r = gh(path);
  if (r.owner && !r.name) {
    return {
      type: 'org',
      org: r.owner,
    };
  }

  if (r.owner && r.name) {
    if (r.owner === 'orgs') {
      // Example: https://github.com/orgs/pingcap/projects
      return {
        type: 'org',
        org: r.name,
      };
    } else {
      return {
        type: 'repo',
        org: r.owner,
        repo: r.name,
      };
    }
  }

  return null;
}

export function loadProjectsByPath(path, octoClient) {
  const parsed = parseProjectPath(path);
  return loadProjectsByParsedInfo(parsed, octoClient);
}

export async function loadProjectsByParsedInfo(parsed, octoClient) {
  switch (parsed.type) {
    case 'org':
      return await octoClient.loadEnabledProjectsFromOrg(parsed.org);
    case 'repo':
      return await octoClient.loadEnabledProjectsFromRepo(
        parsed.org,
        parsed.repo
      );
    case 'org_project': {
      const project = await octoClient.loadOrgProjectByProjNum(
        parsed.org,
        parsed.project_num
      );
      return [project];
    }
    case 'repo_project': {
      const project = await octoClient.loadRepoProjectByProjNum(
        parsed.org,
        parsed.repo,
        parsed.project_num
      );
      return [project];
    }
    default:
      return [];
  }
}
