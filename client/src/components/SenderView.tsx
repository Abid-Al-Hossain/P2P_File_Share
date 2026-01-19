import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Radio, Share2 } from "lucide-react";
import { P2PClient } from "@/lib/p2p";
import { cn } from "@/lib/utils";

interface SenderViewProps {
  files: File[];
  onBack: () => void;
}

export function SenderView({ files, onBack }: SenderViewProps) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "waiting" | "connected" | "transferring"
  >("connecting");
  const [logs, setLogs] = useState<string[]>([]);
  const p2pRef = useRef<P2PClient | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Initialize P2P
    const p2p = new P2PClient();
    p2pRef.current = p2p;

    p2p.createRoom();

    p2p.on("connected", ({ roomId, role }: any) => {
      if (role === "sender") {
        setRoomId(roomId);
        setStatus("waiting");
        addLog(`Room created: ${roomId}`);
      }
      if (role === "receiver") {
        // Should not happen for sender view
      }
      if (p2p.peer && p2p.peer.connected) {
        setStatus("connected");
        addLog("Peer connected via WebRTC!");
        // Send metadata immediately
        sendMetadata();
      }
    });

    // Queue for sequential file transfer
    // MOVED to top level (see below)

    // ... p2p setup ...

    p2p.on("data", (data: any) => {
      // Handle requests from receiver
      try {
        let text = "";
        if (typeof data === "string") text = data;
        else if (
          data instanceof ArrayBuffer ||
          ArrayBuffer.isView(data) ||
          Array.isArray(data)
        ) {
          // Provide fallback for Uint8Array
          text = new TextDecoder().decode(data as any);
        } else {
          text = String(data);
        }

        // Only parse if it looks like JSON
        if (text.trim().startsWith("{")) {
          const msg = JSON.parse(text);
          if (msg.type === "request-file") {
            addLog(`Peer requested file: ${msg.fileId} (Queued)`);
            transferQueue.current.push(msg.fileId);
            processQueue();
          }
        }
      } catch (e) {
        // Ignore non-JSON data or parse errors
        // This is crucial to let other listeners (like onAck) handle their data
      }
    });

    return () => {
      p2p.destroy();
    };
  }, []);

  // Queue for sequential file transfer
  const transferQueue = useRef<string[]>([]);
  const isTransferring = useRef(false);

  const processQueue = async () => {
    if (isTransferring.current || transferQueue.current.length === 0) return;

    isTransferring.current = true;
    const fileId = transferQueue.current.shift();
    if (fileId) {
      await sendFile(fileId);
    }
    isTransferring.current = false;
    processQueue(); // Process next
  };

  const addLog = (msg: string) => setLogs((prev) => [...prev.slice(-4), msg]);

  const sendMetadata = () => {
    if (!p2pRef.current) return;
    const metadata = files.map((f, i) => ({
      id: i.toString(),
      name: f.name,
      size: f.size,
      type: f.type,
      path: (f as any).customPath || f.name,
    }));
    p2pRef.current.send({ type: "metadata", files: metadata });
    addLog("Sent file metadata to peer");
  };

  const sendFile = async (fileId: string) => {
    const fileIndex = parseInt(fileId);
    const file = files[fileIndex];
    if (!file || !p2pRef.current) return;

    setStatus("transferring");
    addLog(`Starting transfer: ${file.name}`);

    const CHUNK_SIZE = 16 * 1024; // 16KB

    // Simplified wait function that hooks into the main data stream?
    // The issue is p2p.on('data') is global.
    // Let's assume the Receiver sends { type: 'chunk-ack', fileId } as JSON string.

    const sendChunkAndWait = async (chunk: ArrayBuffer) => {
      p2pRef.current?.send(chunk);
      // Wait for ACK
      await new Promise<void>((resolve) => {
        const onAck = (raw: any) => {
          try {
            // Check if it's the ACK we want
            // Receiver sends JSON string or Buffer?
            // Sender code assumes data is whatever simple-peer gives.
            // Let's decode safely.
            let text = "";
            if (typeof raw === "string") text = raw;
            else if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw))
              text = new TextDecoder().decode(raw);

            const msg = JSON.parse(text);
            if (msg.type === "chunk-ack" && msg.fileId === fileId) {
              p2pRef.current?.off("data", onAck);
              resolve();
            }
          } catch (e) {}
        };
        p2pRef.current?.on("data", onAck);
      });
    };

    // Send File Start
    p2pRef.current.send({
      type: "file-start",
      fileId,
      size: file.size,
      name: file.name,
    });
    // Wait for start-ack? Optional, but safer.
    // Let's assume we proceed. Receiver will open file on first chunk or file-start.

    // Actually, FileSystem API creation is async. We SHOULD wait for file-start ack.
    await new Promise<void>((resolve) => {
      const onStartAck = (raw: any) => {
        try {
          let text = "";
          if (typeof raw === "string") text = raw;
          else if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw))
            text = new TextDecoder().decode(raw);
          const msg = JSON.parse(text);
          if (msg.type === "chunk-ack" && msg.fileId === fileId) {
            // Re-using chunk-ack or specific start-ack
            p2pRef.current?.off("data", onStartAck);
            resolve();
          }
        } catch (e) {}
      };
      p2pRef.current?.on("data", onStartAck);
    });

    // Read and stream
    let offset = 0;
    const reader = new FileReader();

    return new Promise<void>((resolve) => {
      const processNextChunk = async () => {
        if (offset >= file.size) {
          p2pRef.current?.send({ type: "file-end", fileId });
          addLog(`Finished sending: ${file.name}`);
          setStatus("connected");
          resolve();
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = async (e) => {
        if (!p2pRef.current || !e.target?.result) return;

        const chunk = e.target.result as ArrayBuffer;
        await sendChunkAndWait(chunk);

        offset += CHUNK_SIZE;
        processNextChunk();
      };

      processNextChunk();
    });
  };

  const shareLink = `${window.location.origin}/#${roomId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-3 h-3 rounded-full animate-pulse",
              status === "connected" ? "bg-green-500" : "bg-yellow-500",
            )}
          />
          <span className="font-semibold capitalize">
            {status.replace("-", " ")}
          </span>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {/* Link Sharing */}
      {roomId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border p-8 rounded-3xl text-center space-y-6"
        >
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Share2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Ready to Share</h2>
            <p className="text-muted-foreground">
              Send this link to the receiver to start transfer
            </p>
          </div>

          <div className="flex items-center gap-2 max-w-md mx-auto bg-muted p-2 rounded-xl">
            <code className="flex-1 text-sm p-2 text-muted-foreground truncate font-mono">
              {shareLink}
            </code>
            <button
              onClick={copyLink}
              className="p-3 bg-background rounded-lg hover:text-primary transition-colors border shadow-sm"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Logs / File List */}
      <div className="space-y-4">
        <h3 className="font-semibold px-2">Shared Files ({files.length})</h3>
        <div className="bg-muted/30 rounded-2xl p-4 max-h-[300px] overflow-y-auto space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50"
            >
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Radio className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground text-opacity-70">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debug Logs */}
      <div className="p-4 rounded-xl bg-black/80 font-mono text-xs text-green-400 h-32 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i}>
            {">"} {log}
          </div>
        ))}
      </div>
    </div>
  );
}
