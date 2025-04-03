'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/server/client'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function NewDocumentPage() {
  const [title, setTitle] = useState('')
  const router = useRouter()

  const mutation = trpc.docs.createDocument.useMutation({
    onSuccess: ({ document }) => {
      router.push(`/dashboard/docs/${document.id}`)
    },
  }) satisfies ReturnType<typeof trpc.docs.createDocument.useMutation>
  
  const handleCreate = () => {
    if (!title.trim()) return
    mutation.mutate({ title })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto py-20 px-6 space-y-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Create a New Document</h1>
        <p className="text-muted-foreground text-sm">
          Give your document a title to get started.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Input
          placeholder="e.g. Quarterly Roadmap"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
        <Button
          onClick={handleCreate}
          disabled={mutation.isPending || !title.trim()}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Create
        </Button>
      </div>

      {mutation.error && (
        <p className="text-sm text-red-500 text-center">
          {mutation.error.message}
        </p>
      )}
    </motion.div>
  )
}
