import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchShareStatus } from '@/api/client'

type ShareStatus = 'loading' | 'active' | 'inactive' | 'error'

export function useShareStatus(kind: 'roster' | 'build' | 'team' | 'teams', id: string | undefined) {
  const [state, setState] = useState<{ id: string | undefined; status: ShareStatus }>({ id, status: 'loading' })
  const revision = useRef(0)
  const currentId = useRef(id)

  useEffect(() => {
    currentId.current = id
  }, [id])

  const refresh = useCallback(() => {
    if (!id) return
    const current = ++revision.current
    setState({ id, status: 'loading' })
    void fetchShareStatus(kind, id).then(
      ({ active }) => {
        if (revision.current === current) setState({ id, status: active ? 'active' : 'inactive' })
      },
      () => {
        if (revision.current === current) setState({ id, status: 'error' })
      },
    )
  }, [id, kind])

  useEffect(() => {
    let cancelled = false
    const current = ++revision.current

    if (!id) return

    void fetchShareStatus(kind, id).then(
      ({ active }) => {
        if (!cancelled && revision.current === current) {
          setState({ id, status: active ? 'active' : 'inactive' })
        }
      },
      () => {
        if (!cancelled && revision.current === current) {
          setState({ id, status: 'error' })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [id, kind])

  const setActive = useCallback((active: boolean) => {
    if (currentId.current !== id) return
    revision.current++
    setState({ id, status: active ? 'active' : 'inactive' })
  }, [id])

  return { status: state.id === id ? state.status : 'loading', refresh, setActive }
}
