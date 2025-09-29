"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { YKeyValue } from "y-utility/y-keyvalue";
import * as Y from "yjs";
import {
  computed,
  createPresenceStateDerivation,
  createTLStore,
  transact,
  react as tlreact, // alias to avoid confusion with React
  defaultShapeUtils,
  InstancePresenceRecordType,
  TLAnyShapeUtilConstructor,
  TLInstancePresence,
  TLRecord,
  TLStoreWithStatus,
} from "tldraw";
import type { JsonObject } from "@liveblocks/client";

type UserInfo = {
  id: string;
  color: string;
  name: string;
};

export function useYjsStore({
  shapeUtils = [],
  user,
}: Partial<{
  shapeUtils: TLAnyShapeUtilConstructor[];
  user: UserInfo | undefined;
}>) {
  const room = useRoom();

  // Stable Yjs handles for this room
  const { yDoc, yStore, yProvider } = useMemo(() => {
    const yProvider = getYjsProviderForRoom(room);
    const yDoc = yProvider.getYDoc();
    yDoc.gc = true;
    const yArr = yDoc.getArray<{ key: string; val: TLRecord }>("tl_records");
    const yStore = new YKeyValue(yArr);
    return { yDoc, yStore, yProvider };
  }, [room]);

  // TL store is created once
  const [store] = useState(() =>
    createTLStore({ shapeUtils: [...defaultShapeUtils, ...shapeUtils] })
  );

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  // Keep a ref for unsubscribers so we can always clean them precisely
  const unsubsRef = useRef<(() => void)[]>([]);
  const cleanupSubs = () => {
    unsubsRef.current.forEach((fn) => {
      try {
        fn();
      } catch { }
    });
    unsubsRef.current = [];
  };

  useEffect(() => {
    setStoreWithStatus((prev) =>
      prev.status === "synced-remote" ? prev : { status: "loading" }
    );

    cleanupSubs();

    function handleSync() {
      // --- sync doc --------------------------------------------------------
      if (yStore.yarray.length) {
        transact(() => {
          store.clear();
          const records = yStore.yarray.toJSON().map(({ val }) => val);
          store.put(records);
        });
      } else {
        yDoc.transact(() => {
          for (const record of store.allRecords()) {
            yStore.set(record.id, record);
          }
        });
      }

      // TL -> Yjs
      const offTLListen = store.listen(
        ({ changes }) => {
          yDoc.transact(() => {
            Object.values(changes.added).forEach((r) => yStore.set(r.id, r));
            Object.values(changes.updated).forEach(([, r]) => yStore.set(r.id, r));
            Object.values(changes.removed).forEach((r) => yStore.delete(r.id));
          });
        },
        { source: "user", scope: "document" }
      );
      unsubsRef.current.push(offTLListen);

      // Yjs -> TL
      const handleChange = (
        changes: Map<string, { action: "add" | "update" | "delete" }>,
        tx: Y.Transaction) => {
        if (tx.local) return;
        const toPut: TLRecord[] = [];
        const toRemove: TLRecord["id"][] = [];

        changes.forEach((change, id) => {
          if (change.action === "delete") {
            toRemove.push(id as TLRecord["id"]);
          } else {
            const rec = yStore.get(id);
            if (rec) toPut.push(rec);
          }
        });

        store.mergeRemoteChanges(() => {
          if (toRemove.length) store.remove(toRemove);
          if (toPut.length) store.put(toPut);
        });
      };
      yStore.on("change", handleChange);
      unsubsRef.current.push(() => yStore.off("change", handleChange));

      // --- presence --------------------------------------------------------
      if (user) {
        const userPreferences = computed("userPreferences", () => ({
          id: user.id,
          color: user.color,
          name: user.name,
        }));

        const self = room.getSelf();
        const rawClientId = self?.presence?.__yjs_clientid;
        const yClientIdStr =
          typeof rawClientId === "string"
            ? rawClientId
            : rawClientId == null
              ? undefined
              : String(rawClientId);
        const presenceId = InstancePresenceRecordType.createId(yClientIdStr);

        const presenceDerivation = createPresenceStateDerivation(
          userPreferences,
          presenceId
        )(store);

        // Initial presence
        {
          const presence = presenceDerivation.get() ?? null;
          const presenceJson = presence
            ? (JSON.parse(JSON.stringify(presence)) as JsonObject)
            : null;
          yProvider.awareness.setLocalStateField("presence", presenceJson);
        }
        // Keep presence in sync without thrashing React state
        const disposePresenceReact = tlreact("presence-sync", () => {
          const presence = presenceDerivation.get() ?? null;
          requestAnimationFrame(() => {
            const presenceJson = presence
              ? (JSON.parse(JSON.stringify(presence)) as JsonObject)
              : null;
            yProvider.awareness.setLocalStateField("presence", presenceJson);
          });
        });
        unsubsRef.current.push(disposePresenceReact);

        // Remote presence -> TL
        const handleUpdate = (update: { added: number[]; updated: number[]; removed: number[] }) => {
          const states = yProvider.awareness.getStates() as Map<
            number,
            { presence: TLInstancePresence }
          >;
          const toRemove: TLInstancePresence["id"][] = [];
          const toPut: TLInstancePresence[] = [];

          for (const id of update.added.concat(update.updated)) {
            const state = states.get(id);
            if (state?.presence && state.presence.id !== presenceId) toPut.push(state.presence);
          }
          for (const id of update.removed) {
            toRemove.push(InstancePresenceRecordType.createId(id.toString()));
          }

          store.mergeRemoteChanges(() => {
            if (toRemove.length) store.remove(toRemove);
            if (toPut.length) store.put(toPut);
          });
        };

        yProvider.awareness.on("change", handleUpdate);
        unsubsRef.current.push(() => yProvider.awareness.off("change", handleUpdate));
      }

      setStoreWithStatus({
        store,
        status: "synced-remote",
        connectionStatus: "online",
      });
    }

    if (yProvider.synced) handleSync();
    else {
      const onSynced = () => handleSync();
      yProvider.on("synced", onSynced);
      unsubsRef.current.push(() => yProvider.off("synced", onSynced));
    }

    return () => {
      cleanupSubs();
    };
  }, [yProvider, yDoc, yStore, room, store, user?.id, user?.color, user?.name]);

  return storeWithStatus;
}
