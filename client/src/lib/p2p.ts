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
    this.socket = io(url);
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to signaling server");
    });

    this.socket.on("room-created", (roomId: string) => {
      this.roomId = roomId;
      this.isInitiator = true;
      this.emit("connected", { roomId, role: "sender" });
    });

    this.socket.on("room-joined", (roomId: string) => {
      this.roomId = roomId;
      this.isInitiator = false;
      this.emit("connected", { roomId, role: "receiver" });
      // Receiver initiates the peer connection in this implementation?
      // Actually usually Initiator (Sender) starts.
      // Let's checking 'peer-joined' event.
    });

    this.socket.on("peer-joined", (peerId: string) => {
      console.log(`Peer ${peerId} joined. Starting WebRTC...`);
      // If we are sender, and peer joins, we start the offer.
      this.initializePeer(true);
    });

    this.socket.on("signal", (data: SignalData) => {
      if (this.peer) {
        this.peer.signal(data);
      } else {
        // If we are receiver, we might receive an offer before we created the peer.
        // But usually receiver creates peer non-initiator immediately upon join?
        // Let's handle it: if no peer, create one as non-initiator
        if (!this.isInitiator) {
          this.initializePeer(false);
          this.peer!.signal(data);
        }
      }
    });

    this.socket.on("error", (err: string) => {
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
    this.peer = new SimplePeer({
      initiator,
      trickle: true, // Enable trickle ICE for faster/robust connection
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
      },
    });

    this.peer.on("signal", (data) => {
      this.socket.emit("signal", { roomId: this.roomId, data });
    });

    this.peer.on("connect", () => {
      console.log("P2P Connection Established!");
      this.emit("connected", { p2p: true });
    });

    this.peer.on("data", (data) => {
      this.emit("data", data);
    });

    this.peer.on("error", (err) => {
      console.error("Peer error:", err);
      this.emit("error", err);
    });

    this.peer.on("close", () => {
      this.emit("close");
    });
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
