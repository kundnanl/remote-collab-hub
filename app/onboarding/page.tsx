'use client'

import { useUser, useOrganizationList } from '@clerk/nextjs'
import { useState } from 'react'
import { trpc } from '@/server/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { Loader2, Building2, Plus } from 'lucide-react'
import FullPageLoader from '@/components/FullPageLoader'
import { TRPCClientError } from '@trpc/client'

export default function OnboardingPage() {
  const { user } = useUser()
  const {
    userInvitations,
    setActive,
    isLoaded,
  } = useOrganizationList({ userInvitations: true, setActive: true })

  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [showLoader, setShowLoader] = useState(false)
  const [showCreateOrg, setShowCreateOrg] = useState(false)

  const mutation = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => {
      setShowLoader(true)
      user?.reload().then(() => (window.location.href = '/dashboard'))
    },
    onError: (err) => setError(err.message),
  })

  const joinMutation = trpc.user.joinOrganization.useMutation({
    onSuccess: () => {
      user?.reload().then(() => (window.location.href = '/dashboard'))
    },
    onError: (err) => {
      setError(err.message)
      setShowLoader(false)
    },
  })


  const handleJoinInvite = async (orgId: string, invitationId: string) => {
    if (!orgId) return
    setShowLoader(true)
  
    try {
      if (!orgId || !setActive) return

      await joinMutation.mutateAsync({ orgId, invitationId })
      await setActive({ organization: orgId })
    } catch (err) {
      console.log('[Join Invite Error]', err)
      if (err instanceof TRPCClientError) {
        console.error('TRPC Error message:', err.message)
        console.error('TRPC Error shape:', err.shape)
      }
      setShowLoader(false)
    }
  }
  
  const handleCreateOrg = () => {
    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    setError('')
    mutation.mutate({ orgName })
  }

  const hasInvites = isLoaded && userInvitations.data.length > 0

  if (showLoader) return <FullPageLoader />

  return (
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10"
      >
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Welcome, {user?.firstName ?? 'there'} 👋
          </h1>
          <p className="text-gray-600 text-lg">
            {hasInvites
              ? 'You’ve been invited to join a team — select one or create your own.'
              : 'Kickstart your team journey by creating your first organization.'}
          </p>

          {hasInvites && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-500 uppercase">
                Pending Invitations
              </p>

              <motion.div
                layout
                className="space-y-3"
              >
                {userInvitations.data.map((invite) => (
                  <motion.div
                    key={invite.id}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Card className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 bg-gray-100">
                            <AvatarFallback>
                              {invite.publicOrganizationData.name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-800">
                              {invite.publicOrganizationData.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              Role: {invite.role.replace('org:', '')}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleJoinInvite(invite.publicOrganizationData.id, invite.id)}>
                          Join
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}

                {!showCreateOrg && (
                  <Button
                    variant="ghost"
                    className="text-sm text-gray-700"
                    onClick={() => setShowCreateOrg(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Or create a new organization
                  </Button>
                )}
              </motion.div>
            </div>
          )}
        </div>

        {(!hasInvites || showCreateOrg) && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <Card className="bg-white border border-gray-200 shadow-lg rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="text-indigo-600 w-5 h-5" />
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Create Your Organization
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="e.g. Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={mutation.isPending}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  className="w-full"
                  onClick={handleCreateOrg}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}
