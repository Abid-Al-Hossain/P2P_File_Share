import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePickerProps {
  onFilesSelected: (files: File[], structure: any) => void;
}

export function FilePicker({ onFilesSelected }: FilePickerProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const processEntry = async (entry: any, path = ""): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          // Add the path to the file object properties if needed for later
          // or return a wrapper. For P2P, we just need the file and its relative path.
          // Native File object has 'webkitRelativePath', but dropped files might not have it populated fully correctly across browsers.
          // We manually attach a path property for our logic.
          Object.defineProperty(file, "customPath", {
            value: path + file.name,
          });
          resolve([file]);
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries: any[] = await new Promise((resolve) => {
        dirReader.readEntries((results: any[]) => resolve(results));
      });

      let files: File[] = [];
      for (const childEntry of entries) {
        const childFiles = await processEntry(
          childEntry,
          path + entry.name + "/",
        );
        files = [...files, ...childFiles];
      }
      return files;
    }
    return [];
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const items = e.dataTransfer.items;
    let allFiles: File[] = [];

    // Use webkitGetAsEntry for directory support
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const files = await processEntry(entry);
            allFiles = [...allFiles, ...files];
          }
        }
      }
    } else {
      // Fallback for older browsers
      if (e.dataTransfer.files) {
        allFiles = Array.from(e.dataTransfer.files);
      }
    }

    if (allFiles.length > 0) {
      onFilesSelected(allFiles, {}); // Structure TODO
    }
  }, []);

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      // Manual input doesn't give full directory structure easily unless directory attribute is set
      // But the input type='file' with 'webkitdirectory' can handle folders
      onFilesSelected(fileList, {});
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        layout
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-12 transition-colors duration-300 ease-in-out flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden",
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        whileTap={{ scale: 0.98 }}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
          onChange={handleManualSelect}
        />

        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div
              className={cn(
                "p-4 rounded-full bg-muted transition-colors",
                isDragActive
                  ? "bg-primary text-white"
                  : "text-muted-foreground",
              )}
            >
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">
                {isDragActive ? "Drop files now" : "Select or Drop Files"}
              </h3>
              <p className="text-muted-foreground max-w-sm">
                Share files directly from your device. No size limits.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Decorative Grid */}
        <div
          className="absolute inset-0 -z-10 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </motion.div>
    </div>
  );
}
