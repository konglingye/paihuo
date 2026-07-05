import { test, expect } from './fixtures';

/**
 * 用户反馈的第二轮 bug/需求验收：删除任务不是只有标记完成、汇报输出是真富文本不是原始 markdown
 * 符号、工具目录纯国产。拆解确认弹窗的主流程已经在 full-chain.spec.ts 里跑过，这里只覆盖
 * full-chain 没顺带覆盖到的三个点。
 */
test('删除任务 + markdown 富文本渲染 + 工具目录纯国产', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await page.getByRole('tab', { name: '活儿' }).click();
  await page.getByRole('button', { name: '试试示例' }).click();
  await page.getByRole('button', { name: '拆解' }).click();
  const confirmDialog = page.locator('[role="dialog"][aria-label^="确认这"]');
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByLabel('发布会 PPT：给经销商讲渠道政策 截止时间').fill('下周一之前');
  await confirmDialog.getByLabel('发布会宣传文案，先出两版 截止时间').fill('下周一之前');
  await confirmDialog.getByLabel('汇总上季度各区域销售数据 不用填截止时间').check();
  await confirmDialog.getByRole('button', { name: /^确认创建/ }).click();
  await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(4, { timeout: 10_000 });

  // 展开 PPT 那张卡，看工具链接是不是纯国产（Kimi，不是 AiPPT/Gamma）
  await page.locator('[aria-label^="展开任务：发布会 PPT"]').click();
  const cardText = await page.locator('body').innerText();
  expect(cardText).toContain('Kimi');
  expect(cardText).not.toMatch(/AiPPT|Gamma|DeepL/);

  // 删除任务：确认不是只有"标记完成"
  const deleteBtn = page.getByRole('button', { name: '删除这件活儿' }).first();
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();
  await page.getByRole('button', { name: '确定删除' }).click();
  await expect(page.locator('[aria-label^="展开任务："]')).toHaveCount(3, { timeout: 5_000 });

  // 汇报：确认 markdown 渲染成真元素，不是原始 # / ** / | 符号
  await page.getByRole('tab', { name: '汇报' }).click();
  await page.getByRole('button', { name: /让 AI 写日报/ }).click();
  await expect(page.getByRole('button', { name: '复制全文' })).toBeVisible({ timeout: 10_000 });

  const reportContainer = page.locator('.shadow-card').first();
  const rawText = (await reportContainer.innerText()) ?? '';
  // 不应该出现原始 markdown 语法符号残留在可见文本里
  expect(rawText).not.toMatch(/^#{1,3}\s/m);
  expect(rawText).not.toMatch(/\*\*[^*]+\*\*/);
  // 默认日报 fixture 是"1. xxx"编号列表写法，应该被 remark-gfm 转成真的 <li>，不是原始文本
  const listItemCount = await reportContainer.locator('li').count();
  expect(listItemCount).toBeGreaterThan(0);
});
