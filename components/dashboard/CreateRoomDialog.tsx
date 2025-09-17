'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/server/client'

type Props = {
  orgId: string
}

type RoomKind = 'HUDDLE' | 'MEETING' | 'FOCUS' | 'TEAM' | 'CUSTOM'

export function CreateRoomDialog({ orgId }: Props) {
  const utils = trpc.useUtils()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [kind, setKind] = React.useState<RoomKind>('HUDDLE')

  const createRoom = trpc.rooms.create.useMutation({
    onSuccess: (newRoom) => {
      utils.rooms.listByOrg.setData({ orgId }, (old) =>
        old ? [...old, newRoom] : [newRoom]
      )
      setOpen(false)
      setName('')
      setKind('HUDDLE')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Room</DialogTitle>
          <DialogDescription>
            Add a new room to your organization’s virtual office.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Room Name</label>
            <Input
              placeholder="Enter a name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Room Type</label>
            <Select value={kind} onValueChange={(val: RoomKind) => setKind(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HUDDLE">Huddle</SelectItem>
                <SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="FOCUS">Focus</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() =>
              createRoom.mutate({
                orgId,
                data: { name, kind, isPersistent: true },
              })
            }
            disabled={createRoom.isPending || !name}
          >
            {createRoom.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
