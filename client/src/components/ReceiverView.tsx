import { useEffect, useState, useRef } from "react";
import { P2PClient, type FileMetadata } from "@/lib/p2p";
import { Download, File, CheckCircle } from "lucide-react";
// import { cn } from "@/lib/utils"; // Assuming cn utility exists

interface ReceiverViewProps {
  roomId: string;
}

export function ReceiverView({ roomId }: ReceiverViewProps) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "downloading" | "completed"
  >("connecting");
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const p2pRef = useRef<P2PClient | null>(null);

  // Buffers for incoming files
  // Map<fileId, Array<ArrayBuffer>>
  const fileBuffers = useRef<Map<string, ArrayBuffer[]>>(new Map());
  const receivedSizes = useRef<Map<string, number>>(new Map());

  // Mirror files state in a ref so handlers in useEffect can access latest value
  const filesRef = useRef<FileMetadata[]>([]);

  useEffect(() => {
    const p2p = new P2PClient();
    p2pRef.current = p2p;

    // Join the room
    p2p.joinRoom(roomId);

    p2p.on("connected", () => {
      setStatus("connected");
    });

    p2p.on("data", async (data: any) => {
      let isCommand = false;
      let msg: any = null;

      try {
        let text = "";
        if (typeof data === "string") {
          text = data;
        } else {
          // Binary data (Uint8Array / ArrayBuffer)
          const bytes = new Uint8Array(
            data instanceof ArrayBuffer ? data : data.buffer || data,
          );

          // Optimization: Only decode if it looks like a JSON object (starts with '{' = 123)
          // and is small enough to be a command.
          if (bytes[0] === 123 && bytes.byteLength < 5000) {
            text = new TextDecoder().decode(data);
          }
        }

        if (text && text.trim().startsWith("{")) {
          msg = JSON.parse(text);
          if (msg && msg.type) {
            isCommand = true;
          }
        }
      } catch (e) {
        // Not a JSON message or text decoding failed
      }

      if (isCommand && msg) {
        console.log("Received command:", msg.type);
        if (msg.type === "metadata") {
          setFiles(msg.files);
          filesRef.current = msg.files; // Keep ref in sync for closure access
        } else if (msg.type === "file-start") {
          currentFileId.current = msg.fileId;
          receivingFileSize.current = msg.size;

          // JIT Stream Creation: Create the stream NOW, not upfront
          if (rootDirHandle.current) {
            try {
              const fileInfo = filesRef.current.find(
                (f) => f.id === msg.fileId,
              );
              if (fileInfo) {
                const parts = fileInfo.path.split("/");
                const filename = parts.pop()!;
                let currentDir = rootDirHandle.current;

                for (const part of parts) {
                  currentDir = await currentDir.getDirectoryHandle(part, {
                    create: true,
                  });
                }

                const fileHandle = await currentDir.getFileHandle(filename, {
                  create: true,
                });
                const writable = await fileHandle.createWritable();
                fileWriters.current.set(msg.fileId, writable);
                console.log(`Created stream for file: ${fileInfo.name}`);
              }
            } catch (err) {
              console.error("Failed to create file stream:", err);
            }
          }

          // Send ACK to let sender start streaming
          p2pRef.current?.send({ type: "chunk-ack", fileId: msg.fileId });
        } else if (msg.type === "file-end") {
          await saveFile(msg.fileId);
          currentFileId.current = null;
          setProgress((prev) => ({ ...prev, [msg.fileId]: 100 }));
          onFileComplete(msg.fileId); // Trigger next file request
        }
      } else {
        // Treat as binary chunk
        handleChunk(data);
      }
    });

    return () => {
      p2p.destroy();
    };
  }, [roomId]);

  const currentFileId = useRef<string | null>(null);
  const receivingFileSize = useRef<number>(0);

  // We need a way to obtain a WritableFileStream if using File System Access API
  // Map<fileId, FileSystemWritableFileStream>
  const fileWriters = useRef<Map<string, FileSystemWritableFileStream>>(
    new Map(),
  );
  const rootDirHandle = useRef<FileSystemDirectoryHandle | null>(null);

  const handleChunk = async (chunk: ArrayBuffer) => {
    const fileId = currentFileId.current;
    if (!fileId) return;

    if (rootDirHandle.current) {
      // Direct write to disk
      const writer = fileWriters.current.get(fileId);
      if (writer) {
        try {
          await writer.write(chunk);
          // Send ACK only after successful write
          p2pRef.current?.send({ type: "chunk-ack", fileId });

          // Update progress
          const current = receivedSizes.current.get(fileId) || 0;
          const newSize = current + chunk.byteLength;
          receivedSizes.current.set(fileId, newSize);
        } catch (writeErr) {
          console.error("Error writing chunk to disk:", writeErr);
          // Should we retry or abort? For now, logging usage.
        }
      }
    } else {
      // Fallback: Memory buffer
      if (!fileBuffers.current.has(fileId)) {
        fileBuffers.current.set(fileId, []);
      }
      fileBuffers.current.get(fileId)!.push(chunk);
      // ACK for memory buffer too
      p2pRef.current?.send({ type: "chunk-ack", fileId });
    }
  };

  const saveFile = async (fileId: string) => {
    // If using writers, close it
    if (rootDirHandle.current) {
      const writer = fileWriters.current.get(fileId);
      if (writer) {
        try {
          console.log(`Closing file stream for ${fileId}...`);
          await writer.close();
          console.log(`File ${fileId} successfully saved/closed.`);
        } catch (err) {
          console.error(`Failed to close file stream for ${fileId}:`, err);
        }
      }
    } else {
      // Download as Blob (fallback for browsers without File System Access API)
      const chunks = fileBuffers.current.get(fileId);
      console.log(
        `Fallback download: fileId=${fileId}, chunks=${chunks?.length}`,
      );

      if (chunks && chunks.length > 0) {
        const blob = new Blob(chunks);
        console.log(`Created blob of size: ${blob.size} bytes`);

        const file = filesRef.current.find((f) => f.id === fileId);
        if (file) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.style.display = "none";
          document.body.appendChild(a); // Must append to DOM for some browsers
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log(`Triggered download for: ${file.name}`);
        } else {
          console.error(`File info not found for fileId: ${fileId}`);
        }
        // Clear memory
        fileBuffers.current.delete(fileId);
      } else {
        console.error(`No chunks found for fileId: ${fileId}`);
      }
    }
  };

  // Queue for sequential file requests
  const pendingFileRequests = useRef<string[]>([]);
  const isReceivingFile = useRef(false);

  const requestNextFile = () => {
    if (isReceivingFile.current || pendingFileRequests.current.length === 0)
      return;

    const nextFileId = pendingFileRequests.current[0]; // Peek, don't shift yet
    console.log(`Requesting file: ${nextFileId}`);
    p2pRef.current?.send({ type: "request-file", fileId: nextFileId });
    isReceivingFile.current = true;
  };

  const onFileComplete = (fileId: string) => {
    // Remove the completed file from queue
    pendingFileRequests.current = pendingFileRequests.current.filter(
      (id) => id !== fileId,
    );
    isReceivingFile.current = false;

    // Check if all done
    if (pendingFileRequests.current.length === 0) {
      setStatus("completed");
      console.log("All files received!");
    } else {
      requestNextFile();
    }
  };

  const startDownload = async () => {
    if (files.length === 0) return;

    // Request Directory Handle ONLY - don't create streams yet
    try {
      if ("showDirectoryPicker" in window) {
        const handle = await (window as any).showDirectoryPicker();
        rootDirHandle.current = handle;
        console.log("Directory selected for saving files.");
      }
    } catch (err) {
      console.warn(
        "File System API rejected or not supported, using fallback memory buffer",
        err,
      );
      rootDirHandle.current = null; // Ensure fallback is used
    }

    // Queue all file requests but only start the first one
    setStatus("downloading");
    pendingFileRequests.current = files.map((f) => f.id);
    requestNextFile();
  };

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Download className="w-8 h-8 text-foreground" />
        </div>
        <h2 className="text-2xl font-bold">
          {status === "connecting"
            ? "Connecting to Sender..."
            : "Ready to Receive"}
        </h2>
        <p className="text-muted-foreground">Peer ID: {roomId}</p>
      </div>

      {files.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Files ({files.length})</h3>
            {status === "connected" && (
              <button
                onClick={startDownload}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Download All
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg"
              >
                <File className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {progress[file.id] === 100 && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
