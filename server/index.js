const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for P2P simplicity
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

// Store room metadata if needed (e.g. sender presence)
// Map<roomId, { senderId: string, receiverId: string }>
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Sender creates a room
  socket.on("create-room", () => {
    const roomId = uuidv4();
    rooms.set(roomId, { senderId: socket.id });
    socket.join(roomId);
    socket.emit("room-created", roomId);
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // Receiver joins a room
  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    // Limit to 2 peers: sender and receiver
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients && clients.size >= 2) {
      socket.emit("error", "Room is full");
      return;
    }

    room.receiverId = socket.id;
    socket.join(roomId);
    socket.emit("room-joined", roomId);

    // Notify sender that someone joined
    socket.to(roomId).emit("peer-joined", socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Signaling data exchange (Offer, Answer, ICE Candidates)
  socket.on("signal", ({ roomId, data }) => {
    // Relay signal to the *other* person in the room
    socket.to(roomId).emit("signal", data);
    // console.log(`Signal relay in room ${roomId} from ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Cleanup logic could go here
    // For now, if sender leaves, the room is effectively dead.
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
