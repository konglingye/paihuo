import { registerLlmBackgroundBridge } from '@/src/llm/background-bridge';

export default defineBackground(() => {
  browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error));

  registerLlmBackgroundBridge();
});
