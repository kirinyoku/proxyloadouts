import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchShareStatus } from '@/api/client'

type ShareStatus = 'loading' | 'active' | 'inactive' | 'error'

export function useShareStatus(kind: 'roster' | 'build', id: string | undefined) {
  const [state, setState] = useState<{ id: string | undefined; status: ShareStatus }>({ id, status: 'loading' })
  const revision = useRef(0)
  const currentId = useRef(id)
  currentId.current = id

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
    refresh()
    return () => { revision.current++ }
  }, [refresh])

  const setActive = useCallback((active: boolean) => {
    if (currentId.current !== id) return
    revision.current++
    setState({ id, status: active ? 'active' : 'inactive' })
  }, [id])

  return { status: state.id === id ? state.status : 'loading', refresh, setActive }
}
