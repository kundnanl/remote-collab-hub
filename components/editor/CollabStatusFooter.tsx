'use client'

import React from "react"

interface CollabStatusFooterProps {
  userName: string
  userColor: string
  usersOnline: number
  status: 'connected' | 'disconnected'
  onChangeName: () => void
  room?: string
}

export const CollabStatusFooter: React.FC<CollabStatusFooterProps> = ({
  userName,
  userColor,
  usersOnline,
  status,
  onChangeName,
  room,
}) => {
  return (
    <div
      className="collab-status-group"
      data-state={status === 'connected' ? 'online' : 'offline'}
    >
      <label>
        {status === 'connected'
          ? `${usersOnline} user${usersOnline === 1 ? '' : 's'} online${room ? ` in ${room}` : ''}`
          : 'offline'}
      </label>

      <button
        onClick={onChangeName}
        style={{ '--color': userColor } as React.CSSProperties}
      >
        ✎ {userName}
      </button>
    </div>
  )
}
