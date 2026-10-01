export type BrandTheme = 'studio' | 'editorial' | 'night'

/**
 * saveStatus 只描述“最近一次真实写入的结果”，与用户是否正在编辑无关：
 * - idle:     还没有任何写入尝试（初始态）
 * - saving:   写入进行中
 * - saved:    最近一次写入成功，且工作副本与已落盘副本一致
 * - unsaved:  工作副本有改动，尚未得到任何一次成功写入的确认
 * - error:    最近一次写入失败；失败会持续可见，直到重试成功
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error'

export interface BrandTokens {
  primary: string
  secondary: string
  radiusScale: number[]
  spacingScale: number[]
  typeScale: number[]
}

export interface SavedVersion {
  id: string
  label: string
  tokens: BrandTokens
  createdAt: string
}

export interface BrandDocument {
  version: 1
  tokens: BrandTokens
  theme: BrandTheme
  versions: SavedVersion[]
}

export interface BrandMirrorSnapshot {
  /** 页面上正在编辑的工作副本（可能尚未落盘） */
  tokens: BrandTokens
  theme: BrandTheme
  versions: SavedVersion[]
  compareMode: boolean
  activeVersionId: string | null
  contrastRatio: number
  contrastWarning: boolean

  /** 最近一次真实写入本地的状态，是顶栏“已保存”表示的唯一依据 */
  saveStatus: SaveStatus
  /** 写入失败时持续保留的错误说明；成功后清空 */
  saveError: string | null
  /** 工作副本与已落盘副本之间存在差异的令牌路径，用于区分“只停留在页面上”的改动 */
  dirtyFields: string[]
  /** 最近一次确认落盘的副本，null 表示从未成功写入过 */
  persistedTokens: BrandTokens | null
  persistedAt: string | null
  /** 可重试的待写入文档：写入失败后保留，供 retrySave 使用 */
  pendingDocument: BrandDocument | null

  /** 面向用户的操作提示（与保存状态相互独立） */
  message: string
  /** 版本保存等非自动持久化操作的校验错误 */
  validationError: string | null
}

export function describeSaveStatus(status: SaveStatus): string {
  switch (status) {
    case 'idle':
      return '尚未保存到本地'
    case 'saving':
      return '正在写入本地…'
    case 'saved':
      return '所有更改已保存'
    case 'unsaved':
      return '有改动尚未保存'
    case 'error':
      return '本地保存失败'
  }
}

/** 比较工作副本与已落盘副本，返回存在差异的字段路径 */
export function diffTokenFields(working: BrandTokens, persisted: BrandTokens | null): string[] {
  if (!persisted) {
    return ['primary', 'secondary', 'radiusScale', 'spacingScale', 'typeScale']
  }
  const fields: (keyof BrandTokens)[] = ['primary', 'secondary', 'radiusScale', 'spacingScale', 'typeScale']
  return fields.filter((field) => JSON.stringify(working[field]) !== JSON.stringify(persisted[field]))
}

export const INITIAL_TOKENS: BrandTokens = {
  primary: '#F15A47',
  secondary: '#24324A',
  radiusScale: [8, 12, 18, 28],
  spacingScale: [4, 8, 12, 20, 32],
  typeScale: [12, 14, 16, 20, 28, 40],
}

export const THEME_PRESETS: Record<BrandTheme, { label: string; tokens: BrandTokens }> = {
  studio: {
    label: 'Studio warm',
    tokens: INITIAL_TOKENS,
  },
  editorial: {
    label: 'Editorial green',
    tokens: {
      primary: '#238B73', secondary: '#173C35', radiusScale: [4, 8, 12, 18], spacingScale: [4, 8, 16, 24, 40], typeScale: [12, 14, 16, 22, 30, 44],
    },
  },
  night: {
    label: 'Night signal',
    tokens: {
      primary: '#A98BFF', secondary: '#191829', radiusScale: [6, 10, 14, 22], spacingScale: [4, 8, 12, 18, 28], typeScale: [12, 14, 16, 20, 28, 38],
    },
  },
}
