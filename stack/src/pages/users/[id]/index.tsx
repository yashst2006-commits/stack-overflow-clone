import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Award, Calendar, Edit, Plus, Send, X } from "lucide-react";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
const getUserData = (id: string) => {
  const users = {
    "1": {
      id: 1,
      name: "John Doe",
      joinDate: "2019-03-15",
      about:
        "Full-stack developer with 8+ years of experience in JavaScript, React, and Node.js. Passionate about clean code and helping others learn programming. I enjoy working on open-source projects and contributing to the developer community.",
      tags: [
        "javascript",
        "react",
        "node.js",
        "typescript",
        "python",
        "mongodb",
      ],
    },
  };
  return users[id as keyof typeof users] || users["1"];
};
const index = () => {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [users, setusers] = useState<any>(null);
  const [loading, setloading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: users?.name || "",
    about: users?.about || "",
    tags: users?.tags || [],
  });
  const [newTag, setNewTag] = useState("");
  const [isTransferringOpen, setIsTransferringOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  // Holds the AUTHENTICATED user's live point balance for the transfer modal.
  // Initialised from context; refreshed from the server when the modal opens.
  const [senderPoints, setSenderPoints] = useState<number>(user?.points ?? 0);

  useEffect(() => {
    const fetchuser = async () => {
      try {
        const res = await axiosInstance.get("/user/getalluser");
        const matcheduser = res.data.data.find((u: any) => u._id === id);
        setusers(matcheduser);
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchuser();
  }, [id]);
  if (loading) {
    return (
      <Mainlayout>
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </Mainlayout>
    );
  }
  if (!users || users.length === 0) {
    return <div className="text-center text-gray-500 mt-4">No user found.</div>;
  }

  const handleSaveProfile = async () => {
    try {
      const res = await axiosInstance.patch(`/user/update/${user?._id}`, {
        editForm,
      });
      if (res.data.data) {
        const updatedUser = {
          ...users,
          name: editForm.name,
          about: editForm.about,
          tags: editForm.tags,
        };

        setusers(updatedUser);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      }
    } catch (error) {
      console.log(error);
      toast.error("Something went wrong");
    }
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !editForm.tags.includes(trimmedTag)) {
      setEditForm({ ...editForm, tags: [...editForm.tags, trimmedTag] });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter((tag: any) => tag !== tagToRemove),
    });
  };


  // Fetch the logged-in user's CURRENT points from the server.
  // Avoids using a stale localStorage snapshot or the viewed profile's points.
  const fetchSenderPoints = async () => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.get("/user/getalluser");
      const me = res.data.data.find((u: any) => u._id === user._id);
      if (me && typeof me.points === "number") {
        setSenderPoints(me.points);
      }
    } catch (err) {
      // Fallback: keep the context value so UI still shows something
      setSenderPoints(user?.points ?? 0);
    }
  };

  // Called when the Transfer Dialog open state changes.
  const handleTransferDialogChange = (open: boolean) => {
    setIsTransferringOpen(open);
    if (open) {
      // Always refresh sender points from the server when the modal opens
      fetchSenderPoints();
      setTransferAmount("");
    }
  };

  const handleTransferPoints = async () => {
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive point amount.");
      return;
    }

    if (!id) {
      toast.error("Invalid recipient.");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await axiosInstance.post("/user/transfer-points", {
        recipientId: id,
        amount: amt,
      });

      if (res.data.success) {
        toast.success(res.data.message || "Points transferred successfully.");

        // Update the viewed profile's (recipient's) displayed points
        setusers((prev: any) => ({
          ...prev,
          points: (prev?.points || 0) + amt,
        }));

        // Update the authenticated user's points using the server-authoritative
        // remainingPoints value — never derive this from the profile being viewed.
        const newSenderPoints =
          typeof res.data.remainingPoints === "number"
            ? res.data.remainingPoints
            : senderPoints - amt;
        setSenderPoints(newSenderPoints);
        refreshUser({ points: newSenderPoints });

        setIsTransferringOpen(false);
        setTransferAmount("");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error?.response?.data?.message || "Failed to transfer points.";
      toast.error(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  const currentUserId = user?._id;
  const isOwnProfile = id === currentUserId;
  return (
    <Mainlayout>
      <div className="max-w-6xl">
        {/* User Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-8">
          <Avatar className="w-24 h-24 lg:w-32 lg:h-32">
            <AvatarFallback className="text-2xl lg:text-3xl">
              {users.name
                .split(" ")
                .map((n: any) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-1">
                  {users.name}
                </h1>
              </div>

              {isOwnProfile && (
                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Basic Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Display Name</Label>
                            <Input
                              id="name"
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                              placeholder="Your display name"
                            />
                          </div>
                        </div>
                      </div>
                      {/* About Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">About</h3>
                        <div>
                          <Label htmlFor="about">About Me</Label>
                          <Textarea
                            id="about"
                            value={editForm.about}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                about: e.target.value,
                              })
                            }
                            placeholder="Tell us about yourself, your experience, and interests..."
                            className="min-h-32"
                          />
                        </div>
                      </div>

                      {/* Tags/Skills Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Skills & Technologies
                        </h3>

                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              placeholder="Add a skill or technology"
                              onKeyPress={(e) =>
                                e.key === "Enter" && handleAddTag()
                              }
                            />
                            <Button
                              onClick={handleAddTag}
                              variant="outline"
                              size="sm"
                              className="bg-orange-600 text-white"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {editForm.tags.map((tag: any) => {
                              return (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="bg-orange-100 text-orange-800 flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="ml-1 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                          className="bg-white text-gray-800 hover:text-gray-900"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {!isOwnProfile && user && (
                <Dialog open={isTransferringOpen} onOpenChange={handleTransferDialogChange}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700 border-none"
                    >
                      <Send className="w-4 h-4" />
                      Transfer Points
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-white text-gray-900">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <Award className="w-5 h-5 text-orange-500" />
                        Transfer Points
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
                        <p className="font-semibold">Recipient: {users?.name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Your Current Points: <strong className="text-gray-900">{senderPoints}</strong>
                        </p>
                      </div>

                      {/* Warning notice if current user balance <= 10 */}
                      {senderPoints <= 10 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-medium">
                          ⚠️ You need more than 10 points to transfer points.
                        </div>
                      )}

                      <div>
                        <Label htmlFor="transfer-amount">Point Amount</Label>
                        <Input
                          id="transfer-amount"
                          type="number"
                          min="1"
                          placeholder="Enter points amount"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          disabled={senderPoints <= 10}
                          className="mt-1"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setIsTransferringOpen(false)}
                          className="bg-white text-gray-800"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleTransferPoints}
                          disabled={senderPoints <= 10 || isTransferring || !transferAmount}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {isTransferring ? "Transferring..." : "Confirm Transfer"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Member since{" "}
                {new Date(users.joinDate).toISOString().split("T")[0]}
              </div>
              <div className="flex items-center text-gray-800 font-medium">
                <Award className="w-4 h-4 mr-1 text-orange-500" />
                Points: <span className="font-bold ml-1">{users.points ?? 0}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="font-semibold">5</span>
                <span className="text-gray-600 ml-1">gold badges</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span className="font-semibold">23</span>
                <span className="text-gray-600 ml-1">silver badges</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-amber-600 rounded-full mr-2"></div>
                <span className="font-semibold">45</span>
                <span className="text-gray-600 ml-1">bronze badges</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1  gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {users.about}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.tags.map((tag: string) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer"
                        >
                          {tag}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Mainlayout>
  );
};

export default index;
