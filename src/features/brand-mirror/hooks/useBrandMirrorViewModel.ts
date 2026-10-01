import { useEffect, useState } from 'react'
import type { BrandMirrorSnapshot } from '../models/brandMirrorModels'
import { BrandMirrorViewModel } from '../viewmodels/brandMirrorViewModel'

type UnloadHandler = (event: unknown) => void

export function useBrandMirrorViewModel(viewModel: BrandMirrorViewModel): BrandMirrorSnapshot {
  const [snapshot, setSnapshot] = useState(viewModel.getSnapshot())
  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => setSnapshot(viewModel.getSnapshot()))
    viewModel.initialize()
    return unsubscribe
  }, [viewModel])

  useEffect(() => {
    if (!snapshot.hasUnsavedChanges && snapshot.status !== 'error') return
    const warnBeforeUnload: UnloadHandler = (event) => {
      // 关闭/刷新前仍有未落盘改动（或最后一次写入失败）时拦截，防止改动丢失
      ;(event as { preventDefault: () => void }).preventDefault()
      // 部分浏览器（Chrome/Safari）依赖 returnValue 才会真正弹出确认
      ;(event as Record<string, unknown>)['returnValue'] = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload as unknown as Parameters<typeof window.addEventListener>[1])
    return () => window.removeEventListener('beforeunload', warnBeforeUnload as unknown as Parameters<typeof window.removeEventListener>[1])
  }, [snapshot.hasUnsavedChanges, snapshot.status])

  return snapshot
}
