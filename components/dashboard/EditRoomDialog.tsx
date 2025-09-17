// components/dashboard/EditRoomDialog.tsx
'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { trpc } from '@/server/client'
import type { RoomOutput } from '@/server/client'

type RoomKind = 'HUDDLE' | 'MEETING' | 'FOCUS' | 'TEAM' | 'CUSTOM'

type Props = {
  orgId: string
  room: RoomOutput
  trigger?: React.ReactNode
}

export function EditRoomDialog({ orgId, room, trigger }: Props) {
  const utils = trpc.useUtils()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(room.name)
  const [kind, setKind] = React.useState<RoomKind>(room.kind as RoomKind)
  const [capacity, setCapacity] = React.useState<number | ''>(room.capacity ?? '')

  const update = trpc.rooms.update.useMutation({
    onSuccess: (updated) => {
      // optimistic cache update
      utils.rooms.listByOrg.setData({ orgId }, (old) =>
        old ? old.map((r) => (r.id === updated.id ? updated : r)) : [updated]
      )
      setOpen(false)
    },
  })

  const onSave = () => {
    if (!name.trim()) return
    update.mutate({
      orgId,
      roomId: room.id,
      data: {
        name: name.trim(),
        kind,
        isPersistent: true,
        capacity: capacity === '' ? null : Number(capacity),
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Edit</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>Update room details for your organization.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="Team Huddle"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Room Type</label>
            <Select value={kind} onValueChange={(v: RoomKind) => setKind(v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HUDDLE">Huddle</SelectItem>
                <SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="FOCUS">Focus</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Capacity (optional)</label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={capacity}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') setCapacity('')
                else if (/^\d+$/.test(v)) setCapacity(Number(v))
              }}
              placeholder="e.g., 8"
            />
            {typeof capacity === 'number' && capacity < 1 && (
              <p className="text-xs text-red-600">Capacity must be at least 1.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={update.isPending || !name.trim()}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
