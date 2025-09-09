const express = require("express");
const http = require("http");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: process.env.ORIGIN || "https://your-frontend.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  },
});

const PORT = process.env.PORT || 5000;

// Socket.IO connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room
  socket.on("join room", ({ roomID, user }) => {
    socket.join(roomID); // add socket to the room
    console.log(`${user} joined room ${roomID}`);

    // Get all other users in the room
    const usersInThisRoom = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
      .filter(id => id !== socket.id)
      .map(id => ({ userId: id }));

    // Send existing users in the room to the new user
    socket.emit("all users", usersInThisRoom);

    // Notify others in the room that a new user joined
    socket.to(roomID).emit("user joined", { userId: socket.id, user });
  });

  // Sending WebRTC signal (offer)
  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
      user: payload.user,
    });
  });

  // Returning WebRTC signal (answer)
  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  // Chat message in room
  socket.on("send message", ({ roomID, message }) => {
    socket.to(roomID).emit("message", message);
  });

  // Disconnect
  socket.on("disconnect", () => {
    // Notify all rooms this socket was in
    socket.rooms.forEach((roomID) => {
      socket.to(roomID).emit("user left", socket.id);
    });
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
