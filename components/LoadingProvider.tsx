'use client'

import { createContext, useContext, useState } from 'react'
import FullPageLoader from './FullPageLoader'

const LoadingContext = createContext<{
  isLoading: boolean
  setLoading: (val: boolean) => void
}>({
  isLoading: false,
  setLoading: () => {},
})

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading: setIsLoading }}>
      {isLoading && <FullPageLoader />}
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => useContext(LoadingContext)
