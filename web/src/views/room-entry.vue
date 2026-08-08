<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import RoomView from './room.vue';
import RoomRelayView from './room-relay.vue';

const route = useRoute();
const relayGuest = computed(() => route.hash.startsWith('#relay='));
</script>

<template>
  <RoomRelayView v-if="relayGuest" />
  <RoomView v-else />
</template>
