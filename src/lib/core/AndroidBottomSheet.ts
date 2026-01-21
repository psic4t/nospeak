import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface AndroidBottomSheetPlugin {
    show(options?: { id?: string }): Promise<void>;
    hide(): Promise<void>;
    addListener(
        eventName: 'dismissed',
        listenerFunc: () => void
    ): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;
}

export const AndroidBottomSheet = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidBottomSheetPlugin>('AndroidBottomSheet')
    : (null as unknown as AndroidBottomSheetPlugin);
