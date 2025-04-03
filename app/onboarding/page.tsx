'use client'

import { useUser } from '@clerk/nextjs'
import { useState } from 'react'
import { trpc } from '@/server/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Loader2, Building2 } from 'lucide-react'
import FullPageLoader from '@/components/FullPageLoader'

export default function OnboardingPage() {
  const { user } = useUser()
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [showLoader, setShowLoader] = useState(false)

  const mutation = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => {
      setShowLoader(true)
      user?.reload().then(() => (window.location.href = '/dashboard'))
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleSubmit = () => {
    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }

    setError('')
    mutation.mutate({ orgName })
  }

  return (
    <>
      {showLoader && <FullPageLoader />}

      <section className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Card className="shadow-2xl border border-gray-200 bg-white/80 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="text-indigo-600 w-5 h-5" />
                <CardTitle className="text-lg md:text-xl font-semibold">
                  Start your workspace
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Create your organization to unlock team collaboration.
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="org-name">
                  Organization Name
                </label>
                <Input
                  id="org-name"
                  placeholder="e.g. Acme Inc." 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={mutation.isPending}
                /> 
              </div>

              {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </>
  )
}
