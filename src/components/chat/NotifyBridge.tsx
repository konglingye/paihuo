import { useEffect, useRef } from 'react';
import { useToast } from '@/src/components/ui';
import { useUiStore } from '@/src/store';

/**
 * notify 工具没有 React context（它是从 agent 工具层调用的），只能落 uiStore 状态；
 * 这个组件负责把 uiStore.notification 的变化桥接成真正的 toast。挂一次在 App 顶层即可。
 */
export function NotifyBridge() {
  const notification = useUiStore((s) => s.notification);
  const { show } = useToast();
  const lastNonce = useRef(0);

  useEffect(() => {
    if (notification && notification.nonce !== lastNonce.current) {
      lastNonce.current = notification.nonce;
      show(notification.text);
    }
  }, [notification, show]);

  return null;
}
