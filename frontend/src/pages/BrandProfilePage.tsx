import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BrandProfile,
  BrandProfileInput,
  Platform,
  PostingFrequency,
  createBrandProfile,
  deleteBrandProfile,
  listBrandProfiles,
  updateBrandProfile,
} from "../api/brandProfile";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "THREADS"];
const FREQUENCIES: PostingFrequency[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];

const emptyForm: BrandProfileInput = {
  brandName: "",
  industry: "",
  description: "",
  brandVoice: "",
  targetAudience: "",
  contentGoal: "",
  platforms: [],
  postingFrequency: "WEEKLY",
  preferredTimes: [],
};

export default function BrandProfilePage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [form, setForm] = useState<BrandProfileInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timesText, setTimesText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    listBrandProfiles()
      .then(setProfiles)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(load, []);

  const resetForm = () => {
    setForm(emptyForm);
    setTimesText("");
    setEditingId(null);
  };

  const togglePlatform = (platform: Platform) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const startEdit = (profile: BrandProfile) => {
    setEditingId(profile.id);
    setForm({
      brandName: profile.brandName,
      industry: profile.industry,
      description: profile.description ?? "",
      brandVoice: profile.brandVoice ?? "",
      targetAudience: profile.targetAudience,
      contentGoal: profile.contentGoal ?? "",
      platforms: profile.platforms,
      postingFrequency: profile.postingFrequency,
      preferredTimes: profile.preferredTimes,
    });
    setTimesText(profile.preferredTimes.join(", "));
    setMessage("");
    setError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    const payload: BrandProfileInput = {
      ...form,
      preferredTimes: timesText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        await updateBrandProfile(editingId, payload);
        setMessage("Brand profile updated");
      } else {
        await createBrandProfile(payload);
        setMessage("Brand profile created");
      }
      resetForm();
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    setMessage("");
    try {
      await deleteBrandProfile(id);
      if (editingId === id) resetForm();
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Brand profiles</h1>
          <button
            onClick={() => navigate("/profile")}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Back to profile
          </button>
        </div>

        {message && (
          <p className="rounded bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-sm">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <div className="bg-white rounded-lg shadow divide-y">
          {profiles.length === 0 && (
            <p className="p-6 text-sm text-gray-500">No brand profiles yet. Create one below.</p>
          )}
          {profiles.map((profile) => (
            <div key={profile.id} className="flex items-start justify-between p-4">
              <div>
                <p className="font-semibold text-gray-900">{profile.brandName}</p>
                <p className="text-sm text-gray-500">
                  {profile.industry} · {profile.platforms.join(", ")} · {profile.postingFrequency}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(profile)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingId ? "Edit brand profile" : "New brand profile"}
          </h2>

          <Field label="Brand name" required>
            <input
              type="text"
              required
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Industry" required>
            <input
              type="text"
              required
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Target audience" required>
            <input
              type="text"
              required
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
              rows={2}
            />
          </Field>

          <Field label="Brand voice">
            <input
              type="text"
              value={form.brandVoice}
              onChange={(e) => setForm({ ...form, brandVoice: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Content goal">
            <input
              type="text"
              value={form.contentGoal}
              onChange={(e) => setForm({ ...form, contentGoal: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Platforms" required>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Posting frequency" required>
            <select
              value={form.postingFrequency}
              onChange={(e) =>
                setForm({ ...form, postingFrequency: e.target.value as PostingFrequency })
              }
              className={inputClass}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Preferred time slots (comma-separated, e.g. 08:00-09:00)">
            <input
              type="text"
              value={timesText}
              onChange={(e) => setTimesText(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingId ? "Save changes" : "Create profile"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
