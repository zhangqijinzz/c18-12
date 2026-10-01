import { clampTokenValues, cloneTokens, contrastRatio, diffDirty, hasDirtyFlags, normalizeColor, themeTokens, validateTokens } from '../domain/brandRules'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { INITIAL_TOKENS, type BrandDocument, type BrandMirrorSnapshot, type BrandTheme, type DirtyFlags, type SavedVersion } from '../models/brandMirrorModels'

type Listener = () => void

const SAVE_FAILURE_MESSAGE = '本地写入失败，改动仅保留在页面中，尚未落盘'

export class BrandMirrorViewModel {
  /** 页面上的工作区内容（可能领先于已落盘内容） */
  private working: Omit<BrandDocument, 'version'> = { tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio', versions: [] }
  /** 最后一次确认写入成功的内容基线 */
  private persisted: Omit<BrandDocument, 'version'> = { tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio', versions: [] }
  /** 粘性写入失败：只有一次重试真正写入成功后才会清除 */
  private saveError: string | null = null
  /** 是否曾经确认写入成功（或从本地恢复过文档）；此前不得声称“已保存” */
  private everPersisted = false
  private lastSavedAt: string | null = null
  private message = ''
  private compareMode = false
  private snapshot: BrandMirrorSnapshot = this.buildSnapshot()
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
    return this.snapshot
  }

  initialize(): void {
    const stored = this.repository.load()
    if (stored) {
      const restored = { tokens: clampTokenValues(stored.tokens), theme: stored.theme, versions: stored.versions }
      this.working = cloneDocument(restored)
      this.persisted = cloneDocument(restored)
      this.saveError = null
      this.everPersisted = true
      this.lastSavedAt = null
      this.message = '已恢复最近一次工作状态'
    } else {
      this.working = { tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio', versions: [] }
      this.persisted = cloneDocument(this.working)
      this.message = '从 Studio warm 开始探索'
    }
    this.refresh()
  }

  selectTheme(theme: BrandTheme): void {
    this.working = { ...this.working, tokens: themeTokens(theme), theme }
    this.message = '令牌已更新'
    this.attemptWrite()
  }

  updateColor(field: 'primary' | 'secondary', value: string): void {
    const color = normalizeColor(value)
    this.working = { ...this.working, tokens: { ...this.working.tokens, [field]: color } }
    this.message = '令牌已更新'
    this.attemptWrite()
  }

  updateScale(field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number): void {
    const values = [...this.working.tokens[field]]
    values[index] = Number.isFinite(value) ? value : values[index]
    this.working = { ...this.working, tokens: clampTokenValues({ ...this.working.tokens, [field]: values }) }
    this.message = '令牌已更新'
    this.attemptWrite()
  }

  reset(): void {
    this.working = { ...this.working, tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio' }
    this.message = '已恢复默认令牌'
    this.attemptWrite()
  }

  saveVersion(): void {
    const validationError = validateTokens(this.working.tokens)
    if (validationError) {
      // 校验未通过不是写入失败：不改动持久化状态，只提示用户
      this.message = validationError
      this.refresh()
      return
    }
    // 标签以已落盘版本数为准：失败重试不会产生重名版本
    const versionOrdinal = this.persisted.versions.length
    const nextVersion: SavedVersion = {
      id: `version-${Date.now()}`,
      label: versionOrdinal === 0 ? 'Version A' : `Version ${String.fromCharCode(65 + versionOrdinal)}`,
      tokens: cloneTokens(this.working.tokens),
      createdAt: new Date().toISOString(),
    }
    this.working = { ...this.working, versions: [...this.working.versions, nextVersion] }
    this.message = ''
    this.attemptWrite('版本已保存')
  }

  /** 用户显式重试：把当前页面内容再次尝试写入本地，成功后才恢复“已保存”表示 */
  retrySave(): void {
    if (!this.saveError) return
    this.attemptWrite('重试成功，改动已写入本地')
  }

  toggleCompare(): void {
    this.compareMode = !this.compareMode
    this.message = this.compareMode ? '正在对比最近两个版本' : '已退出对比模式'
    this.refresh()
  }

  exportBrandGuidelines(): void {
    if (!this.exporter) return
    try {
      this.exporter.export(this.snapshot)
      this.message = '品牌规范已导出'
    } catch {
      this.message = '导出失败，请稍后重试'
    }
    this.refresh()
  }

  /**
   * 唯一的写入出口：根据真实写入结果推进状态。
   * 成功 → 更新落盘基线、清除失败；失败 → 保留页面改动并让失败持续可见。
   * 编辑过程中也会自动再试一次，但失败绝不会被新的编辑动作静默掩盖。
   */
  private attemptWrite(successMessage?: string): void {
    try {
      this.repository.save(toDocument(this.working))
      this.persisted = cloneDocument(this.working)
      this.saveError = null
      this.everPersisted = true
      this.lastSavedAt = new Date().toISOString()
      if (successMessage) this.message = successMessage
    } catch (error) {
      this.saveError = error instanceof Error && error.message ? error.message : SAVE_FAILURE_MESSAGE
    }
    this.refresh()
  }

  private computeDirty(): DirtyFlags {
    const tokens = diffDirty(this.working, this.persisted)
    const persistedIds = this.persisted.versions.map((version) => version.id)
    const workingIds = this.working.versions.map((version) => version.id)
    const versions = workingIds.length !== persistedIds.length || workingIds.some((id, index) => id !== persistedIds[index])
    return { ...tokens, versions }
  }

  private buildSnapshot(): BrandMirrorSnapshot {
    const dirty = this.computeDirty()
    const hasUnsavedChanges = hasDirtyFlags(dirty)
    const status: BrandMirrorSnapshot['status'] = this.saveError ? 'error' : !this.everPersisted || hasUnsavedChanges ? 'unsaved' : 'saved'
    const tokens = cloneTokens(this.working.tokens)
    const latestVersion = this.working.versions[this.working.versions.length - 1]
    const ratio = contrastRatio(tokens.primary, tokens.secondary)
    return {
      status,
      tokens,
      theme: this.working.theme,
      versions: [...this.working.versions],
      compareMode: this.compareMode,
      activeVersionId: latestVersion?.id ?? null,
      contrastRatio: ratio,
      contrastWarning: ratio < 3,
      dirty,
      hasUnsavedChanges,
      saveError: this.saveError,
      lastSavedAt: this.lastSavedAt,
      message: this.saveError ? SAVE_FAILURE_MESSAGE : this.message,
    }
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot()
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}

function cloneDocument(document: Omit<BrandDocument, 'version'>): Omit<BrandDocument, 'version'> {
  return { tokens: cloneTokens(document.tokens), theme: document.theme, versions: document.versions.map((version) => ({ ...version, tokens: cloneTokens(version.tokens) })) }
}

function toDocument(document: Omit<BrandDocument, 'version'>): BrandDocument {
  return { version: 1, ...cloneDocument(document) }
}
