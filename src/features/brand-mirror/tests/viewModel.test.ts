import { describe, expect, it } from 'vitest'
import { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'
import type { BrandDocument } from '../models/brandMirrorModels'
import type { BrandRepository } from '../repositories/brandRepository'
import { buildBrandGuidelinesMarkdown, type BrandGuidelinesExporter } from '../services/exportService'

class MemoryRepository implements BrandRepository {
  document: BrandDocument | null = null
  shouldFail = false
  saveAttempts = 0
  load(): BrandDocument | null { return this.document }
  save(document: BrandDocument): void {
    this.saveAttempts += 1
    if (this.shouldFail) throw new Error('offline')
    this.document = document
  }
}

class MemoryExporter implements BrandGuidelinesExporter {
  received: string | null = null
  export(snapshot: Parameters<BrandGuidelinesExporter['export']>[0]): void { this.received = buildBrandGuidelinesMarkdown(snapshot) }
}

describe('BrandMirrorViewModel', () => {
  it('initializes, updates tokens and persists the latest state', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    viewModel.updateScale('typeScale', 0, 18)
    expect(viewModel.getSnapshot().tokens.primary).toBe('#123456')
    expect(viewModel.getSnapshot().tokens.typeScale[0]).toBe(18)
    expect(repository.document?.tokens.primary).toBe('#123456')
    expect(viewModel.getSnapshot().saveStatus).toBe('saved')
    expect(viewModel.getSnapshot().dirtyFields).toEqual([])
  })

  it('saves two versions and enters comparison mode', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.saveVersion()
    viewModel.updateColor('primary', '#238B73')
    viewModel.saveVersion()
    viewModel.toggleCompare()
    expect(viewModel.getSnapshot().versions.map((version) => version.label)).toEqual(['Version A', 'Version B'])
    expect(viewModel.getSnapshot().compareMode).toBe(true)
  })

  it('keeps editing usable when persistence fails', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.updateColor('secondary', '#FFFFFF')
    const failed = viewModel.getSnapshot()
    expect(failed.saveStatus).toBe('error')
    expect(failed.saveError).toContain('offline')
    expect(failed.tokens.secondary).toBe('#FFFFFF')
    // 失败时工作副本与已落盘副本必须可区分
    expect(failed.dirtyFields).toContain('secondary')
    expect(failed.persistedTokens?.secondary).not.toBe('#FFFFFF')
    expect(failed.pendingDocument).not.toBeNull()
  })

  it('keeps the failure visible across further edits until a retry succeeds', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.updateColor('primary', '#123456')
    expect(viewModel.getSnapshot().saveStatus).toBe('error')

    // 继续调整令牌：失败状态不能被静默清掉
    viewModel.updateColor('primary', '#238B73')
    expect(viewModel.getSnapshot().saveStatus).toBe('error')
    expect(viewModel.getSnapshot().saveError).toBeTruthy()
    // 新的失败写入内容必须是最新工作副本（重试不会落旧数据）
    expect(viewModel.getSnapshot().pendingDocument?.tokens.primary).toBe('#238B73')
    expect(repository.document).toBeNull()

    // 恢复后重试成功，才允许回到“已保存”
    repository.shouldFail = false
    viewModel.retrySave()
    const recovered = viewModel.getSnapshot()
    expect(recovered.saveStatus).toBe('saved')
    expect(recovered.saveError).toBeNull()
    expect(recovered.pendingDocument).toBeNull()
    expect(recovered.dirtyFields).toEqual([])
    expect(repository.document?.tokens.primary).toBe('#238B73')
  })

  it('does nothing when retry is invoked without a pending failure', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.retrySave()
    expect(repository.saveAttempts).toBe(0)
    expect(viewModel.getSnapshot().saveStatus).toBe('idle')
  })

  it('keeps the failed version out of the saved versions until write succeeds', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.saveVersion()
    const failed = viewModel.getSnapshot()
    expect(failed.saveStatus).toBe('error')
    expect(failed.versions).toHaveLength(1)
    expect(failed.pendingDocument?.versions).toHaveLength(1)
    repository.shouldFail = false
    viewModel.retrySave()
    expect(viewModel.getSnapshot().saveStatus).toBe('saved')
    expect(repository.document?.versions).toHaveLength(1)
  })

  it('marks token groups dirty only while they differ from the persisted copy', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    expect(viewModel.getSnapshot().dirtyFields).toEqual([])

    repository.shouldFail = true
    viewModel.updateColor('primary', '#654321')
    const failed = viewModel.getSnapshot()
    expect(failed.dirtyFields).toEqual(['primary'])
    expect(failed.persistedTokens?.primary).toBe('#123456')

    repository.shouldFail = false
    viewModel.updateColor('primary', '#ABCDEF')
    expect(viewModel.getSnapshot().dirtyFields).toEqual([])
  })

  it('recovers a previously persisted document on initialization', () => {
    const repository = new MemoryRepository()
    repository.document = { version: 1, theme: 'night', tokens: { primary: '#A98BFF', secondary: '#191829', radiusScale: [6, 10, 14, 22], spacingScale: [4, 8, 12, 18, 28], typeScale: [12, 14, 16, 20, 28, 38] }, versions: [] }
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    expect(viewModel.getSnapshot().theme).toBe('night')
    expect(viewModel.getSnapshot().message).toContain('恢复')
    expect(viewModel.getSnapshot().saveStatus).toBe('saved')
    expect(viewModel.getSnapshot().dirtyFields).toEqual([])
  })

  it('surfaces validation errors separately from write failures and does not persist', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    const attemptsBefore = repository.saveAttempts
    // 构造非法令牌（截断字号层级），校验失败时不应触碰仓储，也不应污染保存状态
    const invalid = viewModel.getSnapshot()
    ;(viewModel as unknown as { working: { tokens: typeof invalid.tokens } }).working.tokens.typeScale = [12]
    viewModel.saveVersion()
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.validationError).toContain('数量')
    expect(snapshot.saveStatus).toBe('idle')
    expect(snapshot.versions).toHaveLength(0)
    expect(repository.saveAttempts).toBe(attemptsBefore)

    // 修正后再保存，校验错误清空
    ;(viewModel as unknown as { working: { tokens: typeof invalid.tokens } }).working.tokens.typeScale = [12, 14, 16, 20, 28, 40]
    viewModel.saveVersion()
    expect(viewModel.getSnapshot().validationError).toBeNull()
    expect(viewModel.getSnapshot().versions).toHaveLength(1)
  })

  it('exports the current token system as brand guidelines', () => {
    const repository = new MemoryRepository()
    const exporter = new MemoryExporter()
    const viewModel = new BrandMirrorViewModel(repository, exporter)
    viewModel.initialize()
    viewModel.exportBrandGuidelines()
    expect(exporter.received).toContain('# BrandMirror 品牌规范')
    expect(exporter.received).toContain('`primary`')
    expect(viewModel.getSnapshot().message).toContain('导出')
  })
})
