import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock3,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";

import FriendCard from "@/components/friends/FriendCard";
import FriendRequestCard from "@/components/friends/FriendRequestCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import {
  acceptFriendRequest,
  getAllUsers,
  getFriendErrorMessage,
  getFriendOverview,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
  type FriendOverview,
  type FriendUser,
} from "@/services/friendService";

const emptyOverview: FriendOverview = {
  friends: [],
  pendingSent: [],
  pendingReceived: [],
  friendCount: 0,
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function FriendsPage() {
  const { user } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [users, setUsers] = useState<FriendUser[]>([]);
  const [overview, setOverview] = useState<FriendOverview>(emptyOverview);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const loadOverview = useCallback(async () => {
    const friendOverview = await getFriendOverview();
    setOverview(friendOverview);
  }, []);

  useEffect(() => {
    if (!hasMounted || !user) {
      if (hasMounted) {
        setIsLoading(false);
      }
      return;
    }

    const loadPage = async () => {
      setIsLoading(true);
      setMessage(null);

      const [overviewResult, usersResult] = await Promise.allSettled([
        getFriendOverview(),
        getAllUsers(),
      ]);

      const errors: string[] = [];

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      } else {
        console.error("[friends-page] Failed to load friend overview", {
          error: overviewResult.reason,
        });
        setOverview(emptyOverview);
        errors.push(
          getFriendErrorMessage(
            overviewResult.reason,
            "Unable to load your friends"
          )
        );
      }

      if (usersResult.status === "fulfilled") {
        setUsers(
          usersResult.value.filter((candidate) => candidate._id !== user._id)
        );
      } else {
        console.error("[friends-page] Failed to load users", {
          error: usersResult.reason,
        });
        setUsers([]);
        errors.push(
          getFriendErrorMessage(usersResult.reason, "Unable to load users")
        );
      }

      if (errors.length > 0) {
        const errorMessage = [...new Set(errors)].join(" ");
        setMessage({ type: "error", text: errorMessage });
        toast.error(errorMessage);
      }

      setIsLoading(false);
    };

    loadPage();
  }, [hasMounted, user]);

  const friendIds = useMemo(
    () => new Set(overview.friends.map((friend) => friend._id)),
    [overview.friends]
  );
  const pendingSentIds = useMemo(
    () => new Set(overview.pendingSent.map((candidate) => candidate._id)),
    [overview.pendingSent]
  );
  const pendingReceivedIds = useMemo(
    () => new Set(overview.pendingReceived.map((candidate) => candidate._id)),
    [overview.pendingReceived]
  );

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((candidate) =>
      [candidate.name, candidate.username]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [searchTerm, users]);

  const runAction = async (
    actionKey: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setActiveAction(actionKey);
    setMessage(null);

    try {
      await action();
      await loadOverview();
      setMessage({ type: "success", text: successMessage });
      toast.success(successMessage);
    } catch (error) {
      console.error("[friends-page] Friend action failed", {
        action: actionKey,
        error,
      });
      const errorMessage = getFriendErrorMessage(error, "Action failed");
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage);
    } finally {
      setActiveAction("");
    }
  };

  const renderRelationshipButton = (candidate: FriendUser) => {
    if (friendIds.has(candidate._id)) {
      return (
        <Button type="button" size="sm" variant="outline" disabled>
          <UserCheck /> Friends
        </Button>
      );
    }

    if (pendingSentIds.has(candidate._id)) {
      return (
        <Button type="button" size="sm" variant="outline" disabled>
          <Clock3 /> Pending
        </Button>
      );
    }

    if (pendingReceivedIds.has(candidate._id)) {
      return (
        <Button type="button" size="sm" variant="outline" disabled>
          <Check /> Respond below
        </Button>
      );
    }

    const isSending = activeAction === `send:${candidate._id}`;
    return (
      <Button
        type="button"
        size="sm"
        disabled={Boolean(activeAction)}
        onClick={() =>
          runAction(
            `send:${candidate._id}`,
            () => sendFriendRequest(candidate._id),
            `Friend request sent to ${candidate.name}`
          )
        }
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        <UserPlus />
        {isSending ? "Sending..." : "Add friend"}
      </Button>
    );
  };

  if (!hasMounted || isLoading) {
    return (
      <Mainlayout>
        <div className="flex min-h-64 items-center justify-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
            aria-label="Loading friends"
          />
        </div>
      </Mainlayout>
    );
  }

  if (!user) {
    return (
      <Mainlayout>
        <Card className="mx-auto mt-8 max-w-md text-center">
          <CardHeader>
            <CardTitle>Log in to manage friends</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-5 text-sm text-gray-600">
              Friend requests and your friends list are linked to your account.
            </p>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
              <Link href="/auth">Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </Mainlayout>
    );
  }

  return (
    <Mainlayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-orange-600">
              Your network
            </p>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Friends
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Connect with other developers and grow your community.
            </p>
          </div>

          <Card className="w-full gap-2 border-orange-200 bg-orange-50 py-4 sm:w-52">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="rounded-full bg-orange-100 p-2 text-orange-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {overview.friendCount}
                </p>
                <p className="text-sm text-gray-600">
                  {overview.friendCount === 1 ? "Friend" : "Friends"}
                </p>
              </div>
            </CardContent>
          </Card>
        </header>

        {message && (
          <div
            role="status"
            className={`rounded-md border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Incoming requests
            </h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {overview.pendingReceived.length}
            </span>
          </div>

          {overview.pendingReceived.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              You have no incoming friend requests.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overview.pendingReceived.map((candidate) => (
                <FriendRequestCard
                  key={candidate._id}
                  user={candidate}
                  isAccepting={activeAction === `accept:${candidate._id}`}
                  isRejecting={activeAction === `reject:${candidate._id}`}
                  onAccept={() =>
                    runAction(
                      `accept:${candidate._id}`,
                      () => acceptFriendRequest(candidate._id),
                      `${candidate.name} is now your friend`
                    )
                  }
                  onReject={() =>
                    runAction(
                      `reject:${candidate._id}`,
                      () => rejectFriendRequest(candidate._id),
                      "Friend request rejected"
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Find users</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search by display name or username.
            </p>
          </div>

          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search users"
              className="pl-10"
              aria-label="Search users"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              No users match your search.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredUsers.map((candidate) => (
                <article
                  key={candidate._id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/users/${candidate._id}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gray-100 font-semibold text-gray-700">
                        {getInitials(candidate.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-blue-700 hover:text-blue-900">
                        {candidate.name}
                      </h3>
                      <p className="truncate text-sm text-gray-500">
                        @
                        {candidate.username ||
                          candidate.name.replace(/\s+/g, "").toLowerCase()}
                      </p>
                    </div>
                  </Link>
                  {renderRelationshipButton(candidate)}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Your friends
            </h2>
            <span className="text-sm text-gray-500">
              {overview.friendCount} total
            </span>
          </div>

          {overview.friends.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-gray-400" />
              <p className="font-medium text-gray-700">No friends yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Send a request above to start building your network.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {overview.friends.map((friend) => (
                <FriendCard
                  key={friend._id}
                  user={friend}
                  isRemoving={activeAction === `remove:${friend._id}`}
                  onRemove={() =>
                    runAction(
                      `remove:${friend._id}`,
                      () => removeFriend(friend._id),
                      `${friend.name} was removed from your friends`
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Mainlayout>
  );
}
