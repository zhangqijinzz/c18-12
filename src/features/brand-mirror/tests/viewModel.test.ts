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
  save(document: BrandDocument): void { this.saveAttempts += 1; if (this.shouldFail) throw new Error('offline'); this.document = document }
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
  })

  it('only shows saved after a real successful write, and tracks dirty groups', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    // 全新工作区从未写入过，不能声称“已保存”
    expect(viewModel.getSnapshot().status).toBe('unsaved')

    viewModel.updateColor('primary', '#123456')
    const afterSave = viewModel.getSnapshot()
    expect(afterSave.status).toBe('saved')
    expect(afterSave.lastSavedAt).not.toBeNull()
    expect(afterSave.hasUnsavedChanges).toBe(false)
    expect(afterSave.dirty.primary).toBe(false)
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

  it('keeps the write failure sticky across further edits and only clears it after a successful retry', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    viewModel.updateColor('primary', '#123456')
    expect(viewModel.getSnapshot().status).toBe('saved')

    // 本地写入失败
    repository.shouldFail = true
    viewModel.updateColor('secondary', '#FFFFFF')
    let snapshot = viewModel.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.saveError).toBe('offline')
    expect(snapshot.tokens.secondary).toBe('#FFFFFF')
    expect(repository.document?.tokens.secondary).not.toBe('#FFFFFF')
    expect(snapshot.dirty.secondary).toBe(true)

    // 用户继续调整令牌：失败必须持续可见，不能被新编辑静默吞掉
    viewModel.updateColor('primary', '#ABCDEF')
    snapshot = viewModel.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.saveError).toBe('offline')
    expect(snapshot.dirty.primary).toBe(true)
    expect(snapshot.dirty.secondary).toBe(true)
    expect(snapshot.message).toContain('尚未落盘')

    // 存储仍然失败时点击重试，依旧保持错误态
    viewModel.retrySave()
    expect(viewModel.getSnapshot().status).toBe('error')
    expect(repository.document?.tokens.primary).not.toBe('#ABCDEF')

    // 存储恢复后重试成功，才能恢复“已保存”的表示
    repository.shouldFail = false
    viewModel.retrySave()
    snapshot = viewModel.getSnapshot()
    expect(snapshot.status).toBe('saved')
    expect(snapshot.saveError).toBeNull()
    expect(snapshot.hasUnsavedChanges).toBe(false)
    expect(snapshot.dirty.primary).toBe(false)
    expect(snapshot.dirty.secondary).toBe(false)
    expect(snapshot.message).toContain('已写入本地')
    expect(repository.document?.tokens.primary).toBe('#ABCDEF')
    expect(repository.document?.tokens.secondary).toBe('#FFFFFF')
  })

  it('keeps editing usable when persistence fails', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.updateColor('secondary', '#FFFFFF')
    expect(viewModel.getSnapshot().status).toBe('error')
    expect(viewModel.getSnapshot().tokens.secondary).toBe('#FFFFFF')
  })

  it('keeps an unsaved version on the page until the write succeeds', () => {
    const repository = new MemoryRepository()
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    repository.shouldFail = true
    viewModel.saveVersion()
    expect(viewModel.getSnapshot().versions).toHaveLength(1)
    expect(viewModel.getSnapshot().status).toBe('error')
    expect(repository.document?.versions ?? []).toHaveLength(0)

    repository.shouldFail = false
    viewModel.retrySave()
    const snapshot = viewModel.getSnapshot()
    expect(snapshot.status).toBe('saved')
    expect(snapshot.versions).toHaveLength(1)
    expect(snapshot.versions[0].label).toBe('Version A')
    expect(snapshot.dirty.versions).toBe(false)
    expect(repository.document?.versions).toHaveLength(1)
  })

  it('recovers a previously persisted document on initialization', () => {
    const repository = new MemoryRepository()
    repository.document = { version: 1, theme: 'night', tokens: { primary: '#A98BFF', secondary: '#191829', radiusScale: [6, 10, 14, 22], spacingScale: [4, 8, 12, 18, 28], typeScale: [12, 14, 16, 20, 28, 38] }, versions: [] }
    const viewModel = new BrandMirrorViewModel(repository)
    viewModel.initialize()
    expect(viewModel.getSnapshot().theme).toBe('night')
    expect(viewModel.getSnapshot().status).toBe('saved')
    expect(viewModel.getSnapshot().message).toContain('恢复')
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
