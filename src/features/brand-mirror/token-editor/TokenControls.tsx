import type { BrandMirrorSnapshot, BrandTheme } from '../models/brandMirrorModels'

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

export function TokenControls({ snapshot, onThemeChange, onColorChange, onScaleChange, onReset }: TokenControlsProps) {
  const dirty = new Set(snapshot.dirtyFields)
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / TOKENS</span>
          <h2>视觉令牌</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>恢复默认</button>
      </div>

      {snapshot.dirtyFields.length > 0 && (
        <div className="dirty-banner">
          <span className="dirty-dot" />
          {snapshot.saveStatus === 'error'
            ? '下列改动写入失败，仅停留在页面，请在顶栏重试'
            : '标记的改动尚未确认落盘'}
        </div>
      )}

      <section className="control-section">
        <div className="section-label"><span>基础主题</span><span className="muted">快速起点</span></div>
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
        <div className="section-label">
          <span>品牌色{dirty.has('primary') || dirty.has('secondary') ? <i className="unsaved-badge">未保存</i> : null}</span>
          <span className="muted">HEX / 6 位</span>
        </div>
        <div className="color-fields">
          <ColorField label="主色" dirty={dirty.has('primary')} value={snapshot.tokens.primary} onChange={(value) => onColorChange('primary', value)} />
          <ColorField label="辅助色" dirty={dirty.has('secondary')} value={snapshot.tokens.secondary} onChange={(value) => onColorChange('secondary', value)} />
        </div>
        <div className={`contrast-note ${snapshot.contrastWarning ? 'warning' : ''}`}>
          <span className="contrast-icon">◐</span>
          <span>对比度 <strong>{snapshot.contrastRatio.toFixed(1)}:1</strong> · {snapshot.contrastWarning ? '建议提高对比度' : '适合界面使用'}</span>
        </div>
      </section>

      <ScaleControl label="圆角尺度" hint="px" field="radiusScale" dirty={dirty.has('radiusScale')} snapshot={snapshot} onChange={onScaleChange} />
      <ScaleControl label="间距体系" hint="px" field="spacingScale" dirty={dirty.has('spacingScale')} snapshot={snapshot} onChange={onScaleChange} />
      <ScaleControl label="字体比例" hint="px" field="typeScale" dirty={dirty.has('typeScale')} snapshot={snapshot} onChange={onScaleChange} />

      <div className="panel-footer"><span className="live-dot" />所有调整实时同步到预览{dirty.size > 0 ? <em className="footer-unsaved">· {dirty.size} 组未落盘</em> : null}</div>
    </aside>
  )
}

function ColorField({ label, value, dirty, onChange }: { label: string; value: string; dirty: boolean; onChange: (value: string) => void }) {
  return (
    <label className={`color-field ${dirty ? 'is-dirty' : ''}`}>
      <span>{label}{dirty && <i className="unsaved-dot" title="该改动尚未落盘" />}</span>
      <div className="color-input"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} HEX`} value={value} onChange={(event) => onChange(event.target.value)} /></div>
    </label>
  )
}

function ScaleControl({ label, hint, field, dirty, snapshot, onChange }: { label: string; hint: string; field: 'radiusScale' | 'spacingScale' | 'typeScale'; dirty: boolean; snapshot: BrandMirrorSnapshot; onChange: (field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number) => void }) {
  const values = snapshot.tokens[field]
  const persistedValues = snapshot.persistedTokens?.[field]
  return (
    <section className="control-section scale-section">
      <div className="section-label">
        <span>{label}{dirty && <i className="unsaved-badge">未保存</i>}</span>
        <span className="muted">{hint}</span>
      </div>
      <div className="scale-inputs">{values.map((value, index) => {
        const itemDirty = !persistedValues || persistedValues[index] !== value
        return <label className={itemDirty ? 'is-dirty' : ''} key={`${field}-${index}`}><span>{index + 1}{itemDirty && <i className="unsaved-dot" />}</span><input aria-label={`${label}${index + 1}`} type="number" min={field === 'typeScale' ? 10 : 0} max={field === 'typeScale' ? 72 : field === 'spacingScale' ? 64 : 40} value={value} onChange={(event) => onChange(field, index, Number(event.target.value))} /></label>
      })}</div>
    </section>
  )
}
