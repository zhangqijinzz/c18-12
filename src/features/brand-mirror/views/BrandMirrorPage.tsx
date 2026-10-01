import { useEffect } from 'react'
import type { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import { useBrandMirrorViewModel } from '../hooks/useBrandMirrorViewModel'
import { describeSaveStatus } from '../models/brandMirrorModels'
import { ComponentGallery } from '../preview-gallery/ComponentGallery'
import { PageGallery } from '../preview-gallery/PageGallery'
import { TokenControls } from '../token-editor/TokenControls'
import { TokenExplorer } from '../token-search/TokenExplorer'
import { VersionCompare } from '../versioning/VersionCompare'

export function BrandMirrorPage({ viewModel }: { viewModel: BrandMirrorViewModel }) {
  const snapshot = useBrandMirrorViewModel(viewModel)
  const hasUnwrittenChanges = snapshot.saveStatus === 'error' || snapshot.saveStatus === 'unsaved' || snapshot.saveStatus === 'saving'

  // 仍有只停留在页面上的改动时，阻止误关页面导致丢失
  useEffect(() => {
    if (!hasUnwrittenChanges) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnwrittenChanges])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">✦</span>
          <span>BrandMirror</span>
          <span className="brand-subtitle">品牌视觉实验室</span>
        </div>
        <div className="topbar-right">
          {snapshot.saveStatus === 'error' ? (
            <span className="save-state save-state-error" role="alert">
              <span className="live-dot live-dot-error" />
              <span className="save-state-text">
                <strong>本地保存失败</strong>
                <small>{snapshot.saveError ?? '写入被拒绝'}，改动仅保留在本页面</small>
              </span>
              <button className="retry-button" type="button" onClick={() => viewModel.retrySave()}>重试写入</button>
            </span>
          ) : (
            <span className={`save-state save-state-${snapshot.saveStatus}`}>
              <span className={`live-dot live-dot-${snapshot.saveStatus}`} />
              {describeSaveStatus(snapshot.saveStatus)}
              {snapshot.persistedAt && snapshot.saveStatus === 'saved' && (
                <small className="saved-at">{new Date(snapshot.persistedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 已落盘</small>
              )}
            </span>
          )}
          <span className="avatar-small">M</span>
        </div>
      </header>
      <main className="workspace">
        <div>
          <TokenControls
            snapshot={snapshot}
            onThemeChange={(theme) => viewModel.selectTheme(theme)}
            onColorChange={(field, value) => viewModel.updateColor(field, value)}
            onScaleChange={(field, index, value) => viewModel.updateScale(field, index, value)}
            onReset={() => viewModel.reset()}
          />
          <TokenExplorer tokens={snapshot.tokens} />
        </div>
        <div className="preview-area">
          <div className="hero-heading">
            <div>
              <span className="eyebrow">BRAND SYSTEM / 2024</span>
              <h1>一套令牌，<em>无限可能。</em></h1>
              <p>调整左侧令牌，观察它们如何在不同组件和页面中保持一致。</p>
            </div>
            <div className={`feedback-toast ${snapshot.saveStatus === 'error' ? 'feedback-toast-error' : ''}`}>
              <span className="toast-icon">✦</span>
              <span>
                <strong>{snapshot.message || '准备开始探索'}</strong>
                <small>
                  {snapshot.saveStatus === 'error'
                    ? '写入失败，待重试后才会落盘'
                    : snapshot.dirtyFields.length > 0
                      ? `${snapshot.dirtyFields.length} 组改动仅在页面上，等待保存确认`
                      : '工作副本与本地已落盘内容一致'}
                </small>
              </span>
            </div>
          </div>
          <ComponentGallery tokens={snapshot.tokens} />
          <PageGallery tokens={snapshot.tokens} />
          <VersionCompare snapshot={snapshot} onSave={() => viewModel.saveVersion()} onToggle={() => viewModel.toggleCompare()} onExport={() => viewModel.exportBrandGuidelines()} />
        </div>
      </main>
      <footer className="bottom-status">
        <span><span className="live-dot" />已连接到本地工作区</span>
        <span>BrandMirror v0.1 <span className="footer-sep">·</span> 本地优先</span>
      </footer>
    </div>
  )
}
