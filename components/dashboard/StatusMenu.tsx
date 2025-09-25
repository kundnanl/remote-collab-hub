'use client'
import { usePresence } from '@/components/presence/PresenceProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Status = 'online' | 'away' | 'dnd'

export function StatusMenu() {
  const { me, setStatus } = usePresence()

  return (
    <Select defaultValue={me.status} onValueChange={(v: Status) => setStatus(v)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Set status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="online">Online</SelectItem>
        <SelectItem value="away">Away</SelectItem>
        <SelectItem value="dnd">Do Not Disturb</SelectItem>
      </SelectContent>
    </Select>
  )
}
