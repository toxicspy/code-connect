import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSockets = new Map();

const emitToUser = (userId, event, payload) => {
  const socketId = userSockets.get(userId);
  if (!socketId) return false;
  io.to(socketId).emit(event, payload);
  return true;
};

io.on("connection", (socket) => {
  socket.on("registerUser", ({ userId }) => {
    if (!userId) return;
    userSockets.set(userId, socket.id);
    socket.data.userId = userId;
  });

  socket.on("callUser", ({ toUserId, fromUserId, fromName, callType, offer }) => {
    if (!toUserId || !fromUserId || !offer) return;

    const delivered = emitToUser(toUserId, "incomingCall", {
      toUserId,
      fromUserId,
      fromName,
      callType,
      offer,
    });

    if (!delivered) {
      emitToUser(fromUserId, "callUnavailable", {
        toUserId,
        reason: "offline",
      });
    }
  });

  socket.on("acceptCall", ({ toUserId, fromUserId, answer, callType }) => {
    if (!toUserId || !fromUserId || !answer) return;
    emitToUser(toUserId, "callAccepted", {
      fromUserId,
      answer,
      callType,
    });
  });

  socket.on("rejectCall", ({ toUserId, fromUserId, reason }) => {
    if (!toUserId || !fromUserId) return;
    emitToUser(toUserId, "callRejected", {
      fromUserId,
      reason: reason || "rejected",
    });
  });

  socket.on("endCall", ({ toUserId, fromUserId }) => {
    if (!toUserId || !fromUserId) return;
    emitToUser(toUserId, "callEnded", {
      fromUserId,
    });
  });

  socket.on("iceCandidate", ({ toUserId, fromUserId, candidate }) => {
    if (!toUserId || !fromUserId || !candidate) return;
    emitToUser(toUserId, "iceCandidate", {
      fromUserId,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    if (socket.data.userId) {
      userSockets.delete(socket.data.userId);
    }
  });
});

const port = Number(process.env.PORT || 3001);
server.listen(port, "0.0.0.0", () => {
  console.log(`Call signaling server running on http://0.0.0.0:${port}`);
});
