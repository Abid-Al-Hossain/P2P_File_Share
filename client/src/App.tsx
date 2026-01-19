import { useState, useEffect } from "react";
import { FilePicker } from "./components/FilePicker";
import { SenderView } from "./components/SenderView";
import { ReceiverView } from "./components/ReceiverView";
import { motion } from "framer-motion";
import { Shield, Zap } from "lucide-react";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) setRoomId(hash);
      else setRoomId(null);
    };

    // Check initial
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleFilesSelected = (selectedFiles: File[]) => {
    console.log("Selected Files:", selectedFiles);
    setFiles(selectedFiles);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span>P2P Share</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Security
            </a>
            <a
              href="https://github.com"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto space-y-16">
          {roomId ? (
            <ReceiverView roomId={roomId} />
          ) : files.length > 0 ? (
            <SenderView files={files} onBack={() => setFiles([])} />
          ) : (
            <div className="text-center space-y-6">
              {/* Hero Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-4">
                  <Shield className="w-3 h-3" /> Secure P2P Encrypted
                </span>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent pb-4">
                  Share Anything.
                  <br />
                  Anywhere. Given.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Direct peer-to-peer file transfer. No servers. No limits. Just
                  send the link and start streaming.
                </p>
              </motion.div>

              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <FilePicker onFilesSelected={handleFilesSelected} />
              </motion.div>

              {/* Stats / Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
                {[
                  {
                    title: "Unlimited Size",
                    desc: "Share GBs or TBs direct to peer",
                  },
                  { title: "Encrypted", desc: "End-to-end DTLS encryption" },
                  {
                    title: "Lightning Fast",
                    desc: "Local network speed supported",
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl bg-muted/20 border border-border/50 text-left"
                  >
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
