export type BrandTheme = 'studio' | 'editorial' | 'night'

/**
 * 持久化状态机，完全由真实写入结果驱动：
 * - saved: 当前工作区内容与最后一次成功写入本地的内容一致
 * - unsaved: 存在仅停留在页面、尚未成功写入的改动
 * - error: 最后一次写入失败；失败持续可见，直到一次重试真正成功
 */
export type SaveStatus = 'saved' | 'unsaved' | 'error'

export interface DirtyFlags {
  /** 基础主题与已落盘内容不一致 */
  theme: boolean
  primary: boolean
  secondary: boolean
  radiusScale: boolean
  spacingScale: boolean
  typeScale: boolean
  /** 存在尚未成功落盘的版本 */
  versions: boolean
}

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
  status: SaveStatus
  tokens: BrandTokens
  theme: BrandTheme
  versions: SavedVersion[]
  compareMode: boolean
  activeVersionId: string | null
  contrastRatio: number
  contrastWarning: boolean
  /** 各令牌组相对最后一次成功写入内容的脏标记，用于区分已落盘/仅页面改动 */
  dirty: DirtyFlags
  /** 是否存在任何仅停留在页面的改动 */
  hasUnsavedChanges: boolean
  /** 最后一次写入失败的信息；仅在 status === 'error' 时存在 */
  saveError: string | null
  /** 最后一次成功写入本地的时间（ISO），用于向用户确认落盘时刻 */
  lastSavedAt: string | null
  /** 给反馈区展示的动作提示 */
  message: string
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
