const express = require("express");
const http = require("http");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: process.env.ORIGIN || "https://your-frontend.vercel.app", // replace with your Vercel URL
    methods: ["GET", "POST"],
  },
});

const users = {};
const socketToRoom = {};

const PORT = process.env.PORT || 5000;

// Socket.IO connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room
  socket.on("join room", ({ roomID, user }) => {
    if (users[roomID]) {
      users[roomID].push({ userId: socket.id, user });
    } else {
      users[roomID] = [{ userId: socket.id, user }];
    }
    socketToRoom[socket.id] = roomID;

    const usersInThisRoom = users[roomID].filter(
      (u) => u.userId !== socket.id
    );

    socket.emit("all users", usersInThisRoom);
  });

  // Sending signal (WebRTC offer)
  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
      user: payload.user,
    });
  });

  // Returning signal (WebRTC answer)
  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  // Chat message
  socket.on("send message", (payload) => {
    io.emit("message", payload);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const roomID = socketToRoom[socket.id];
    if (roomID && users[roomID]) {
      users[roomID] = users[roomID].filter(
        (u) => u.userId !== socket.id
      );
    }
    socket.broadcast.emit("user left", socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
