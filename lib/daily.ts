const DAILY_API = "https://api.daily.co/v1";

export async function createDailyRoom(name: string) {
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        start_video_off: true,
        start_audio_off: true,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok)
    throw new Error(`Failed to create Daily room: ${await res.text()}`);
  return res.json() as Promise<{ name: string; url: string }>;
}

export async function createMeetingToken(opts: {
  room_name: string;
  is_owner?: boolean;
  user_name?: string;
  start_cloud_recording?: boolean; // optional auto-record
}) {
  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY!}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: {
        room_name: opts.room_name,
        is_owner: !!opts.is_owner,
        user_name: opts.user_name,
        // optional: auto-start recording when this participant joins
        start_cloud_recording: opts.start_cloud_recording ?? false,
      },
      // you can also set exp (JWT) for short TTL if you self-sign
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to mint meeting token: ${await res.text()}`);
  return res.json() as Promise<{ token: string }>;
}
