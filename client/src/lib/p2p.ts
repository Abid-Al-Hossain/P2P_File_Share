import io, { Socket } from "socket.io-client";
import SimplePeer, {
  type Instance as PeerInstance,
  type SignalData,
} from "simple-peer";

// P2P Events
type P2PEvent =
  | "connected"
  | "data"
  | "stream"
  | "close"
  | "error"
  | "signal"
  | "progress";

export interface FileMetadata {
  id: string; // uuid
  name: string;
  size: number;
  type: string;
  path: string; // relative path
}

export class P2PClient {
  socket: Socket;
  peer: PeerInstance | null = null;
  roomId: string | null = null;
  isInitiator: boolean = false;

  // Callbacks
  private listeners: Map<string, Function[]> = new Map();

  constructor(serverUrl?: string) {
    // Use environment variable in production, fallback to localhost for dev
    const url =
      serverUrl ||
      import.meta.env.VITE_SIGNALING_URL ||
      "http://localhost:3000";

    this.socket = io(url, {
      transports: ["websocket", "polling"], // Prefer WebSocket, fallback to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("[Socket] Connected to signaling server");
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
    });

    this.socket.on("room-created", (roomId: string) => {
      console.log(`[Socket] Room created: ${roomId}`);
      this.roomId = roomId;
      this.isInitiator = true;
      this.emit("connected", { roomId, role: "sender" });
    });

    this.socket.on("room-joined", (roomId: string) => {
      console.log(`[Socket] Joined room: ${roomId}`);
      this.roomId = roomId;
      this.isInitiator = false;
      this.emit("connected", { roomId, role: "receiver" });
    });

    this.socket.on("peer-joined", (peerId: string) => {
      console.log(
        `[Socket] Peer ${peerId} joined. Starting WebRTC as INITIATOR...`,
      );
      // If we are sender, and peer joins, we start the offer.
      this.initializePeer(true);
    });

    this.socket.on("signal", (data: SignalData) => {
      console.log(`[Socket] Received signal: ${data.type || "candidate"}`);
      if (this.peer) {
        this.peer.signal(data);
      } else {
        // If we are receiver, we might receive an offer before we created the peer.
        if (!this.isInitiator) {
          console.log("[Socket] No peer exists, creating as RECEIVER...");
          this.initializePeer(false);
          this.peer!.signal(data);
        } else {
          console.warn(
            "[Socket] Received signal but no peer and we are initiator - ignoring",
          );
        }
      }
    });

    this.socket.on("error", (err: string) => {
      console.error("[Socket] Error:", err);
      this.emit("error", err);
    });
  }

  createRoom() {
    this.socket.emit("create-room");
  }

  joinRoom(roomId: string) {
    this.socket.emit("join-room", roomId);
  }

  private initializePeer(initiator: boolean) {
    console.log(
      `[P2P] Initializing peer as ${initiator ? "INITIATOR" : "RECEIVER"}`,
    );

    this.peer = new SimplePeer({
      initiator,
      trickle: true, // Enable trickle ICE for faster/robust connection
      config: {
        iceServers: [
          // Multiple STUN servers for redundancy
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          { urls: "stun:stun.relay.metered.ca:80" },
          // TURN servers - Open Relay static auth (ports 80/443 for firewall bypass)
          {
            urls: "turn:a.relay.metered.ca:80",
            username: "e8dd65b92c62d5e89cb4e7c5",
            credential: "uWdWNmkhvyqTmhWr",
          },
          {
            urls: "turn:a.relay.metered.ca:80?transport=tcp",
            username: "e8dd65b92c62d5e89cb4e7c5",
            credential: "uWdWNmkhvyqTmhWr",
          },
          {
            urls: "turn:a.relay.metered.ca:443",
            username: "e8dd65b92c62d5e89cb4e7c5",
            credential: "uWdWNmkhvyqTmhWr",
          },
          {
            urls: "turns:a.relay.metered.ca:443?transport=tcp",
            username: "e8dd65b92c62d5e89cb4e7c5",
            credential: "uWdWNmkhvyqTmhWr",
          },
        ],
        iceCandidatePoolSize: 10,
      },
    });

    this.peer.on("signal", (data) => {
      console.log(`[P2P] Sending signal: ${data.type || "candidate"}`);
      this.socket.emit("signal", { roomId: this.roomId, data });
    });

    this.peer.on("connect", () => {
      console.log("[P2P] ✓ P2P Connection Established!");
      this.emit("connected", { p2p: true });
    });

    this.peer.on("data", (data) => {
      this.emit("data", data);
    });

    this.peer.on("error", (err) => {
      console.error("[P2P] Peer error:", err);
      this.emit("error", err);
    });

    this.peer.on("close", () => {
      console.log("[P2P] Peer connection closed");
      this.emit("close");
    });

    // Debug: Log ICE connection state changes via the underlying RTCPeerConnection
    const pc = (this.peer as any)._pc as RTCPeerConnection | undefined;
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`[P2P] ICE connection state: ${pc.iceConnectionState}`);
      };
      pc.onicegatheringstatechange = () => {
        console.log(`[P2P] ICE gathering state: ${pc.iceGatheringState}`);
      };
      pc.onconnectionstatechange = () => {
        console.log(`[P2P] Connection state: ${pc.connectionState}`);
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            `[P2P] ICE candidate: ${event.candidate.type} - ${event.candidate.address || "relay"}`,
          );
        }
      };
    }
  }

  send(data: any) {
    if (this.peer && this.peer.connected) {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        this.peer.send(data as any);
      } else {
        this.peer.send(JSON.stringify(data));
      }
    }
  }

  // Event Emitter logic
  on(event: P2PEvent, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: P2PEvent, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback),
      );
    }
  }

  emit(event: P2PEvent, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in P2P event listener for '${event}':`, err);
        }
      });
    }
  }

  destroy() {
    this.socket.disconnect();
    if (this.peer) this.peer.destroy();
  }
}
