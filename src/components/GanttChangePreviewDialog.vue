<template>
  <div class="modal-card" style="width: 700px">
    <header class="modal-card-head">
      <p class="modal-card-title">Preview Changes</p>
    </header>
    <section class="modal-card-body">
      <p>
        You have made following changes. Would you like to update GitHub issues
        to apply these changes?
        <b>Unselected changes will be discarded.</b>
      </p>
      <b-table
        :data="data"
        :bordered="false"
        :checked-rows.sync="checkedRows"
        narrowed
        :checkable="!updating"
        hoverable
        style="margin: 10px 0; font-size: 14px;"
      >
        <template slot-scope="props">
          <b-table-column label :visible="updating" width="40">
            <b-icon
              v-if="props.row.status == 'pending'"
              icon="timer-sand-empty"
              size="is-small"
              type="is-grey-lighter"
            />
            <b-icon
              v-if="props.row.status == 'success'"
              icon="check"
              size="is-small"
              type="is-success"
            />
            <b-icon
              v-if="props.row.status == 'fail'"
              icon="close"
              size="is-small"
              type="is-danger"
            />
            <b-icon
              v-if="props.row.status == 'skip'"
              icon="minus"
              size="is-small"
              type="is-grey-lighter"
            />
            <b-icon
              v-if="props.row.status == 'working'"
              icon="loading"
              size="is-small"
              class="loading-icon"
              type="is-grey-light"
            />
          </b-table-column>
          <b-table-column label="Task">
            <a :href="props.row.task._src.url" target="_blank">
              {{
              props.row.task.text
              }}
            </a>
          </b-table-column>
          <b-table-column label="Start Date" width="120">
            <div v-if="props.row.start_date">
              <div>
                <small>
                  <span class="change-from">
                    {{
                    props.row.start_date.from | date
                    }}
                  </span>
                </small>
              </div>
              <div>
                <small>{{ props.row.start_date.to | date }}</small>
              </div>
            </div>
          </b-table-column>
          <b-table-column label="End Date" width="120">
            <div v-if="props.row.end_date">
              <div>
                <small>
                  <span class="change-from">
                    {{
                    props.row.end_date.from | date
                    }}
                  </span>
                </small>
              </div>
              <div>
                <small>{{ props.row.end_date.to | date }}</small>
              </div>
            </div>
          </b-table-column>
          <b-table-column label="Progress" width="90">
            <div v-if="props.row.progress">
              <div>
                <small>
                  <span class="change-from">
                    {{
                    props.row.progress.from | percent
                    }}
                  </span>
                </small>
              </div>
              <div>
                <small>{{ props.row.progress.to | percent }}</small>
              </div>
            </div>
          </b-table-column>
        </template>
      </b-table>
    </section>
    <footer class="modal-card-foot">
      <b-button
        type="is-primary"
        icon-left="check"
        rounded
        @click="handleApply"
        :loading="updating"
        :disabled="checkedRows.length == 0 || checkedRows.length > 100"
      >Apply Selected Change</b-button>
      <b-button @click="$parent.close()" rounded :disabled="updating">Cancel</b-button>
    </footer>
  </div>
</template>

<script>
import moment from 'moment';

export default {
  name: 'GanttChangePreviewDialog',
  props: ['data', 'updating'],
  data() {
    return {
      checkedRows: [],
    };
  },
  filters: {
    percent: function(value) {
      return Math.floor(value * 100) + '%';
    },
    date: function(timestampValue) {
      return moment(timestampValue).format('YYYY-MM-DD');
    },
  },
  methods: {
    handleApply() {
      this.$emit('save', this.checkedRows);
    },
  },
};
</script>

<style lang="scss" scoped>
@import '@/variables.scss';

.change-from {
  background-color: rgba($red, 0.1);
  color: $red;
  text-decoration: line-through;
}

.loading-icon {
  animation: spinAround 0.5s infinite linear;
}
</style>
