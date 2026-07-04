import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorage } from './storage';
import { SCHEMA_VERSION } from './version';

export interface MemoryFact {
  text: string;
  lastUsedAt: number;
}

/** 用户画像上限（arch §3.3）：超出按最近使用淘汰，不是先进先出 */
const PROFILE_CHAR_CAP = 800;

function totalChars(facts: MemoryFact[]): number {
  return facts.reduce((sum, f) => sum + f.text.length, 0);
}

/** 超限时反复淘汰 lastUsedAt 最小（最久没被 remember/recall 碰过）的一条，直到回到上限内；至少留一条 */
function evictLeastRecentlyUsed(facts: MemoryFact[]): MemoryFact[] {
  const next = [...facts];
  while (totalChars(next) > PROFILE_CHAR_CAP && next.length > 1) {
    let oldestIndex = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i].lastUsedAt < next[oldestIndex].lastUsedAt) oldestIndex = i;
    }
    next.splice(oldestIndex, 1);
  }
  return next;
}

interface MemoryState {
  facts: MemoryFact[];
  /** remember 工具：记一条关于用户的事实（称呼/部门/工具偏好/纠正记录） */
  remember: (text: string) => void;
  /** recall 工具：按关键词过滤（不传就返回全部），命中的事实顺带刷新 lastUsedAt */
  recall: (topic?: string) => string[];
  /** 注入 system 记忆块用的纯文本（arch §3.1 六块提示词的 memory 块） */
  profileText: () => string;
}

/** 用户画像（arch §3.3）：remember/recall 工具维护，注入所有 profile 的记忆块 */
export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      facts: [],
      remember: (text) =>
        set((state) => ({
          facts: evictLeastRecentlyUsed([...state.facts, { text, lastUsedAt: Date.now() }]),
        })),
      recall: (topic) => {
        const { facts } = get();
        const matched = topic ? facts.filter((f) => f.text.includes(topic)) : facts;
        if (matched.length > 0) {
          const now = Date.now();
          const matchedTexts = new Set(matched.map((f) => f.text));
          set({ facts: facts.map((f) => (matchedTexts.has(f.text) ? { ...f, lastUsedAt: now } : f)) });
        }
        return matched.map((f) => f.text);
      },
      profileText: () => get().facts.map((f) => `- ${f.text}`).join('\n'),
    }),
    {
      name: 'paihuo:memory',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => chromeStorage),
    },
  ),
);
