import { Http } from 'vue-resource';
import some from 'lodash/some';
import * as utils from '@/utils.js';

const FLAG_PROJECT_ENABLE = 'EnableGantt'.toLowerCase();

const QUERY_FRAG_PROJECT = `
  body
  id
  name
  number
  state
  url
`;
// owner {
//   __typename
//   ... on Organization {
//     login
//   }
//   ... on Repository {
//     name
//     owner {
//       ... on Organization {
//         login
//       }
//       ... on User {
//         login
//       }
//     }
//   }
// }

const QUERY_FRAG_ISSUE_OR_PR = `
  id
  assignees(first: 1) {
    nodes {
      login
    }
  }
  author {
    login
  }
  body
  createdAt
  closed
  closedAt
  number
  url
  viewerCanUpdate
  title
  state
  repository {
    nameWithOwner
  }
  milestone {
    dueOn
    id
    title
    url
    state
    number
  }
  labels(first: 10) {
    nodes {
      name
      color
    }
  }
`;

const FLAG_REGEX_ITEM_IGNORE = /GanttIgnoreColumn:\s*([^\n\-]+)/i;

class OctoClient {
  QUERY_FRAG_RATELIMIT = `
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
  `;

  request = async (query, parameters) => {
    const resp = await Http.post('/github/graphql', {
      query,
      parameters,
    });
    return resp.body;
  };

  loadEnabledProjectsFromRepo = async (org, repo) => {
    const r = [];
    let after = null;
    for (;;) {
      const resp = await this.request(
        `
        query loadEnabledProjectsFromRepo($org: String!, $repo: String!, $after: String) {
          repository(name: $repo, owner: $org) {
            projects(first: 100, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ${QUERY_FRAG_PROJECT}
              }
            }
          }
          ${this.QUERY_FRAG_RATELIMIT}
        }
      `,
        {
          org,
          repo,
          after,
        }
      );
      if (!resp || !resp.repository) {
        console.log(resp);
        throw new Error('Invalid loadEnabledProjectsFromRepo response');
      }
      console.log('loadEnabledProjectsFromRepo rateLimit', resp.rateLimit);
      console.log(resp.repository.projects);
      resp.repository.projects.nodes.forEach(n => {
        if (n.body.toLowerCase().indexOf(FLAG_PROJECT_ENABLE) > -1) {
          r.push(n);
        }
      });
      if (!resp.repository.projects.pageInfo.hasNextPage) {
        break;
      }
      after = resp.repository.projects.pageInfo.endCursor;
    }
    return r;
  };

  loadEnabledProjectsFromOrg = async org => {
    const r = [];
    let after = null;
    for (;;) {
      const resp = await this.request(
        `
        query loadEnabledProjectsFromOrg($org: String!, $after: String) {
          organization(login: $org) {
            projects(first: 100, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ${QUERY_FRAG_PROJECT}
              }
            }
          }
          ${this.QUERY_FRAG_RATELIMIT}
        }
      `,
        {
          org,
          after,
        }
      );
      if (!resp || !resp.organization) {
        console.log(resp);
        throw new Error('Invalid loadEnabledProjectsFromOrg response');
      }
      console.log('loadEnabledProjectsFromOrg rateLimit', resp.rateLimit);
      console.log(resp.organization.projects.nodes);
      resp.organization.projects.nodes.forEach(n => {
        if (n.body.toLowerCase().indexOf(FLAG_PROJECT_ENABLE) > -1) {
          r.push(n);
        }
      });
      if (!resp.organization.projects.pageInfo.hasNextPage) {
        break;
      }
      after = resp.organization.projects.pageInfo.endCursor;
    }
    return r;
  };

  loadRepoProjectByProjNum = async (org, repo, num) => {
    console.log('Load repo project info: ', org, repo, num);

    const resp = await this.request(
      `
      query loadRepoProjectByProjNum($org: String!, $repo: String!, $num: Int!) {
        repository(name: $repo, owner: $org) {
          project(number: $num) {
            ${QUERY_FRAG_PROJECT}
          }
        }
        ${this.QUERY_FRAG_RATELIMIT}
      }
    `,
      {
        org,
        repo,
        num,
      }
    );
    if (!resp || !resp.repository) {
      console.log(resp);
      throw new Error('Invalid loadRepoProjectByProjNum response');
    }
    console.log('loadRepoProjectByProjNum rateLimit', resp.rateLimit);
    return resp.repository.project;
  };

  loadOrgProjectByProjNum = async (org, num) => {
    console.log('Load org project info: ', org, num);

    const resp = await this.request(
      `
      query loadOrgProjectByProjNum($org: String!, $num: Int!) {
        organization(login: $org) {
          project(number: $num) {
            ${QUERY_FRAG_PROJECT}
          }
        }
        ${this.QUERY_FRAG_RATELIMIT}
      }
    `,
      {
        org,
        num,
      }
    );
    if (!resp || !resp.organization) {
      console.log(resp);
      throw new Error('Invalid loadOrgProjectByProjNum response');
    }
    console.log('loadOrgProjectByProjNum rateLimit', resp.rateLimit);
    return resp.organization.project;
  };

  loadProjectItems = async projectIdArray => {
    if (projectIdArray.length === 0) {
      return [];
    }

    console.log('Load project items', projectIdArray);

    // Currently only first 100 card in each column is supported..
    const r = [];
    const resp = await this.request(
      `
      query loadProjectItems($ids: [ID!]!){
        projects: nodes(ids: $ids) {
          ...on Project {
            id
            columns(first: 10) {
              nodes {
                id
                name
                cards(first: 100) {
                  nodes {
                    isArchived
                    note
                    content {
                      __typename
                      ... on PullRequest {
                        ${QUERY_FRAG_ISSUE_OR_PR}
                      }
                      ... on Issue {
                        ${QUERY_FRAG_ISSUE_OR_PR}
                      }
                    }
                  }
                }
              }
            }
          }
        }
        ${this.QUERY_FRAG_RATELIMIT}
      }
    `,
      {
        ids: projectIdArray,
      }
    );
    if (!resp || !resp.projects) {
      throw new Error('Invalid loadProjectItems response');
    }
    console.log('loadProjectItems rateLimit', resp.rateLimit);
    resp.projects.forEach(proj => {
      proj.columns.nodes.forEach(column => {
        column.cards.nodes.forEach(card => {
          if (card.isArchived) {
            return;
          }
          if (!card.note && !card.content?.id) {
            // The card has either note or content
            return;
          }
          r.push({
            note: card.note,
            content: card.content,
            parentColumn: {
              name: column.name,
            },
            parentProject: {
              id: proj.id,
            },
          });
        });
      });
    });
    return r;
  };

  recursiveLoadProjectTree = async (
    rootProjects,
    fnIncTotal,
    fnIncFinished
  ) => {
    console.group('recursiveLoadProjectTree');

    async function wrapProjectWithParent(parentProjectId, promise) {
      fnIncTotal?.();
      const r = await promise;
      r.parentProject = {
        id: parentProjectId,
      };
      fnIncFinished?.();
      return r;
    }

    let projects = rootProjects;
    let depth = 0;
    const r = [];
    const idDedup = {};

    while (projects.length > 0 && depth < 4) {
      const projectIgnoreColumnsByProjectId = {};
      projects.forEach(proj => {
        // Match ignore column directives
        const m = proj.body.match(FLAG_REGEX_ITEM_IGNORE);
        if (m) {
          projectIgnoreColumnsByProjectId[proj.id] = m[1]
            .trim()
            .split(',')
            .map(v => v.trim().toLowerCase());
        }
      });

      const projectIdArrayToLoadItems = [];
      projects.forEach(p => {
        if (idDedup[p.id]) {
          return;
        }
        idDedup[p.id] = true;
        r.push({
          kind: 'project',
          ...p,
        });
        projectIdArrayToLoadItems.push(p.id);
      });

      fnIncTotal?.();
      const items = await this.loadProjectItems(projectIdArrayToLoadItems);
      fnIncFinished?.();

      const projectInfoArrayToLoadMeta = [];
      items.forEach(i => {
        if (i.note?.length > 0) {
          const info = utils.parseDirectProjectLink(i.note);
          if (!info) {
            return;
          }
          info.parentProjectId = i.parentProject.id;
          const infoId = JSON.stringify(info);
          if (idDedup[infoId]) {
            return;
          }
          idDedup[infoId] = true;
          projectInfoArrayToLoadMeta.push(info);
        } else if (i.content?.id) {
          const issueOrPrNode = i.content;
          if (idDedup[issueOrPrNode.id]) {
            return;
          }
          if (i.parentProject) {
            const ignoreColumns =
              projectIgnoreColumnsByProjectId[i.parentProject.id];
            if (ignoreColumns) {
              if (
                some(ignoreColumns, n => i.parentColumn.name.indexOf(n) > -1)
              ) {
                return;
              }
            }
          }
          idDedup[issueOrPrNode.id] = true;
          r.push({
            kind: 'issueOrPr',
            parentColumn: i.parentColumn,
            parentProject: i.parentProject,
            ...issueOrPrNode,
          });
        }
      });

      const promises = [];
      projectInfoArrayToLoadMeta.forEach(info => {
        if (info.type === 'org_project') {
          promises.push(
            wrapProjectWithParent(
              info.parentProjectId,
              this.loadOrgProjectByProjNum(info.org, info.project_num)
            )
          );
        } else if (info.type === 'repo_project') {
          promises.push(
            wrapProjectWithParent(
              info.parentProjectId,
              this.loadRepoProjectByProjNum(
                info.org,
                info.repo,
                info.project_num
              )
            )
          );
        } else {
          throw new Error('Unknown project info: ' + info.type);
        }
      });

      if (promises.length === 0) {
        break;
      }

      const leafProjects = await Promise.all(promises);
      projects = leafProjects;
      depth += 1;
    }

    console.groupEnd('recursiveLoadProjectTree');

    return r;
  };
}

export const octoClient = new OctoClient();

export const OctoClientPlugin = {
  install(Vue, _options) {
    Vue.prototype.$octoClient = octoClient;
  },
};
