import { clampTokenValues, cloneTokens, contrastRatio, normalizeColor, themeTokens, validateTokens } from '../domain/brandRules'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { diffTokenFields, INITIAL_TOKENS, type BrandDocument, type BrandMirrorSnapshot, type BrandTheme, type SavedVersion, type SaveStatus, type BrandTokens } from '../models/brandMirrorModels'

type Listener = () => void
type DocumentCore = { tokens: BrandTokens; theme: BrandTheme; versions: SavedVersion[] }

export class BrandMirrorViewModel {
  /** 页面上的工作副本：用户的每一次调整都立刻反映在这里 */
  private working: DocumentCore = { tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio', versions: [] }
  /** 最近一次确认真实落盘的副本；null 表示从未成功写入过 */
  private persisted: DocumentCore | null = null
  private persistedAt: string | null = null

  private saveStatus: SaveStatus = 'idle'
  private saveError: string | null = null
  /** 最近一次写入失败、等待重试的完整文档 */
  private pendingDocument: BrandDocument | null = null

  private message = ''
  private validationError: string | null = null
  private compareMode = false

  private readonly listeners = new Set<Listener>()
  private readonly repository: BrandRepository
  private readonly exporter?: BrandGuidelinesExporter

  constructor(repository: BrandRepository, exporter?: BrandGuidelinesExporter) {
    this.repository = repository
    this.exporter = exporter
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): BrandMirrorSnapshot {
    const ratio = contrastRatio(this.working.tokens.primary, this.working.tokens.secondary)
    const latestVersion = this.working.versions[this.working.versions.length - 1]
    return {
      tokens: cloneTokens(this.working.tokens),
      theme: this.working.theme,
      versions: this.working.versions,
      compareMode: this.compareMode,
      activeVersionId: latestVersion?.id ?? null,
      contrastRatio: ratio,
      contrastWarning: ratio < 3,
      saveStatus: this.saveStatus,
      saveError: this.saveError,
      dirtyFields: diffTokenFields(this.working.tokens, this.persisted?.tokens ?? null),
      persistedTokens: this.persisted ? cloneTokens(this.persisted.tokens) : null,
      persistedAt: this.persistedAt,
      pendingDocument: this.pendingDocument ? cloneDocument(this.pendingDocument) : null,
      message: this.message,
      validationError: this.validationError,
    }
  }

  initialize(): void {
    const stored = this.repository.load()
    if (stored) {
      this.working = stripVersion(stored)
      this.persisted = stripVersion(stored)
      this.persistedAt = new Date().toISOString()
      this.saveStatus = 'saved'
      this.message = '已恢复最近一次工作状态'
    } else {
      this.working = { tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio', versions: [] }
      this.persisted = null
      this.persistedAt = null
      this.saveStatus = 'idle'
      this.message = '从 Studio warm 开始探索'
    }
    this.saveError = null
    this.pendingDocument = null
    this.validationError = null
    this.compareMode = false
    this.emit()
  }

  selectTheme(theme: BrandTheme): void {
    this.edit({ tokens: themeTokens(theme), theme }, '已切换基础主题')
  }

  updateColor(field: 'primary' | 'secondary', value: string): void {
    const color = normalizeColor(value)
    this.edit({ tokens: { ...this.working.tokens, [field]: color } }, '令牌已更新')
  }

  updateScale(field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number): void {
    const values = [...this.working.tokens[field]]
    values[index] = Number.isFinite(value) ? value : values[index]
    this.edit({ tokens: clampTokenValues({ ...this.working.tokens, [field]: values }) }, '令牌已更新')
  }

  reset(): void {
    this.edit({ tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio' }, '已恢复默认令牌')
  }

  saveVersion(): void {
    const validationError = validateTokens(this.working.tokens)
    if (validationError) {
      this.validationError = validationError
      this.emit()
      return
    }
    this.validationError = null
    const nextVersion: SavedVersion = {
      id: `version-${Date.now()}`,
      label: this.working.versions.length === 0 ? 'Version A' : `Version ${String.fromCharCode(65 + this.working.versions.length)}`,
      tokens: cloneTokens(this.working.tokens),
      createdAt: new Date().toISOString(),
    }
    this.working = { ...this.working, versions: [...this.working.versions, nextVersion] }
    this.attemptPersist('版本已保存')
  }

  /** 用户在顶栏显式重试上一次失败的写入；成功后才能恢复“已保存”表示 */
  retrySave(): void {
    if (this.saveStatus !== 'error' || !this.pendingDocument) return
    this.attemptPersistDocument(this.pendingDocument, '重试成功，改动已写入本地')
  }

  toggleCompare(): void {
    this.compareMode = !this.compareMode
    this.message = this.compareMode ? '正在对比最近两个版本' : '已退出对比模式'
    this.emit()
  }

  exportBrandGuidelines(): void {
    if (!this.exporter) return
    try {
      this.exporter.export(this.getSnapshot())
      this.message = '品牌规范已导出（基于当前页面内容，未保存的改动也包含在内）'
    } catch {
      this.message = '导出失败，请稍后重试'
    }
    this.emit()
  }

  private edit(partial: Partial<Pick<typeof this.working, 'tokens' | 'theme'>>, message: string): void {
    this.working = {
      tokens: partial.tokens ?? this.working.tokens,
      theme: partial.theme ?? this.working.theme,
      versions: this.working.versions,
    }
    this.message = message
    this.validationError = null
    this.attemptPersist(message)
  }

  /**
   * 自动持久化：状态完全以本次真实写入结果为准。
   * 成功 -> saved 并更新已落盘副本；失败 -> error 且持续保留，不会被后续编辑清掉。
   */
  private attemptPersist(successMessage: string): void {
    const { tokens, theme, versions } = stripVersion(this.working)
    this.attemptPersistDocument({ version: 1, tokens, theme, versions }, successMessage)
  }

  private attemptPersistDocument(document: BrandDocument, successMessage: string): void {
    this.saveStatus = 'saving'
    this.emit()

    try {
      this.repository.save(document)
    } catch (error) {
      // 失败持续可见：保留待写入文档，供重试；错误状态不被任何其它操作覆盖
      this.pendingDocument = { version: 1, tokens: cloneTokens(document.tokens), theme: document.theme, versions: document.versions }
      this.saveStatus = 'error'
      this.saveError = error instanceof Error && error.message ? error.message : '写入本地时发生未知错误'
      this.message = '本地保存失败，改动仍保留在页面中，请重试'
      this.emit()
      return
    }

    this.pendingDocument = null
    this.saveError = null
    this.persisted = stripVersion(document)
    this.persistedAt = new Date().toISOString()
    this.saveStatus = 'saved'
    this.message = successMessage
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}

function stripVersion(document: DocumentCore | BrandDocument): DocumentCore {
  return { tokens: cloneTokens(document.tokens), theme: document.theme, versions: document.versions }
}

function cloneDocument(document: BrandDocument): BrandDocument {
  return { version: 1, ...stripVersion(document) }
}
