import { test, expect } from './fixtures';

/**
 * T22：mock 模式下的全链路冒烟——配置→倒活→拆解→筛选→对话→汇报→重启数据仍在→trace 有记录。
 * 必须用 `VITE_PAIHUO_MOCK=1 pnpm build` 产出的真实解包扩展跑（见 package.json 的 `pnpm e2e`），
 * 不是打进真实网络请求，是走 src/mocks 里的 fixture。
 */
test('mock 全链路：配置→倒活→拆解→筛选→对话→汇报→重启数据仍在→trace 有记录', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await test.step('配置：走完 3 步向导，测试连接显示已连通', async () => {
    await page.getByRole('button', { name: '设置' }).click();
    const dialog = page.locator('[role="dialog"][aria-label="接上 AI，只需 3 步"]');
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder('sk-').fill('sk-e2e-test-key');
    await dialog.getByRole('button', { name: '连接并拉取模型列表' }).click();
    await expect(dialog.getByText(/拿到.*个模型/)).toBeVisible();

    await dialog.getByRole('button', { name: '测试连接' }).click();
    await expect(dialog.getByText(/已连通/)).toBeVisible();

    // Sheet 是 CSS transform 做的显隐（translate-y-full），不是真的从 DOM 卸载，
    // 所以这里不能断言 toBeHidden——只确认关闭按钮点得到、后续操作不受抽屉遮挡即可。
    // 点蒙层（大命中区，Sheet 组件本身支持点蒙层=onClose）比点 28x28px 的图标按钮更稳。
    await page.locator('div[aria-hidden="true"].z-40').nth(1).click({ force: true, position: { x: 10, y: 10 } });
  });

  await test.step('倒活+拆解：示例文案产出发布会四件套任务卡', async () => {
    await page.getByRole('tab', { name: '活儿' }).click();
    await page.getByRole('button', { name: '试试示例' }).click();
    await page.getByRole('button', { name: '拆解' }).click();
    await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(4, { timeout: 10_000 });
  });

  await test.step('筛选：按类型筛只剩对应卡片，切回全部恢复', async () => {
    await page.getByRole('button', { name: /^演示/ }).click();
    await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(1);
    await page.getByRole('button', { name: /^全部/ }).click();
    await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(4);
  });

  await test.step('对话：快捷语句触发 complete_task，任务卡划线完成', async () => {
    const chatDialog = page.locator('[role="dialog"][aria-label="小派"]');
    await page.getByRole('button', { name: '会议纪要发完了' }).click();
    await expect(page.locator('[role="checkbox"][aria-checked="true"][aria-label="标记完成"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    // 结论文本还在流式吐字（busy=true）时关抽屉会跟状态更新赛跑，把背景蒙层卡在半开——
    // 等输入框重新可用（busy 落定）再关
    await expect(chatDialog.getByLabel('对话输入')).toBeEnabled({ timeout: 10_000 });
    // 头部「关闭」图标只有 28x28px，消息还在滚动重排时坐标点击偶发落空；
    // 蒙层是整屏大命中区（Sheet 组件本身支持点蒙层=onClose），点它更稳。
    // ChatSheet 在 App.tsx 里比 SettingsSheet 先挂载，同类蒙层里恒为第一个。
    await page.locator('div[aria-hidden="true"].z-40').first().click({ force: true, position: { x: 10, y: 10 } });
  });

  await test.step('汇报：生成日报，输出非空', async () => {
    await page.getByRole('tab', { name: '汇报' }).click();
    await page.getByRole('button', { name: /让 AI 写日报/ }).click();
    await expect(page.getByRole('button', { name: '复制全文' })).toBeVisible({ timeout: 10_000 });
    const reportText = await page.locator('.whitespace-pre-wrap').first().textContent();
    expect(reportText?.length ?? 0).toBeGreaterThan(0);
  });

  await test.step('重启数据仍在：刷新页面后任务与完成状态保留', async () => {
    await page.reload();
    await page.getByRole('tab', { name: '活儿' }).click();
    await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(4, { timeout: 10_000 });
    await expect(page.locator('[role="checkbox"][aria-checked="true"][aria-label="标记完成"]')).toHaveCount(1);
  });

  await test.step('trace 有记录：#/trace 页能看到本次 run', async () => {
    await page.goto(`chrome-extension://${extensionId}/trace.html`);
    await expect(page.getByText('decomposer').first()).toBeVisible();
    await expect(page.getByText('orchestrator').first()).toBeVisible();
    await expect(page.getByText('reporter').first()).toBeVisible();
  });
});
