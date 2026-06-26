import Link from "next/link";
import { UserMinus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { FriendUser } from "@/services/friendService";

interface FriendCardProps {
  user: FriendUser;
  isRemoving: boolean;
  onRemove: (userId: string) => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function FriendCard({
  user,
  isRemoving,
  onRemove,
}: FriendCardProps) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/users/${user._id}`}
        className="flex min-w-0 items-center gap-3"
      >
        <Avatar className="h-11 w-11 border border-orange-100">
          <AvatarFallback className="bg-orange-50 font-semibold text-orange-700">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-blue-700 hover:text-blue-900">
            {user.name}
          </h3>
          <p className="truncate text-sm text-gray-500">
            @{user.username || user.name.replace(/\s+/g, "").toLowerCase()}
          </p>
        </div>
      </Link>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRemoving}
        onClick={() => onRemove(user._id)}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <UserMinus />
        {isRemoving ? "Removing..." : "Remove"}
      </Button>
    </article>
  );
}

