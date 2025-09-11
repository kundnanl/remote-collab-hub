import Image from "next/image";

type UserAvatarWithStatusProps = {
  imageUrl?: string;
  name?: string;
  status: "ONLINE" | "OFFLINE" | "IDLE" | "IN_MEETING";
};

const statusColors = {
  ONLINE: "bg-green-500",
  OFFLINE: "bg-gray-400",
  IDLE: "bg-yellow-400",
  IN_MEETING: "bg-blue-500",
};

export default function UserAvatarWithStatus({
  imageUrl,
  name,
  status,
}: UserAvatarWithStatusProps) {
  return (
    <div className="relative inline-block">
      <Image
        src={imageUrl ?? "/avatar.svg"}
        alt={name ?? "user"}
        className="w-10 h-10 rounded-full"
      />
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColors[status]}`}
      />
    </div>
  );
}
