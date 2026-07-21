import { inject, provide, type InjectionKey } from 'vue';
import { usePlayStore } from '../../stores/play';

export type PlaybackController = ReturnType<typeof usePlayStore> | any;

const playbackControllerKey: InjectionKey<PlaybackController> = Symbol(
  'music-playback-controller'
);

export function providePlaybackController(controller: PlaybackController) {
  provide(playbackControllerKey, controller);
}

export function usePlaybackController(): PlaybackController {
  const injected = inject(playbackControllerKey, null);
  return injected || usePlayStore();
}
