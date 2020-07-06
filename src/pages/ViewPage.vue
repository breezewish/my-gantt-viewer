<template>
  <GanttView :key="$route.params.pathMatch" :path="$route.params.pathMatch" />
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
