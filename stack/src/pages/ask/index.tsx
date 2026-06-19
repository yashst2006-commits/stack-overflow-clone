import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { toast } from "react-toastify";

const index = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    title: "",
    body: "",
    tags: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const errors = {
      title: "",
      body: "",
      tags: "",
    };

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }

    if (!formData.body.trim()) {
      errors.body = "Description is required";
    } else if (formData.body.trim().length < 20) {
      errors.body = "Description must be at least 20 characters";
    }

    if (formData.tags.length === 0) {
      errors.tags = "At least one tag is required";
    }

    setFieldErrors(errors);

    return !errors.title && !errors.body && !errors.tags;
  };

  const getErrorMessage = (error: any) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (error.request) {
      return "Unable to connect to the server";
    }

    return "Unable to save question";
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    if (id === "tags") {
      const tagarray = value
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      setFormData((prev) => ({ ...prev, tags: tagarray }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in");
      router.push("/auth");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await axiosInstance.post("/questions", {
        title: formData.title.trim(),
        description: formData.body.trim(),
        tags: formData.tags,
        userId: user?._id,
        author: user.name,
      });
      if (res.data.data) {
        toast.success(res.data.message || "Question posted successfully");
        router.push(`/questions/${res.data.data._id}`);
      }
    } catch (error) {
      console.error("Question submit failed:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleAddTag = (e: any) => {
    e.preventDefault();
    const trimmedTag = newTag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmedTag] });
      setFieldErrors((prev) => ({ ...prev, tags: "" }));
      setNewTag("");
    }
  };
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag: any) => tag !== tagToRemove),
    });
  };
  return (
    <Mainlayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl lg:text-2xl font-semibold mb-6">
          Ask a public question
        </h1>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg lg:text-xl">
                Writing a good question
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="title" className="text-base font-semibold">
                  Title
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Be specific and imagine you're asking a question to another
                  person.
                </p>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. How to center a div in CSS?"
                  className="w-full"
                />
                {fieldErrors.title ? (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.title}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="body" className="text-base font-semibold">
                  What are the details of your problem?
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Introduce the problem and expand on what you put in the title.
                  Minimum 20 characters.
                </p>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={handleChange}
                  placeholder="Describe your problem in detail..."
                  className="min-h-32 lg:min-h-48 w-full"
                />
                {fieldErrors.body ? (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.body}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="tags" className="text-base font-semibold">
                  Tags
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Add up to 5 tags to describe what your question is about.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="e.g. javascript react nextjs"
                    className="w-full"
                  />
                  <Button
                    onClick={handleAddTag}
                    variant="outline"
                    size="sm"
                    type="button"
                    className="bg-orange-600 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag: any) => {
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
                {fieldErrors.tags ? (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.tags}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white"
                >
                  {isSubmitting ? "Submitting..." : "Review your question"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </Mainlayout>
  );
};

export default index;
