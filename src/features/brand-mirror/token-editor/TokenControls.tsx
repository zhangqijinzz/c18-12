import type { BrandMirrorSnapshot, BrandTheme, DirtyFlags } from '../models/brandMirrorModels'

interface TokenControlsProps {
  snapshot: BrandMirrorSnapshot
  onThemeChange: (theme: BrandTheme) => void
  onColorChange: (field: 'primary' | 'secondary', value: string) => void
  onScaleChange: (field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number) => void
  onReset: () => void
}

const themes: { id: BrandTheme; label: string; note: string }[] = [
  { id: 'studio', label: 'Studio warm', note: '热烈 · 友好' },
  { id: 'editorial', label: 'Editorial green', note: '克制 · 自然' },
  { id: 'night', label: 'Night signal', note: '锐利 · 数字' },
]

function PersistTag({ dirty, saveFailed }: { dirty: boolean; saveFailed: boolean }) {
  if (!dirty) return <span className="persist-tag is-saved"><span className="tag-dot" />已落盘</span>
  return <span className={`persist-tag ${saveFailed ? 'is-error' : 'is-pending'}`}><span className="tag-dot" />仅停留在页面</span>
}

export function TokenControls({ snapshot, onThemeChange, onColorChange, onScaleChange, onReset }: TokenControlsProps) {
  const dirty: DirtyFlags = snapshot.dirty
  const saveFailed = snapshot.status === 'error'
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / TOKENS</span>
          <h2>视觉令牌</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>恢复默认</button>
      </div>

      <section className="control-section">
        <div className="section-label"><span>基础主题</span><PersistTag dirty={dirty.theme} saveFailed={saveFailed} /></div>
        <div className="theme-list">
          {themes.map((theme) => (
            <button className={`theme-option ${snapshot.theme === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => onThemeChange(theme.id)} type="button">
              <span className={`theme-dot ${theme.id}`} />
              <span><strong>{theme.label}</strong><small>{theme.note}</small></span>
              {snapshot.theme === theme.id && <span className="check-mark">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-label"><span>品牌色</span><PersistTag dirty={dirty.primary || dirty.secondary} saveFailed={saveFailed} /></div>
        <div className="color-fields">
          <ColorField label="主色" value={snapshot.tokens.primary} dirty={dirty.primary} onChange={(value) => onColorChange('primary', value)} />
          <ColorField label="辅助色" value={snapshot.tokens.secondary} dirty={dirty.secondary} onChange={(value) => onColorChange('secondary', value)} />
        </div>
        <div className={`contrast-note ${snapshot.contrastWarning ? 'warning' : ''}`}>
          <span className="contrast-icon">◐</span>
          <span>对比度 <strong>{snapshot.contrastRatio.toFixed(1)}:1</strong> · {snapshot.contrastWarning ? '建议提高对比度' : '适合界面使用'}</span>
        </div>
      </section>

      <ScaleControl label="圆角尺度" hint="px" values={snapshot.tokens.radiusScale} field="radiusScale" dirty={dirty.radiusScale} saveFailed={saveFailed} onChange={onScaleChange} />
      <ScaleControl label="间距体系" hint="px" values={snapshot.tokens.spacingScale} field="spacingScale" dirty={dirty.spacingScale} saveFailed={saveFailed} onChange={onScaleChange} />
      <ScaleControl label="字体比例" hint="px" values={snapshot.tokens.typeScale} field="typeScale" dirty={dirty.typeScale} saveFailed={saveFailed} onChange={onScaleChange} />

      <div className={`panel-footer ${saveFailed ? 'is-error' : snapshot.hasUnsavedChanges ? 'is-pending' : ''}`}>
        {saveFailed
          ? <><span className="live-dot is-error" />本地写入失败，未标记“已落盘”的改动只在当前页面</>
          : snapshot.hasUnsavedChanges
            ? <><span className="live-dot is-pending" />存在仅停留在页面的改动，等待写入本地</>
            : <><span className="live-dot" />所有调整均已写入本地</>}
      </div>
    </aside>
  )
}

function ColorField({ label, value, dirty, onChange }: { label: string; value: string; dirty: boolean; onChange: (value: string) => void }) {
  return <label className={`color-field ${dirty ? 'is-dirty' : ''}`}><span>{label}{dirty && <i className="field-dirty-dot" title="该改动尚未落盘" />}</span><div className="color-input"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} HEX`} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

function ScaleControl({ label, hint, values, field, dirty, saveFailed, onChange }: { label: string; hint: string; values: number[]; field: 'radiusScale' | 'spacingScale' | 'typeScale'; dirty: boolean; saveFailed: boolean; onChange: (field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number) => void }) {
  return <section className="control-section scale-section"><div className="section-label"><span>{label}</span><span className="scale-label-right"><PersistTag dirty={dirty} saveFailed={saveFailed} /><span className="muted">{hint}</span></span></div><div className={`scale-inputs ${dirty ? 'is-dirty' : ''}`}>{values.map((value, index) => <label key={`${field}-${index}`}><span>{index + 1}</span><input aria-label={`${label}${index + 1}`} type="number" min={field === 'typeScale' ? 10 : 0} max={field === 'typeScale' ? 72 : field === 'spacingScale' ? 64 : 40} value={value} onChange={(event) => onChange(field, index, Number(event.target.value))} /></label>)}</div></section>
}
