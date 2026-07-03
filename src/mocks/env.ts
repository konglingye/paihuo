/** mock 模式开关：VITE_PAIHUO_MOCK=1 时，LLM 相关能力全部走 src/mocks/ 假数据，不花用户的钱 */
export function isMockMode(): boolean {
  return import.meta.env.VITE_PAIHUO_MOCK === '1';
}
