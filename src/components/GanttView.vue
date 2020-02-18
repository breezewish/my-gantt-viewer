<template>
  <div style="width: 100%; height: 100%; position: relative;">
    <b-modal :active="loadingAll > 0" :can-cancel="false">
      <div style="text-align: center; width: 300px; margin: 0 auto;">
        <p style="margin-bottom: 10px;">
          Loading data from GitHub...
        </p>
        <b-progress
          :value="(loadingFinished / loadingAll) * 100"
          size="is-small"
          type="is-info"
          style="width: 300px;"
        ></b-progress>
      </div>
    </b-modal>
    <div
      ref="gantt"
      style="position: absolute; left: 0; top: 27px; bottom: 0; width: 100%;"
    ></div>
    <div
      style="position: absolute; left: 0; width: 100%; top: 0; height: 27px; z-index: 15;"
    >
      <div style="display: inline-block; margin: 0 10px;">
        <b-slider
          size="is-small"
          :value="columnWidth"
          style="width: 100px; margin: 10px 0"
          :min="100"
          :max="700"
          @change="updateColumnWidth"
        />
      </div>
      <b-button
        size="is-small"
        type="is-text"
        @click="zoomIn"
        :disabled="!canZoomIn"
        icon-left="plus"
        >Zoom In</b-button
      >
      <b-button
        size="is-small"
        type="is-text"
        @click="zoomOut"
        :disabled="!canZoomOut"
        icon-left="minus"
        >Zoom Out</b-button
      >
      <b-button
        size="is-small"
        type="is-text"
        @click="collapseAll"
        icon-left="chevron-up"
        >Collapse All</b-button
      >
      <b-button
        size="is-small"
        type="is-text"
        @click="expandAll"
        icon-left="chevron-down"
        >Expand All</b-button
      >
      <b-button
        size="is-small"
        type="is-text"
        @click="reload"
        icon-left="refresh"
        >Reload</b-button
      >
    </div>
  </div>
</template>

<script>
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/ext/dhtmlxgantt_tooltip.js';
import 'dhtmlx-gantt/codebase/ext/dhtmlxgantt_marker.js';
import moment from 'moment';
import e from 'lodash/escape';
import forEach from 'lodash/forEach';

const QUERY_FRAG_RATELIMIT = `
rateLimit {
  limit
  cost
  remaining
  resetAt
}
`;

const FLAG_PROJECT_ENABLE = 'EnableGantt'.toLowerCase();
const FLAG_REGEX_ITEM_START = /GanttStart:\s*(\d\d\d\d-\d\d-\d\d)/i;
const FLAG_REGEX_ITEM_DUE = /GanttDue:\s*(\d\d\d\d-\d\d-\d\d)/i;
const FLAG_REGEX_ITEM_DURATION = /GanttDuration:\s*([\d]+)d/i;
const FLAG_REGEX_ITEM_PROGRESS = /GanttProgress:\s*([\d.]+)%/i;
const FLAG_DATE_FORMAT = 'YYYY-MM-DD';

export default {
  name: 'GanttView',
  props: ['org', 'repo'],
  data() {
    return {
      canZoomIn: true,
      canZoomOut: true,
      loadingAll: 0,
      loadingFinished: 0,
      columnWidth: 500,
    };
  },
  async mounted() {
    // gantt.config.readonly = true;
    gantt.ext.zoom.init({
      levels: [
        {
          name: 'hours',
          scales: [
            { unit: 'day', step: 1, format: '%d %M' },
            { unit: 'hour', step: 1, format: '%h' },
          ],
          round_dnd_dates: true,
          min_column_width: 30,
          scale_height: 60,
        },
        {
          name: 'days',
          scales: [
            { unit: 'month', step: 1, format: '%M' },
            { unit: 'week', step: 1, format: 'Week %W' },
            { unit: 'day', step: 1, format: '%d %D' },
          ],
          round_dnd_dates: true,
          min_column_width: 60,
          scale_height: 60,
        },
        {
          name: 'weeks',
          scales: [
            { unit: 'year', step: 1, format: '%Y' },
            { unit: 'month', step: 1, format: '%M' },
            { unit: 'week', step: 1, format: 'Week %W' },
          ],
          round_dnd_dates: false,
          min_column_width: 60,
          scale_height: 60,
        },
        {
          name: 'months',
          scales: [
            { unit: 'year', step: 1, format: '%Y' },
            { unit: 'month', step: 1, format: '%M' },
          ],
          round_dnd_dates: false,
          min_column_width: 50,
          scale_height: 60,
        },
        {
          name: 'quarters',
          scales: [
            { unit: 'year', step: 1, format: '%Y' },
            {
              unit: 'quarter',
              step: 1,
              format: function quarterLabel(date) {
                var month = date.getMonth();
                var q_num;
                if (month >= 9) {
                  q_num = 4;
                } else if (month >= 6) {
                  q_num = 3;
                } else if (month >= 3) {
                  q_num = 2;
                } else {
                  q_num = 1;
                }
                return 'Q' + q_num;
              },
            },
            { unit: 'month', step: 1, format: '%M' },
          ],
          round_dnd_dates: false,
          min_column_width: 50,
          scale_height: 60,
        },
        {
          name: 'years',
          scales: [{ unit: 'year', step: 1, format: '%Y' }],
          round_dnd_dates: false,
          min_column_width: 50,
          scale_height: 60,
        },
      ],
    });
    gantt.templates.grid_folder = item => {
      return '';
    };
    gantt.templates.grid_file = item => {
      return '';
    };
    gantt.config.columns = [
      {
        name: 'text',
        label: 'Name',
        tree: true,
        width: '*',
        template: task => {
          return `<a href="${e(task.url)}" target="_blank">${e(task.text)}</a>`;
        },
      },
      {
        name: 'assignee',
        label: 'Assignee',
        template: task => {
          if (task.assignee) {
            return `<a href="https://github.com/${e(
              task.assignee
            )}" target="_blank"><small>${e(task.assignee)}</small></a>`;
          } else {
            return '<small>(None)</small>';
          }
        },
        width: 100,
        max_width: 200,
      },
    ];
    gantt.templates.task_class = function(start, end, task) {
      switch (task.type) {
        case 'project':
          return 'task-kind-project';
          break;
        case 'task':
          return 'task-kind-task';
          break;
      }
    };
    gantt.config.drag_links = false;
    gantt.config.task_height = 18;
    gantt.config.row_height = 30;
    gantt.config.fit_tasks = true;
    gantt.config.grid_width = this.columnWidth;
    gantt.config.details_on_dblclick = false;
    gantt.ext.zoom.setLevel('months');

    gantt.init(this.$refs.gantt);
    this.reload();
  },
  methods: {
    updateColumnWidth(width) {
      this.columnWidth = width;
      gantt.config.grid_width = width;
      gantt.render();
    },
    updateCanZoomInOut() {
      var level = gantt.ext.zoom.getCurrentLevel();
      this.canZoomOut = !(level > 4);
      this.canZoomIn = !(level === 0);
    },
    zoomIn() {
      gantt.ext.zoom.zoomIn();
      gantt.render();
      this.updateCanZoomInOut();
    },
    zoomOut() {
      gantt.ext.zoom.zoomOut();
      gantt.render();
      this.updateCanZoomInOut();
    },
    collapseAll() {
      gantt.eachTask(function(task) {
        task.$open = false;
      });
      gantt.render();
    },
    expandAll() {
      gantt.eachTask(function(task) {
        task.$open = true;
      });
      gantt.render();
    },
    async reload() {
      try {
        await this.loadData();
      } catch (e) {
        console.error(e);
        this.$buefy.toast.open({
          duration: 3000,
          message: `Failed to load project or issues`,
          position: 'is-bottom',
          type: 'is-danger',
          queue: false,
        });
      }
      this.loadingAll = 0;
      this.loadingFinished = 0;
    },
    async loadData() {
      this.loadingAll = 2;
      const projects = await this.loadEnabledProjects();
      // window.projects = JSON.stringify(projects, null, 4);
      // const projects = require('./mock_projects.json');
      this.loadingFinished += 1;
      const projectIdArray = projects.map(p => p.id);
      if (projectIdArray.length == 0) {
        return {
          data: [],
          links: [],
        };
      }
      const items = await this.loadProjectItems(projectIdArray);
      // window.items = JSON.stringify(items, null, 4);
      // const items = require('./mock_items.json');
      this.loadingFinished += 1;

      const milestones = {};

      // calculate gantt properties
      items.forEach(item => {
        item._ganttStart = moment(item.createdAt)
          .startOf('day')
          .toDate();
        let m = item.body.match(FLAG_REGEX_ITEM_START);
        if (m) {
          // Override by start directive
          item._ganttStart = moment(m[1], FLAG_DATE_FORMAT).toDate();
        }

        if (item.milestone && item.milestone.dueOn) {
          item._ganttDue = moment(item.milestone.dueOn)
            .endOf('day')
            .toDate();
        }
        m = item.body.match(FLAG_REGEX_ITEM_DUE);
        if (m) {
          // Override by due directive
          item._ganttDue = moment(m[1], FLAG_DATE_FORMAT).toDate();
        }
        m = item.body.match(FLAG_REGEX_ITEM_DURATION);
        if (m) {
          // Override by duration directive
          const days = parseInt(m[1]);
          if (!Number.isNaN(days)) {
            item._ganttDue = moment(item._ganttStart)
              .add(parseInt(m[1]), 'd')
              .toDate();
          }
        }
        item._ganttProgress = 0;
        if (item.closed) {
          // Closed items always have progress = 1.
          item._ganttProgress = 1;
        } else {
          // Override by progress directive
          m = item.body.match(FLAG_REGEX_ITEM_PROGRESS);
          if (m) {
            const progress = parseFloat(m[1]);
            if (!Number.isNaN(progress)) {
              item._ganttProgress = progress / 100;
            }
          }
        }

        item._ganttAssignee = null;
        if (item.assignees.nodes.length > 0) {
          item._ganttAssignee = item.assignees.nodes[0].login;
        }

        if (item.milestone) {
          if (milestones[item.milestone.id] === undefined) {
            milestones[item.milestone.id] = item.milestone;
          }
        }
      });

      gantt.clearAll();

      const data = [];
      projects.forEach(proj => {
        data.push({
          id: proj.id,
          text: proj.name,
          type: 'project',
          open: true,
          url: proj.url,
          readonly: true,
          _proj: proj,
        });
      });
      items.forEach(item => {
        data.push({
          id: item.id,
          text: `#${item.number} ${item.title}`,
          type: 'task',
          start_date: item._ganttStart,
          end_date: item._ganttDue,
          progress: item._ganttProgress,
          parent: item.projectId,
          assignee: item._ganttAssignee,
          url: item.url,
          readonly: !item.viewerCanUpdate,
          _item: item,
        });
      });

      gantt.parse({ data, links: [] });

      gantt.addMarker({
        start_date: new Date(),
        text: 'Today',
        css: 'today',
      });

      forEach(milestones, milestone => {
        gantt.addMarker({
          start_date: moment(milestone.dueOn),
          text: milestone.title,
          css: 'normal',
        });
      });
    },
    async loadEnabledProjects() {
      // Request project only, to avoid easily exceeding GitHub's estimate cost.
      const r = [];
      let after = null;
      for (;;) {
        const resp = await this.$octoClient.request(
          `
          query loadEnabledProjects($org: String!, $repo: String!, $after: String) {
            repository(name: $repo, owner: $org) {
              projects(first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  body
                  id
                  name
                  number
                  state
                  url
                }
              }
            }
            ${QUERY_FRAG_RATELIMIT}
          }
        `,
          {
            org: this.$props.org,
            repo: this.$props.repo,
            after,
          }
        );
        if (!resp || !resp.repository) {
          throw new Error('Invalid loadEnabledProjects response');
        }
        console.log('loadEnabledProjects rateLimit', resp.rateLimit);
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
    },
    async loadProjectItems(projectIdArray) {
      // Currently only first 100 card in each column is supported..
      const r = [];
      const queryFlagItem = `
        id
        assignees(first: 1) {
          nodes {
            login
          }
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
        milestone {
          dueOn
          id
          title
          url
          state
          number
        }
      `;
      const resp = await this.$octoClient.request(
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
                      content {
                        __typename
                        ... on PullRequest {
                          ${queryFlagItem}
                        }
                        ... on Issue {
                          ${queryFlagItem}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          ${QUERY_FRAG_RATELIMIT}
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
            if (!card.content) {
              return;
            }
            r.push({
              ...card.content,
              projectId: proj.id,
            });
          });
        });
      });
      return r;
    },
  },
};
</script>

<style>
@import '~dhtmlx-gantt/codebase/dhtmlxgantt.css';
</style>

<style lang="scss">
@import '@/variables.scss';

.gantt_marker {
  &.today {
    background-color: rgba($black, 0.8);
  }

  &.normal {
    background-color: rgba($orange, 0.6);
  }
}
</style>
