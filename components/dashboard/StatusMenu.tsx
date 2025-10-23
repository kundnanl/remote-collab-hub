'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrgPresence } from '@/components/presence/PresenceProvider';
import * as React from 'react';

export function StatusMenu() {
  const { me, setStatus } = useOrgPresence();
  const value = me?.status ?? 'online';

  return (
    <Select
      defaultValue={value}
      value={value}
      onValueChange={(v: 'online' | 'away' | 'dnd') => {
        void setStatus(v);
      }}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Set status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="online">Online</SelectItem>
        <SelectItem value="away">Away</SelectItem>
        <SelectItem value="dnd">Do Not Disturb</SelectItem>
      </SelectContent>
    </Select>
  );
}
