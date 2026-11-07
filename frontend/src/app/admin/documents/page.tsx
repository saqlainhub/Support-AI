
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Search,
  Files,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type DocumentItem = {
  id: number;
  filename: string;
  created_at: string;
};

type UploadResult = {
  message: string;
  document_id: number;
  filename: string;
  pages: number;
};

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest<DocumentItem[]>("/documents");
      setDocuments(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load documents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument() {
    if (!selectedFile || uploading) return;

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }

    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("The maximum file size is 10 MB.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await apiRequest<UploadResult>(
        "/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      setNotice(
        `${result.filename} uploaded and processed successfully. ` +
          `${result.pages} page(s) extracted.`
      );
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Document upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${document.filename}"? The AI may lose access to its information.`
    );

    if (!confirmed) return;

    setDeletingId(document.id);
    setError("");
    setNotice("");

    try {
      await apiRequest<{ message: string }>(
        `/documents/${document.id}`,
        { method: "DELETE" }
      );

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id)
      );
      setNotice(`Deleted "${document.filename}".`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Document deletion failed."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDocuments = documents.filter((document) =>
    document.filename.toLowerCase().includes(search.toLowerCase())
  );

  const totalSizeMB = selectedFile
    ? (selectedFile.size / (1024 * 1024)).toFixed(2)
    : null;

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-400">
            KNOWLEDGE MANAGEMENT
          </p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Documents
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Manage the PDFs used by your AI support assistant.
          </p>
        </div>

        <button
          onClick={() => void loadDocuments()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="break-words">{error}</p>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm text-emerald-300"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
              <Files size={21} />
            </div>
            <div>
              <p className="text-sm text-slate-400">
                Indexed documents
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {loading ? "—" : documents.length}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Total documents returned by the backend.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <FileText size={21} />
            </div>
            <div>
              <p className="text-sm text-slate-400">
                Upload limit
              </p>
              <p className="mt-1 text-2xl font-semibold">25 MB</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Maximum size per PDF file.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
            <Upload size={21} />
          </div>
          <div>
            <h3 className="font-semibold">Upload knowledge document</h3>
            <p className="mt-1 text-xs text-slate-500">
              PDF only · Maximum 10 MB
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-[#080d19] p-5 sm:p-7">
          <label
            htmlFor="document-file"
            className="block cursor-pointer text-center"
          >
            <Upload
              size={27}
              className="mx-auto text-slate-500"
            />
            <p className="mt-3 text-sm font-medium text-slate-200">
              Choose a PDF from your computer
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Company policies, FAQs, product guides, and manuals
            </p>
          </label>

          <input
            ref={fileInputRef}
            id="document-file"
            type="file"
            accept=".pdf,application/pdf"
            disabled={uploading}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setError("");
              setNotice("");
            }}
            className="mt-5 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />

          {selectedFile && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText
                  size={20}
                  className="shrink-0 text-blue-400"
                />
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {totalSizeMB} MB
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Remove
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void uploadDocument()}
            disabled={!selectedFile || uploading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Upload size={16} />
            {uploading ? "Uploading and processing..." : "Upload document"}
          </button>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Processing may take time because the backend extracts PDF text
            and generates embeddings.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1423]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <h3 className="font-semibold">All documents</h3>
            <p className="mt-1 text-xs text-slate-500">
              {documents.length} document(s) in the backend
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#080d19] px-3 py-2">
            <Search size={16} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              aria-label="Search documents"
              className="w-36 bg-transparent text-sm outline-none placeholder:text-slate-600 sm:w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-10 text-center">
            <Files size={28} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-300">
              {documents.length === 0
                ? "No documents uploaded yet"
                : "No matching documents"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {documents.length === 0
                ? "Upload your first PDF to populate the knowledge base."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredDocuments.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4 transition hover:bg-white/[0.02] sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/10 bg-blue-500/[0.07] text-blue-400">
                    <FileText size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-slate-200">
                      {document.filename}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ID: {document.id}
                      {" · "}
                      {document.created_at
                        ? new Date(document.created_at).toLocaleString()
                        : "Date unavailable"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Delete ${document.filename}`}
                  title="Delete document"
                  disabled={deletingId !== null || uploading}
                  onClick={() => void deleteDocument(document)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  {deletingId === document.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}