<template>
  <div style="width: 100%; height: 100%; position: relative;">
    <vue-headful :title="`${title} - GanttViewer`" />
    <b-modal animation="zoom-in" :active="loadingAll > 0" :can-cancel="false">
      <div style="text-align: center; width: 300px; margin: 0 auto;">
        <p style="margin-bottom: 10px;">Loading data from GitHub...</p>
        <b-progress
          :value="(loadingFinished / loadingAll) * 100"
          size="is-small"
          type="is-info"
          style="width: 300px;"
        ></b-progress>
      </div>
    </b-modal>
    <b-modal
      animation="zoom-in"
      :active.sync="isPreviewChangeDialogVisible"
      has-modal-card
      trap-focus
      :can-cancel="false"
    >
      <GanttChangePreviewDialog
        :data="Object.values(pendingTaskChanges)"
        @save="handleApplyPendingChanges"
        :updating="isPreviewChangeDialogUpdating"
      />
    </b-modal>
    <div
      ref="gantt"
      style="position: absolute; left: 0; top: 27px; bottom: 0; width: 100%;"
    ></div>
    <div
      style="position: absolute; left: 0; width: 100%; top: 0; height: 27px;"
    >
      <div style="display: inline-block; margin: 0 10px;">
        <b-slider
          :tooltip="false"
          size="is-small"
          :value="columnWidth"
          style="width: 100px; margin: 10px 0"
          :min="100"
          :max="750"
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
      <b-button
        size="is-small"
        type="is-primary"
        @click="previewChanges"
        icon-left="check"
        :disabled="Object.keys(pendingTaskChanges).length === 0"
        >Preview & Save</b-button
      >
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/ext/dhtmlxgantt_tooltip.js';
import 'dhtmlx-gantt/codebase/ext/dhtmlxgantt_marker.js';
import moment from 'moment';
import { html } from 'common-tags';
import forEach from 'lodash/forEach';
import GanttChangePreviewDialog from './GanttChangePreviewDialog.vue';

// Flag is used to locate values.
const FLAG_REGEX_ITEM_START = /GanttStart:\s*(\d{4}-\d{2}-\d{2})/i;
const FLAG_REGEX_ITEM_DUE = /GanttDue:\s*(\d{4}-\d{2}-\d{2})/i;
const FLAG_REGEX_ITEM_DURATION = /GanttDuration:\s*([\d]+)d/i;
const FLAG_REGEX_ITEM_PROGRESS = /GanttProgress:\s*([\d.]+)%/i;
const FLAG_DATE_FORMAT = 'YYYY-MM-DD';

// Template is used to build values when they are not exist after update.
const TEMPLATE_ITEM_START = 'GanttStart: {}';
const TEMPLATE_ITEM_DUE = 'GanttDue: {}';
const TEMPLATE_ITEM_PROGRESS = 'GanttProgress: {}%';

export default {
  name: 'GanttView',
  props: ['org', 'repo', 'localPanelId'],
  computed: {
    ...mapState('localPanel', ['panels']),
    title() {
      if (!this.$props.localPanelId) {
        return `${this.$props.org}/${this.$props.repo}`;
      }
      const panel = this.panels[this.$props.localPanelId];
      if (!panel) {
        return this.$props.localPanelId;
      }
      return `Local Panel ${panel.name}`;
    },
  },
  components: {
    GanttChangePreviewDialog,
  },
  data() {
    return {
      canZoomIn: true,
      canZoomOut: true,
      loadingAll: 0,
      loadingFinished: 0,
      columnWidth: 500,
      pendingTaskChanges: {},
      isPreviewChangeDialogVisible: false,
      isPreviewChangeDialogUpdating: false,
    };
  },
  async mounted() {
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
    gantt.templates.task_text = () => {
      return '';
    };
    gantt.templates.rightside_text = (start, end, task) => {
      return html`
        ${task.text}
      `;
    };
    gantt.config.columns = [
      {
        name: 'text',
        label: 'Name',
        tree: true,
        template: task => {
          return html`
            <a href="${task._src.url}" target="_blank">${task.text}</a>
          `;
        },
        width: '*',
        min_width: 400,
      },
      {
        name: 'assignee',
        label: 'Assignee',
        template: task => {
          if (task._src._ganttAssignee) {
            return html`
              <a
                href="https://github.com/${task._src._ganttAssignee}"
                target="_blank"
                ><small>${task._src._ganttAssignee}</small></a
              >
            `;
          } else {
            return html`
              <small>(None)</small>
            `;
          }
        },
        min_width: 100,
        max_width: 200,
      },
      {
        name: 'repo',
        label: 'Repository',
        template: task => {
          console.log(task._src);
          if (task._src.repository) {
            return html`
              <small>${task._src.repository.nameWithOwner}</small>
            `;
          } else {
            return html``;
          }
        },
        min_width: 250,
      },
    ];
    gantt.templates.task_class = function(start, end, task) {
      switch (task.type) {
        case 'project':
          return 'kind-project';
          break;
        case 'task':
          switch (task.schedule) {
            case 'beyond-complete':
              return 'kind-task-beyond-complete';
            case 'beyond-schedule':
              return 'kind-task-beyond-schedule';
            case 'on-schedule':
              return 'kind-task-on-schedule';
            case 'out-schedule':
              return 'kind-task-out-schedule';
          }
          return 'kind-task';
          break;
      }
    };
    gantt.templates.tooltip_text = function(start, end, task) {
      let template = html`
        <div class="subtitle is-6" style="margin-bottom: 0.5rem">
          ${task.text}
        </div>
      `;
      template += html`
        <div>
          <b>Start date:</b> ${gantt.templates.tooltip_date_format(start)}
        </div>
      `;
      template += html`
        <div><b>End date:</b> ${gantt.templates.tooltip_date_format(end)}</div>
      `;
      template += html`
        <div><b>Progress:</b> ${Math.round(task.progress * 100)}%</div>
      `;
      if (task._src._ganttAssignee) {
        template += html`
          <div><b>Assignee:</b> @${task._src._ganttAssignee}</div>
        `;
      }
      if (task._src.milestone) {
        template += html`
          <div><b>Milestone:</b> ${task._src.milestone.title}</div>
        `;
      }
      if (task._src.state) {
        template += html`
          <div><b>State:</b> ${task._src.state}</div>
        `;
      }
      return template;
    };
    gantt.config.drag_links = false;
    gantt.config.task_height = 10;
    gantt.config.row_height = 35;
    gantt.config.fit_tasks = true;
    // gantt.config.grid_width = this.columnWidth;
    gantt.config.details_on_dblclick = false;
    gantt.config.lightbox.sections = [
      { name: 'time', height: 72, map_to: 'auto', type: 'duration' },
    ];
    gantt.config.time_step = 24 * 60;
    gantt.config.layout = {
      cols: [
        {
          width: this.columnWidth,
          min_width: 200,
          rows: [
            {
              view: 'grid',
              scrollX: 'gridScroll',
              scrollable: true,
              scrollY: 'scrollVer',
            },

            // horizontal scrollbar for the grid
            { view: 'scrollbar', id: 'gridScroll', group: 'horizontal' },
          ],
        },
        { resizer: true, width: 1 },
        {
          rows: [
            { view: 'timeline', scrollX: 'scrollHor', scrollY: 'scrollVer' },

            // horizontal scrollbar for the timeline
            { view: 'scrollbar', id: 'scrollHor', group: 'horizontal' },
          ],
        },
        { view: 'scrollbar', id: 'scrollVer' },
      ],
    };
    gantt.ext.zoom.setLevel('months');

    this.eventIdBeforeTaskChange = gantt.attachEvent(
      'onBeforeTaskChanged',
      this.handleBeforeTaskChange
    );
    this.eventIdAfterTaskUpdate = gantt.attachEvent(
      'onAfterTaskUpdate',
      this.handleAfterTaskUpdate
    );
    this.eventIdBeforeLightbox = gantt.attachEvent(
      'onBeforeLightbox',
      this.handleBeforeLightbox
    );
    this.eventIdLightboxSave = gantt.attachEvent(
      'onLightboxSave',
      this.handleLightboxSave
    );
    this.lastTask = null;

    gantt.init(this.$refs.gantt);
    this.reload();
  },
  beforeDestroy() {
    if (this.eventIdBeforeTaskChange) {
      gantt.detachEvent(this.eventIdBeforeTaskChange);
      this.eventIdBeforeTaskChange = null;
    }
    if (this.eventIdAfterTaskUpdate) {
      gantt.detachEvent(this.eventIdAfterTaskUpdate);
      this.eventIdAfterTaskUpdate = null;
    }
    if (this.eventIdBeforeLightbox) {
      gantt.detachEvent(this.eventIdBeforeLightbox);
      this.eventIdBeforeLightbox = null;
    }
    if (this.eventIdLightboxSave) {
      gantt.detachEvent(this.eventIdLightboxSave);
      this.eventIdLightboxSave = null;
    }
    this.lastTask = null;
  },
  methods: {
    setLastTask(task) {
      this.lastTask = {
        start_date: task.start_date.valueOf(),
        end_date: task.end_date.valueOf(),
        progress: task.progress,
        id: task.id,
      };
    },
    handleBeforeTaskChange(id, mode, task) {
      let allowChange = this.checkTaskPrivilege(task);
      if (allowChange) {
        this.setLastTask(task);
      } else {
        this.lastTask = null;
      }
      return allowChange;
    },
    handleAfterTaskUpdate(id, task) {
      if (!this.checkTaskPrivilege(task)) {
        console.error('No privilege to update task', id);
        return;
      }
      if (!this.lastTask) {
        console.error('Failed to verify lastTask', id);
        return;
      }
      if (this.lastTask.id !== id) {
        console.error('Failed to verify lastTask ID', id);
        return;
      }
      this.checkTaskChange(task, 'progress', v => v);
      this.checkTaskChange(task, 'start_date', v => v.valueOf());
      this.checkTaskChange(task, 'end_date', v => v.valueOf());
      console.log(task);
      this.lastTask = null;
      return true;
    },
    handleBeforeLightbox(id) {
      const task = gantt.getTask(id);
      if (!this.checkTaskPrivilege(task)) {
        return false;
      }
      return true;
    },
    handleLightboxSave(id, task) {
      if (!this.checkTaskPrivilege(task)) {
        return false;
      }
      this.setLastTask(task);
      return true;
    },
    checkTaskChange(newTask, fieldName, newValueMapper) {
      console.log('Checking change for %s of field %s', newTask.id, fieldName);
      const newValue = newValueMapper(newTask[fieldName]);
      const oldValue = this.lastTask[fieldName];
      if (newValue === oldValue) {
        return;
      }
      console.log('Field %s is changed', fieldName);
      const id = newTask.id;
      if (!this.pendingTaskChanges[id]) {
        this.$set(this.pendingTaskChanges, id, {
          id,
          task: newTask,
        });
      }
      const pendingChange = this.pendingTaskChanges[id];
      if (!pendingChange[fieldName]) {
        this.$set(pendingChange, fieldName, { from: oldValue });
      }
      this.$set(pendingChange[fieldName], 'to', newValue);
    },
    checkTaskPrivilege(task) {
      if (task.readonly) {
        return false;
      }
      if (task.type !== 'task') {
        return false;
      }
      if (!task._src.viewerCanUpdate) {
        return false;
      }
      if (!window.sessionInfo) {
        return false;
      }
      // const currentLogin = window.sessionInfo.githubUser.login;
      // if (
      //   currentLogin !== task._src._ganttAssignee &&
      //   currentLogin !== task._src.author.login
      // ) {
      //   return false;
      // }
      return true;
    },
    previewChanges() {
      if (Object.keys(this.pendingTaskChanges).length === 0) {
        return;
      }
      this.isPreviewChangeDialogVisible = true;
    },
    async handleApplyPendingChanges(changes) {
      forEach(this.pendingTaskChanges, change => {
        this.$set(change, 'status', 'skip');
      });
      changes.forEach(change => {
        change.status = 'pending';
      });
      this.isPreviewChangeDialogUpdating = true;

      // 1. Fetch the body of each changed issue
      const issueIds = changes.map(t => t.id);
      let issues = [];
      try {
        issues = await this.loadIssues(issueIds);
      } catch (e) {
        // No need to shortcut since no issues will be updated then.
        console.error(e);
      }

      const issuesById = {};
      issues.forEach(issue => (issuesById[issue.id] = issue));

      // 2. Ignore changes that cannot be updated
      changes.forEach(change => {
        if (!issuesById[change.id]) {
          change.status = 'fail';
        }
      });

      // 3. Apply change one by one. Use for loops to support async / await.
      for (let i = 0; i < changes.length; i++) {
        let change = changes[i];
        const issue = issuesById[change.id];
        if (!issue) {
          continue;
        }
        change.status = 'working';
        try {
          await this.applyIssueUpdate(issue, change);
          change.status = 'success';
        } catch (e) {
          console.error(e);
          change.status = 'fail';
          if (
            e.body &&
            e.body.msg &&
            e.body.msg.indexOf('OAuth App access restriction') > -1
          ) {
            this.$buefy.dialog.alert({
              animation: 'zoom-in',
              title: 'Update failed',
              message:
                'GanttViewer does not have permissions to write the repository in this organization. <a href="https://help.github.com/en/github/setting-up-and-managing-your-github-user-account/requesting-organization-approval-for-oauth-apps" target="_blank">Click here for help</a>',
              confirmText: 'OK',
            });
            this.isPreviewChangeDialogUpdating = false;
            this.isPreviewChangeDialogVisible = false;
            return;
          }
        }
      }

      // 4. All changes are applied
      setTimeout(() => {
        this.pendingTaskChanges = {};
        this.isPreviewChangeDialogUpdating = false;
        this.isPreviewChangeDialogVisible = false;
        this.reload();
      }, 500);
    },
    updateIssueBodyForField(body, flagMatcher, template, newValue) {
      const m = body.match(flagMatcher);
      const newValueFull = template.replace('{}', newValue);
      if (m) {
        return body.replace(m[0], newValueFull);
      } else {
        return body + `\n<!-- ${newValueFull} -->`;
      }
    },
    async applyIssueUpdate(issue, change) {
      let body = issue.body;
      if (change.progress) {
        body = this.updateIssueBodyForField(
          body,
          FLAG_REGEX_ITEM_PROGRESS,
          TEMPLATE_ITEM_PROGRESS,
          Math.floor(change.progress.to * 100)
        );
      }
      if (change.start_date || change.end_date) {
        // As long as start_date or end_date is changed, we need to update both
        // because the task date may be generated from duration.
        body = this.updateIssueBodyForField(
          body,
          FLAG_REGEX_ITEM_START,
          TEMPLATE_ITEM_START,
          moment(change.task.start_date.valueOf()).format(FLAG_DATE_FORMAT)
        );
        body = this.updateIssueBodyForField(
          body,
          FLAG_REGEX_ITEM_DUE,
          TEMPLATE_ITEM_DUE,
          moment(change.task.end_date.valueOf()).format(FLAG_DATE_FORMAT)
        );
        // We also need to remove the duration directive.
        const m = body.match(FLAG_REGEX_ITEM_DURATION);
        if (m) {
          body = body.replace(m[0], '');
        }
      }

      let mutationFrag;
      if (change.task._src.__typename === 'Issue') {
        mutationFrag = `
          updateIssue(input: {id: $id, body: $body}) {
            issue {
              body
            }
          }
        `;
      } else {
        mutationFrag = `
          updatePullRequest(input: {pullRequestId: $id, body: $body}) {
            pullRequest {
              body
            }
          }
        `;
      }

      await this.$octoClient.request(
        `
        mutation update($id: ID!, $body: String!) {
          __typename
          ${mutationFrag}
        }
      `,
        {
          id: issue.id,
          body,
        }
      );
    },
    updateColumnWidth(width) {
      this.columnWidth = width;
      gantt.config.layout.cols[0].width = width;
      gantt._reinit(this.$refs.gantt);
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
      this.pendingTaskChanges = {};
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

      let projects = [];
      if (this.$props.localPanelId) {
        const panel = this.panels[this.$props.localPanelId];
        if (!panel) {
          this.$buefy.dialog.alert(
            `Local panel ${this.$props.localPanelId} does not exist.`
          );
          return;
        }
        projects = Object.freeze(Object.values(panel.projects));
      } else {
        projects = await this.$octoClient.loadEnabledProjectsFromRepo(
          this.$props.org,
          this.$props.repo
        );
      }
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
        m = item.body.match(FLAG_REGEX_ITEM_DUE);
        if (m) {
          // Override by due directive
          item._ganttDue = moment(m[1], FLAG_DATE_FORMAT).toDate();
        }
        if (!item._ganttDue) {
          item._ganttDue = new Date(
            item._ganttStart.valueOf() + 24 * 60 * 60 * 1000
          );
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
        if (item.__typename === 'Issue') {
          if (item.assignees.nodes.length > 0) {
            item._ganttAssignee = item.assignees.nodes[0].login;
          }
        } else {
          // For PullRequests, show author as assignee.
          item._ganttAssignee = item.author.login;
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
        const projectProgresses = items.filter(
          item => item.projectId == proj.id
        );
        data.push({
          id: proj.id,
          text: proj.name,
          type: 'project',
          open: true,
          readonly: true,
          progress:
            projectProgresses.reduce((a, b) => {
              return a + b._ganttProgress;
            }, 0) / projectProgresses.length,
          _src: proj,
        });
      });
      items.forEach(item => {
        data.push({
          id: item.id,
          text: `#${item.number} ${item.title}`,
          type: 'task',
          schedule: (function() {
            if (item._ganttProgress === 1) {
              return 'beyond-complete';
            }

            const now = Date.now();
            if (Date.now() > item._ganttDue) {
              return 'out-schedule';
            }

            const allDuration = item._ganttDue - item._ganttStart;
            const lastDuration = Date.now() - item._ganttStart;
            const expectedProgress = lastDuration / allDuration;

            if (item._ganttProgress > expectedProgress) {
              return 'beyond-schedule';
            }
            return 'on-schedule';
          })(),
          start_date: item._ganttStart,
          end_date: item._ganttDue,
          progress: item._ganttProgress,
          parent: item.projectId,
          readonly: !item.viewerCanUpdate,
          _src: item,
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
    async loadIssues(issueIdArray) {
      // This function is used to re-fetch body before update, to avoid overriding contents.
      const r = [];
      const queryFrag = `
        id
        body
        viewerCanUpdate
      `;
      const resp = await this.$octoClient.request(
        `
        query loadIssues($ids: [ID!]!){
          issues: nodes(ids: $ids) {
            __typename
            ... on Issue {
              ${queryFrag}
            }
            ... on PullRequest {
              ${queryFrag}
            }
          }
          ${this.$octoClient.QUERY_FRAG_RATELIMIT}
        }
      `,
        {
          ids: issueIdArray,
        }
      );
      if (!resp || !resp.issues) {
        throw new Error('Invalid loadIssues response');
      }
      console.log('loadIssues rateLimit', resp.rateLimit);
      resp.issues.forEach(issue => {
        if (issue.viewerCanUpdate) {
          r.push(issue);
        }
      });
      return r;
    },
    async loadProjectItems(projectIdArray) {
      // Currently only first 100 card in each column is supported..
      const r = [];
      const itemIds = {};
      const queryFragItem = `
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
                          ${queryFragItem}
                        }
                        ... on Issue {
                          ${queryFragItem}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          ${this.$octoClient.QUERY_FRAG_RATELIMIT}
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
            if (!card.content.id) {
              return;
            }
            // Deduplicate
            if (itemIds[card.content.id]) {
              return;
            }
            itemIds[card.content.id] = true;
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
  pointer-events: none;

  &.today {
    background-color: rgba($black, 0.8);
  }

  &.normal {
    background-color: rgba($orange, 0.6);
  }
}

.gantt_side_content.gantt_right {
  overflow: visible;
}

.gantt_task_line {
  border: 1px solid transparent;
  border-radius: 0;

  &.gantt_selected {
    box-shadow: none;
    border: 1px solid transparent;
  }

  &.kind-project {
    background-color: rgba(#444, 0.3);
    .gantt_task_progress {
      background-color: #444;
    }
    // &.gantt_selected {
    //   border: 1px solid #444;
    // }
  }

  &.kind-task-beyond-complete {
    background-color: rgba($blue, 0.3);
    // &.gantt_selected {
    //   border: 1px solid $blue;
    // }
    .gantt_task_progress {
      background-color: $blue;
    }
  }

  &.kind-task-beyond-schedule {
    background-color: rgba($green, 0.3);
    // &.gantt_selected {
    //   border: 1px solid $green;
    // }
    .gantt_task_progress {
      background-color: $green;
    }
  }

  &.kind-task-on-schedule {
    background-color: rgba(247, 195, 0, 0.3);
    // &.gantt_selected {
    //   border: 1px solid $orange;
    // }
    .gantt_task_progress {
      background-color: rgb(247, 180, 17);
    }
  }

  &.kind-task-out-schedule {
    background-color: rgba($red, 0.3);
    // &.gantt_selected {
    //   border: 1px solid $red;
    // }
    .gantt_task_progress {
      background-color: rgba($red, 0.8);
    }
  }
}
</style>
