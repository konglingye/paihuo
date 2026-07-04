import { beforeEach, describe, expect, it } from 'vitest';
import { useReportTemplateStore } from './reportTemplateStore';

describe('reportTemplateStore（汇报模板，纯瞬态不落盘）', () => {
  beforeEach(() => {
    useReportTemplateStore.setState({ template: null });
  });

  it('初始为空', () => {
    expect(useReportTemplateStore.getState().template).toBeNull();
  });

  it('setTemplate 记录名字和全文', () => {
    useReportTemplateStore.getState().setTemplate({ name: '公司周报模板.docx', text: '# 周报\n## 本周工作' });
    expect(useReportTemplateStore.getState().template).toEqual({
      name: '公司周报模板.docx',
      text: '# 周报\n## 本周工作',
    });
  });

  it('clearTemplate 移除模板', () => {
    useReportTemplateStore.getState().setTemplate({ name: 'x.docx', text: 'y' });
    useReportTemplateStore.getState().clearTemplate();
    expect(useReportTemplateStore.getState().template).toBeNull();
  });
});
