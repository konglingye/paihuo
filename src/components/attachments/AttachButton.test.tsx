import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useFragmentsStore } from '@/src/store';
import { ToastProvider } from '@/src/components/ui';
import { AttachButton } from './AttachButton';

function renderWithToast() {
  return render(
    <ToastProvider>
      <AttachButton />
    </ToastProvider>,
  );
}

function fireFileChange(file: File) {
  const input = screen.getByTestId('attachment-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('AttachButton', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    useFragmentsStore.setState({ fragments: {} });
  });

  it('拒收不在白名单内的文件，弹出原型文案的 toast', async () => {
    renderWithToast();
    const file = new File(['MZ...'], 'virus.exe', { type: 'application/octet-stream' });
    fireFileChange(file);

    expect(await screen.findByText('.exe 这类文件帮不上忙——支持 pdf / txt / word / 表格和截图')).toBeInTheDocument();
    expect(useFragmentsStore.getState().fragments).toEqual({});
  });

  it('接受白名单内的文本文件，解析后存进 fragmentsStore', async () => {
    const attached: string[] = [];
    render(
      <ToastProvider>
        <AttachButton onAttached={(f) => attached.push(f.id)} />
      </ToastProvider>,
    );
    const file = new File(['随手记的一句话'], 'note.txt', { type: 'text/plain' });
    fireFileChange(file);

    await screen.findByTestId('attachment-input');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const fragments = Object.values(useFragmentsStore.getState().fragments);
    expect(fragments).toHaveLength(1);
    expect(fragments[0].raw).toBe('随手记的一句话');
    expect(fragments[0].attachments).toEqual([{ name: 'note.txt', text: '随手记的一句话' }]);
    expect(attached).toEqual([fragments[0].id]);
  });

  it('点击可见按钮会触发隐藏 input 的文件选择', () => {
    renderWithToast();
    expect(screen.getByRole('button', { name: '上传文件' })).toBeInTheDocument();
  });

  it('传了 onFile 时接管解析结果，不自动写入 fragmentsStore（供倒活面板攒起来一起提交）', async () => {
    const files: { name: string }[] = [];
    render(
      <ToastProvider>
        <AttachButton onFile={(f) => files.push(f)} />
      </ToastProvider>,
    );
    const file = new File(['随手记的一句话'], 'note.txt', { type: 'text/plain' });
    fireFileChange(file);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(files).toEqual([{ name: 'note.txt', parsed: { text: '随手记的一句话', isImage: false } }]);
    expect(useFragmentsStore.getState().fragments).toEqual({});
  });
});
