'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LinkModal({
  isOpen,
  onClose,
  onSubmit,
  defaultUrl = '',
  defaultText = '',
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string, text?: string) => void
  defaultUrl?: string
  defaultText?: string
}) {
  const [url, setUrl] = useState(defaultUrl)
  const [text, setText] = useState(defaultText)

  const handleSubmit = () => {
    if (!url) return
    onSubmit(url, text)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Display Text (optional)"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
          <Button onClick={handleSubmit}>Add Link</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
