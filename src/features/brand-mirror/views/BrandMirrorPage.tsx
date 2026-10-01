import type { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import { useBrandMirrorViewModel } from '../hooks/useBrandMirrorViewModel'
import { ComponentGallery } from '../preview-gallery/ComponentGallery'
import { PageGallery } from '../preview-gallery/PageGallery'
import { TokenControls } from '../token-editor/TokenControls'
import { TokenExplorer } from '../token-search/TokenExplorer'
import { VersionCompare } from '../versioning/VersionCompare'

function formatSavedTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return time
}

export function BrandMirrorPage({ viewModel }: { viewModel: BrandMirrorViewModel }) {
  const snapshot = useBrandMirrorViewModel(viewModel)
  const saveState = renderSaveState(snapshot, () => viewModel.retrySave())
  const toastDetail = snapshot.status === 'error'
    ? '关闭页面前请先重试成功'
    : snapshot.status === 'unsaved'
      ? '改动仅停留在页面，等待写入本地'
      : snapshot.lastSavedAt
        ? `本地已落盘 · ${formatSavedTime(snapshot.lastSavedAt)}`
        : '本地工作区内容一致'
  return <div className="app-shell"><header className="topbar"><div className="brand-lockup"><span className="brand-mark">✦</span><span>BrandMirror</span><span className="brand-subtitle">品牌视觉实验室</span></div><div className="topbar-right">{saveState}<span className="avatar-small">M</span></div></header><main className="workspace"><div><TokenControls snapshot={snapshot} onThemeChange={(theme) => viewModel.selectTheme(theme)} onColorChange={(field, value) => viewModel.updateColor(field, value)} onScaleChange={(field, index, value) => viewModel.updateScale(field, index, value)} onReset={() => viewModel.reset()} /><TokenExplorer tokens={snapshot.tokens} /></div><div className="preview-area"><div className="hero-heading"><div><span className="eyebrow">BRAND SYSTEM / 2024</span><h1>一套令牌，<em>无限可能。</em></h1><p>调整左侧令牌，观察它们如何在不同组件和页面中保持一致。</p></div><div className={`feedback-toast ${snapshot.status === 'error' ? 'is-error' : snapshot.status === 'unsaved' ? 'is-pending' : ''}`}><span className="toast-icon">{snapshot.status === 'error' ? '!' : snapshot.status === 'unsaved' ? '◌' : '✦'}</span><span><strong>{snapshot.message || (snapshot.status === 'saved' ? '所有更改已写入本地' : '准备开始探索')}</strong><small>{toastDetail}</small></span></div></div><ComponentGallery tokens={snapshot.tokens} /><PageGallery tokens={snapshot.tokens} /><VersionCompare snapshot={snapshot} onSave={() => viewModel.saveVersion()} onToggle={() => viewModel.toggleCompare()} onExport={() => viewModel.exportBrandGuidelines()} /></div></main></div>
}

function renderSaveState(snapshot: ReturnType<BrandMirrorViewModel['getSnapshot']>, onRetry: () => void) {
  if (snapshot.status === 'error') {
    return (
      <span className="save-state is-error">
        <span className="live-dot is-error" />
        <span className="save-state-label">本地写入失败 · 改动尚未落盘</span>
        <button className="save-retry-button" type="button" onClick={onRetry}>重试写入</button>
      </span>
    )
  }
  if (snapshot.status === 'unsaved') {
    return (
      <span className="save-state is-pending">
        <span className="live-dot is-pending" />
        <span className="save-state-label">有改动仅停留在页面 · 未保存</span>
      </span>
    )
  }
  return (
    <span className="save-state">
      <span className="live-dot" />
      <span className="save-state-label">{snapshot.lastSavedAt ? `所有更改已保存 · ${formatSavedTime(snapshot.lastSavedAt)}` : '所有更改已保存'}</span>
    </span>
  )
}
