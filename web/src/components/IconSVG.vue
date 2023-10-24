<script lang="ts" setup>
import { defineProps, withDefaults } from "vue";
const props = defineProps({
  src: {
    type: String,
    default: "",
  },
  style: {
    type: Object,
    default: () => {
      return {
        width: 10,
        height: 10,
        color: "",
      };
    },
  },
});
const names = `#${props.src}`;
</script>
<template>
    <i>
        <svg :style="style">
            <use :href="props.src"></use>
        </svg>
    </i>
</template>