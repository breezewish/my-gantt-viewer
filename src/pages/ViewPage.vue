<template>
  <GanttView
    :key="`${$route.params.org}/${$route.params.repo}`"
    :org="$route.params.org"
    :repo="$route.params.repo"
  />
</template>

<script>
import GanttView from '@/components/GanttView.vue';

export default {
  name: 'ViewPage',
  components: {
    GanttView,
  },
};
</script>
