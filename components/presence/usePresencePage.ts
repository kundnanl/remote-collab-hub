'use client'
import { useEffect } from 'react'
import { useOrgPresence } from './PresenceProvider'

export function usePresencePage(page: string) {
  const { setPage } = useOrgPresence()
  useEffect(() => {
    void setPage(page)
    return () => { void setPage(null) }
  }, [page, setPage])
}
