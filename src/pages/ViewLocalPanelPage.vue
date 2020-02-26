<template>
  <GanttView :key="$route.params.id" :localPanelId="$route.params.id" />
</template>

<script>
import GanttView from '@/components/GanttView.vue';

export default {
  name: 'ViewLocalPanelPage',
  components: {
    GanttView,
  },
};
</script>
