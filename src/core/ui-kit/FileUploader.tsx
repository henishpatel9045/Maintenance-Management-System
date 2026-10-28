"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Camera, File, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "./Button";

export interface FileUploaderProps {
  onUpload: (files: File[], bucket: "QUOTE" | "ARTEFACT", metadata?: Record<string, any>) => Promise<void>;
  bucket?: "QUOTE" | "ARTEFACT";
  allowBucketSwitch?: boolean;
  maxSizeMB?: number;
}

export function FileUploader({
  onUpload,
  bucket = "ARTEFACT",
  allowBucketSwitch = false,
  maxSizeMB = 25,
}: FileUploaderProps) {
  const [selectedBucket, setSelectedBucket] = useState<"QUOTE" | "ARTEFACT">(bucket);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setUploadError(null);
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      await onUpload(selectedFiles, selectedBucket);
      setSelectedFiles([]);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      {allowBucketSwitch && (
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 uppercase">Bucket:</span>
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedBucket("ARTEFACT")}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedBucket === "ARTEFACT"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Artefacts
            </button>
            <button
              type="button"
              onClick={() => setSelectedBucket("QUOTE")}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedBucket === "QUOTE"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Quotes
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"
      >
        <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Click to upload or drag & drop files
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {selectedBucket === "QUOTE"
            ? "PDF, Word, Excel, CSV or scanned quote photos"
            : "Images (JPG, PNG, WebP), Videos (MP4), documents or reports"}
        </span>

        {/* Action Buttons for Mobile */}
        <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            icon={<File className="w-3.5 h-3.5" />}
          >
            Browse Files
          </Button>

          {selectedBucket === "ARTEFACT" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              icon={<Camera className="w-3.5 h-3.5" />}
            >
              Take Photo
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept={
            selectedBucket === "QUOTE"
              ? ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt"
              : ".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.docx,.xlsx,.csv,.txt"
          }
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Selected Files Queue */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Selected Files ({selectedFiles.length})</span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-red-500 hover:text-red-700"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <File className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-slate-400 text-[10px] shrink-0">
                    ({(f.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isUploading}
              onClick={handleStartUpload}
            >
              Upload {selectedFiles.length} {selectedFiles.length === 1 ? "File" : "Files"}
            </Button>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Files uploaded successfully</span>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
}
