import { create } from 'zustand';

export interface ReportTemplate {
  name: string;
  text: string;
}

interface ReportTemplateState {
  template: ReportTemplate | null;
  setTemplate: (template: ReportTemplate) => void;
  clearTemplate: () => void;
}

/** 汇报模板：纯瞬态，不落盘——每次生成报告前现上传，读取靠 read_template 工具（spec §3.3） */
export const useReportTemplateStore = create<ReportTemplateState>((set) => ({
  template: null,
  setTemplate: (template) => set({ template }),
  clearTemplate: () => set({ template: null }),
}));
