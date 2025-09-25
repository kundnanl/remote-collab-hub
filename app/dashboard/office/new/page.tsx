"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateRoom } from "@/lib/hooks/useRooms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useOrganization } from "@clerk/nextjs";


export default function CreateRoomPage() {
    const router = useRouter();
    const createRoom = useCreateRoom();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");


    const { organization } = useOrganization();
    const orgId = organization?.id;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) return;
        console.log("organizationId" + orgId);

        await createRoom.mutateAsync({
            organizationId: orgId,
            name,
            description,
        });

        router.push("/dashboard/office");
    };

    return (
        <main className="max-w-xl mx-auto py-12">
            <Card>
                <CardHeader>
                    <CardTitle>Create a Room</CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <Input
                            placeholder="Room name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <Textarea
                            placeholder="Room description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={createRoom.isPending}>
                            {createRoom.isPending ? "Creating..." : "Create Room"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}
