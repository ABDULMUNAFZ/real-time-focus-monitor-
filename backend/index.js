const express = require("express");
const http = require("http");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");

// Allow your Vercel frontend
app.use(cors({
  origin: "https://real-time-focus-monitor.vercel.app",
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: "https://real-time-focus-monitor.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // When user joins a room
  socket.on("join room", ({ roomID, user }) => {
    socket.join(roomID);

    // Get all existing users in the room except this one
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
      .filter(id => id !== socket.id)
      .map(id => ({ userId: id }));

    // Send list of users to the new user
    socket.emit("all users", usersInRoom);

    // Notify others that a new user joined
    socket.to(roomID).emit("user joined", { callerID: socket.id, user });
  });

  // When a user sends a WebRTC offer (signal) to another user
  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("receiving signal", {
      signal: payload.signal,
      callerID: payload.callerID
    });
  });

  // When the target user responds with an answer (returning signal)
  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id
    });
  });

  // Chat messages inside the room
  socket.on("send message", ({ roomID, message }) => {
    socket.to(roomID).emit("message", message);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    socket.rooms.forEach(roomID => {
      socket.to(roomID).emit("user left", socket.id);
    });
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
