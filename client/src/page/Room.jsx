const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ✅ Allow both production (Vercel) and local development
const allowedOrigins = [
  "https://real-time-focus-monitor.vercel.app",
  "http://localhost:3000"
];

// ✅ Express CORS
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true
}));

// ✅ Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"] // use websocket first, fallback to polling
});

// ✅ Socket.io events
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join room", ({ roomID, user }) => {
    socket.join(roomID);

    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
      .filter(id => id !== socket.id)
      .map(id => ({ userId: id }));

    socket.emit("all users", usersInRoom);
    socket.to(roomID).emit("user joined", { userId: socket.id, user });
  });

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", payload);
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", payload);
  });

  socket.on("send message", ({ roomID, message }) => {
    socket.to(roomID).emit("message", message);
  });

  socket.on("disconnect", () => {
    // Ensure socket.rooms is iterable
    if (socket.rooms) {
      for (const roomID of socket.rooms) {
        if (roomID !== socket.id) {
          socket.to(roomID).emit("user left", socket.id);
        }
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
