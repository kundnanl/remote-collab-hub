'use client'
import { usePresence } from '@/components/presence/PresenceProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function StatusMenu() {
  const { me, setStatus } = usePresence()

  return (
    <Select 
      defaultValue={me.status} 
      onValueChange={(v) => setStatus(v as Parameters<typeof setStatus>[0])}
    >
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