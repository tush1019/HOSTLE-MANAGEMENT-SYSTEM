import { useState, useEffect, useCallback } from "react";
import { api, apiRaw } from "../lib/api";
import { useToast } from "../components/Toast";

type ImageItem = {
  id: number;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  image_data: string | null;
  display_order: number;
  is_published: boolean;
  is_cover: boolean;
  created_at: string;
};

type GalleryFormValues = {
  title: string;
  description: string;
  category: string;
  display_order: number;
  is_published: boolean;
  image_url: string | null;
  image_base64: string | null;
};

export default function CampusGallery() {
  const { notify } = useToast();
  const [role, setRole] = useState<"Admin" | "Student" | null>(null);
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("hostelUser");
    if (stored) setUser(JSON.parse(stored));
    const roleStored = localStorage.getItem("hostelRole");
    if (roleStored) setRole(roleStored as "Admin" | "Student");
  }, []);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<GalleryFormValues>({
    title: "", description: "", category: "Hostel Building", display_order: 0,
    is_published: true, image_url: null, image_base64: null,
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [publishId, setPublishId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");

  useEffect(() => { api<ImageItem[]>("/api/campus-gallery/public").then((data) => setItems(data ?? [])).catch(() => setItems([])); }, [search, categoryFilter, publishedFilter]);
  useEffect(() => { if (role !== "Admin") return; apiRaw<ImageItem[]>("/api/campus-gallery").then((data) => setItems(data ?? [])).catch(() => setItems([])); setLoading(false); }, [role]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; setForm({ ...form, [name]: value ? value.trim() : "" });
  }, [form]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      try {
        const updates: any = {};
        if (form.title !== "") updates.title = form.title;
        if (form.description !== "") updates.description = form.description;
        if (form.category !== "") updates.category = form.category;
        if (form.display_order !== undefined) updates.display_order = Number(form.display_order);
        if (form.is_published !== undefined) updates.is_published = form.is_published;
        if (form.image_url !== null) updates.image_url = form.image_url;
        if (form.image_base64 !== null) updates.image_data = form.image_base64;
        await apiRaw(`/api/campus-gallery/${editing}`, { method: "PUT", body: updates });
        notify("Gallery item updated", "success");
      } catch (err: any) { notify(err.message || "Failed to update", "error"); }
      setEditing(null);
    } else {
      try {
        await apiRaw("/api/campus-gallery", { method: "POST", body: form });
        notify("Gallery item created", "success");
      } catch (err: any) { notify(err.message || "Failed to create", "error"); }
    }
    setForm({ title: "", description: "", category: "Hostel Building", display_order: 0, is_published: true, image_url: null, image_base64: null });
    if (role === "Admin") { apiRaw<ImageItem[]>("/api/campus-gallery").then((data) => setItems(data ?? [])).catch(() => {}); }
    else { api<ImageItem[]>("/api/campus-gallery/public").then((data) => setItems(data ?? [])).catch(() => {}); }
  }, [editing, form, role]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Delete this item?")) return;
    try { await apiRaw(`/api/campus-gallery/${id}`, { method: "DELETE" }); notify("Gallery item deleted", "success"); }
    catch (err: any) { notify(err.message || "Failed to delete", "error"); }
    if (role === "Admin") { apiRaw<ImageItem[]>("/api/campus-gallery").then((data) => setItems(data)).catch(() => {}); }
    else { api<ImageItem[]>("/api/campus-gallery/public").then(setItems).catch(() => {}); }
  }, [role]);

  const handlePublish = useCallback(async (id: number, currentState: boolean) => {
    try { await apiRaw(`/api/campus-gallery/${id}/publish`, { method: "PATCH", body: { isPublished: !currentState } }); notify(`Gallery item ${!currentState ? "published" : "unpublished"}`, "success"); }
    catch (err: any) { notify(err.message || "Failed to update", "error"); }
    if (role === "Admin") { apiRaw<ImageItem[]>("/api/campus-gallery").then((data) => setItems(data)).catch(() => {}); }
    else { api<ImageItem[]>("/api/campus-gallery/public").then(setItems).catch(() => {}); }
  }, [role]);
  void user; void items; void loading; void deleteId; void setDeleteId; void publishId; void setPublishId;
  void search; void setSearch; void categoryFilter; void setCategoryFilter; void publishedFilter; void setPublishedFilter;
  void handleInput; void handleSubmit; void handleDelete; void handlePublish;
  return null;
}
