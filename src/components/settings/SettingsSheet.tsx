import { useState } from 'react';
import { browser } from 'wxt/browser';
import { Sheet, Chip, Field, Button } from '@/src/components/ui';
import { Icon } from '@/src/components/icons/Icon';
import { useSettingsStore, clearAllData } from '@/src/store';
import { MODEL_PRESETS, getPreset } from '@/src/llm/presets';
import { isReasoningModel } from '@/src/llm/reasoningModel';
import { fetchModelList, type ModelInfo } from '@/src/llm/models';
import { testConnection, type TestConnectionResult } from '@/src/llm/testConnection';
import { LlmError } from '@/src/llm/types';

function describeError(error: LlmError): string {
  switch (error.kind) {
    case 'unauthorized':
      return 'key 不对——回步骤 2 检查有没有复制完整';
    case 'rate_limited':
      return '请求太频繁了，等几秒再试';
    case 'timeout':
      return '连接超时，检查网络或稍后重试';
    case 'network':
      return '连不上——检查接口地址和网络';
    default:
      return `连接失败：${error.message}`;
  }
}

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [clearConfirming, setClearConfirming] = useState(false);

  const preset = getPreset(settings.presetId);

  function handleSelectPreset(id: string) {
    const next = getPreset(id);
    setSettings({ presetId: id, baseUrl: next?.baseUrl ?? '' });
    setModels(null);
    setModelsError(null);
    setTestResult(null);
  }

  function handleOpenRegister() {
    if (preset?.registerUrl) {
      browser.tabs.create({ url: preset.registerUrl });
    }
  }

  async function handleFetchModels() {
    setModelsLoading(true);
    setModelsError(null);
    setTestResult(null);
    try {
      const list = await fetchModelList({ baseUrl: settings.baseUrl, apiKey: settings.apiKey });
      const sorted = [...list].sort(
        (a, b) =>
          Number(isReasoningModel(b.id, preset?.reasoningWhitelist)) -
          Number(isReasoningModel(a.id, preset?.reasoningWhitelist)),
      );
      setModels(sorted);
      const firstReasoning = sorted.find((m) => isReasoningModel(m.id, preset?.reasoningWhitelist));
      setSettings({ model: firstReasoning?.id ?? sorted[0]?.id ?? '' });
    } catch (err) {
      const llmError = err instanceof LlmError ? err : new LlmError('unknown', String(err));
      setModelsError(describeError(llmError));
      setModels(null);
    } finally {
      setModelsLoading(false);
    }
  }

  function handleSelectModel(id: string) {
    setSettings({ model: id });
    setTestResult(null);
  }

  async function handleTestConnection() {
    setTesting(true);
    const result = await testConnection({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model });
    setTestResult(result);
    setTesting(false);
  }

  const selectedIsNonReasoning =
    !!models && !!settings.model && !isReasoningModel(settings.model, preset?.reasoningWhitelist);

  return (
    <Sheet open={open} onClose={onClose} title="接上 AI，只需 3 步" heightClassName="h-[92%]">
      <div className="space-y-3 overflow-y-auto p-4">
        <p className="mb-1 text-[12.5px] leading-relaxed text-sub">
          用你自己的 API key——额度花在自己账上，数据只走你和 AI 平台之间。整个过程像注册个网盘：
          <b className="text-ink">注册 → 复制 key → 粘贴</b>，5 分钟只弄一次。
        </p>

        {/* 步骤 1 */}
        <div className="rounded-2xl border border-hairsoft bg-white p-3 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[11.5px] font-extrabold text-accent-ink">
              1
            </span>
            选一家 AI 平台
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {MODEL_PRESETS.map((p) => (
              <Chip key={p.id} active={settings.presetId === p.id} onClick={() => handleSelectPreset(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
          {preset && <p className="mb-2 text-[11.5px] leading-relaxed text-sub">{preset.tip}</p>}
          {preset?.registerUrl && (
            <button
              type="button"
              onClick={handleOpenRegister}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[rgba(61,111,252,.42)] bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent-ink"
            >
              <Icon name="ext" className="h-3 w-3" />
              去注册 · 创建 API key
            </button>
          )}
        </div>

        {/* 步骤 2 */}
        <div className="rounded-2xl border border-hairsoft bg-white p-3 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[11.5px] font-extrabold text-accent-ink">
              2
            </span>
            把 key 粘贴到这里
          </div>
          <Field
            label="API Key"
            type="password"
            autoComplete="off"
            placeholder="sk-…… 粘贴到这"
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
          />
          <Field
            label="接口地址（选好平台自动填，不用改）"
            autoComplete="off"
            spellCheck={false}
            value={settings.baseUrl}
            onChange={(e) => setSettings({ baseUrl: e.target.value })}
          />
        </div>

        {/* 步骤 3 */}
        <div className="rounded-2xl border border-hairsoft bg-white p-3 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[11.5px] font-extrabold text-accent-ink">
              3
            </span>
            连接，挑个「会思考」的模型
          </div>
          <button
            type="button"
            disabled={modelsLoading || !settings.apiKey || !settings.baseUrl}
            onClick={handleFetchModels}
            className="mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[rgba(61,111,252,.3)] bg-white text-[12.5px] font-semibold text-accent-ink shadow-card disabled:opacity-50"
          >
            <Icon name="reset" className="h-3.5 w-3.5" />
            {modelsLoading ? '连接中…' : '连接并拉取模型列表'}
          </button>

          {modelsError && (
            <p className="mb-2 rounded-lg bg-red-soft px-2.5 py-1.5 text-[11.5px] text-red">{modelsError}</p>
          )}

          {models && (
            <>
              <p className="mb-1.5 text-[11.5px] leading-relaxed text-sub">
                拿到 <b className="text-accent-ink">{models.length}</b> 个模型，已帮你选中推荐的推理模型——拆活儿、找关联全靠它"会想"：
              </p>
              <div className="mb-2 overflow-hidden rounded-xl border border-hairsoft">
                {models.map((m) => {
                  const reasoning = isReasoningModel(m.id, preset?.reasoningWhitelist);
                  const selected = settings.model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id)}
                      className={`flex w-full items-center gap-2 border-b border-hairsoft px-3 py-2.5 text-left text-[12.5px] last:border-b-0 ${selected ? 'bg-accent-soft' : 'bg-white'}`}
                    >
                      <span
                        className={`h-3.5 w-3.5 flex-none rounded-full border-[1.5px] ${selected ? 'border-accent bg-accent' : 'border-black/[.22]'}`}
                      />
                      <span className="font-semibold tabular-nums">{m.id}</span>
                      {reasoning && (
                        <span className="ml-auto rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-bold text-ok">
                          推理
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedIsNonReasoning && (
                <p className="mb-2 rounded-lg bg-red-soft px-2.5 py-1.5 text-[11.5px] leading-relaxed text-red">
                  这个模型不是推理模型——拆解、找关联的质量会明显下降，建议换回带「推理」标的。
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" disabled={testing || !settings.model} onClick={handleTestConnection}>
              {testing ? '测试中…' : '测试连接'}
            </Button>
            {testResult?.ok && (
              <span className="flex items-center gap-1 text-[12px] font-semibold tabular-nums text-ok">
                <Icon name="check" className="h-3.5 w-3.5" />
                已连通 · {testResult.model} · {testResult.latencyMs}ms
              </span>
            )}
          </div>
          {testResult && !testResult.ok && (
            <p className="mt-2 rounded-lg bg-red-soft px-2.5 py-1.5 text-[11.5px] text-red">
              {describeError(testResult.error)}
            </p>
          )}
        </div>

        <div className="flex gap-2 rounded-xl bg-wash p-2.5 text-[11.5px] leading-relaxed text-sub">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 flex-none text-faint" />
          <span>key 和任务数据只存在这台电脑的浏览器里，不经过任何第三方服务器；随时一键清空。</span>
        </div>

        <div className="pt-1 text-center">
          {!clearConfirming ? (
            <button
              type="button"
              onClick={() => setClearConfirming(true)}
              className="text-[11.5px] text-faint underline"
            >
              清空所有数据
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-[11.5px]">
              <span className="text-red">确定要清空？会删掉所有本地数据，无法恢复。</span>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setClearConfirming(false);
                  setModels(null);
                  setTestResult(null);
                }}
                className="font-bold text-red"
              >
                确定清空
              </button>
              <button type="button" onClick={() => setClearConfirming(false)} className="text-sub">
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
