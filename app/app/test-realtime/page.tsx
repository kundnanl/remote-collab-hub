'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TestRealtimeAuth() {
    useEffect(() => {
        const channel = supabase.channel('test:presence', {
            config: { presence: { key: 'demo-user' } },
        });
        channel.subscribe((status) => console.log('[auth-test]', status));

    }, []);

    return <div>Testing Realtime Auth</div>;
}
