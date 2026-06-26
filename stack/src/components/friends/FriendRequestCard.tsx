import Link from "next/link";
import { Check, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { FriendUser } from "@/services/friendService";

interface FriendRequestCardProps {
  user: FriendUser;
  isAccepting: boolean;
  isRejecting: boolean;
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function FriendRequestCard({
  user,
  isAccepting,
  isRejecting,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const isBusy = isAccepting || isRejecting;

  return (
    <article className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <Link
        href={`/users/${user._id}`}
        className="mb-4 flex min-w-0 items-center gap-3"
      >
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-blue-100 font-semibold text-blue-700">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-blue-700 hover:text-blue-900">
            {user.name}
          </h3>
          <p className="text-sm text-gray-500">Wants to connect with you</p>
        </div>
      </Link>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={() => onAccept(user._id)}
          className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check />
          {isAccepting ? "Accepting..." : "Accept"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => onReject(user._id)}
          className="flex-1 bg-white"
        >
          <X />
          {isRejecting ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </article>
  );
}

