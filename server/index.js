require("dotenv").config(); // Must be first — loads env vars before anything else

const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const http      = require("http");
const socketIo  = require("socket.io");
const mongoose  = require("mongoose");
const twilio    = require("twilio");

const mongoSanitize = require("express-mongo-sanitize");
const hpp           = require("hpp");

const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/user.js");
const quizRoutes = require("./routes/quiz.js");

const app    = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || "http://localhost:3000").split(",");

const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

const PORT       = process.env.PORT || 6036;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/groupchat_quiz";

mongoose
  .connect(MONGODB_URI, {})
  .then(async () => {
    console.log("MongoDB connected successfully");
    // Drop stale unique index on 'email' left over from an old schema version.
    // The current User schema has no email field, so this index causes
    // E11000 duplicate key errors when multiple users have email: null.
    try {
      await mongoose.connection.collection("users").dropIndex("email_1");
      console.log("Dropped stale index: email_1");
    } catch (e) {
      // Index doesn't exist — nothing to do
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

const accountSid        = process.env.TWILIO_ACCOUNT_SID;
const authToken         = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioClient = twilio(accountSid, authToken); // fixed: was named 'client', referenced as 'twilioClient'

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(mongoSanitize({ replaceWith: "_" })); // strips MongoDB operators ($, .) from all inputs
app.use(hpp());                                // prevents HTTP parameter pollution via duplicate keys

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/send-sms", (req, res) => {
  const { message, user: sender, type, members } = req.body;

  if (type === "message.new") {
    members
      .filter((member) => member.user_id !== sender.id)
      .forEach((user) => {
        if (!user.online) {
          twilioClient.messages
            .create({
              body: `You have a new message from ${sender.fullName}: ${message.text}`,
              messagingServiceSid: messagingServiceSid,
              to: user.phoneNumber,
            })
            .then(() => console.log(`Message sent!`))
            .catch((error) =>
              console.error(`Failed to send message: ${error.message}`),
            );
        }
      });
    return res.status(200).send("Message sent");
  }
  return res.status(200).send("Not a new message request");
});

app.use("/auth", authRoutes);
app.use("/api",  userRoutes);
app.use("/quiz", quizRoutes);

const rooms = new Map();
const users = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", ({ roomId, userId, userName }) => {
    console.log(`User ${userName} (${userId}) joining room ${roomId}`);

    socket.join(roomId);
    users.set(socket.id, { userId, userName, roomId });

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    const otherUsers = Array.from(rooms.get(roomId))
      .filter((id) => id !== socket.id)
      .map((id) => ({ socketId: id, ...users.get(id) }));

    socket.emit("existing-users", otherUsers);
    socket.to(roomId).emit("user-joined", { socketId: socket.id, userId, userName });
  });

  socket.on("offer", ({ offer, to }) => {
    io.to(to).emit("offer", { offer, from: socket.id, ...users.get(socket.id) });
  });

  socket.on("answer", ({ answer, to }) => {
    io.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("toggle-media", ({ type, enabled }) => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      socket.to(user.roomId).emit("user-media-toggle", { socketId: socket.id, type, enabled });
    }
  });

  // ── Call notifications (separate from WebRTC room) ──────────────────────────
  // Clients join this room when viewing a channel to receive incoming-call alerts.
  socket.on("join-channel-notifications", ({ channelId }) => {
    socket.join(`notif:${channelId}`);
  });

  socket.on("leave-channel-notifications", ({ channelId }) => {
    socket.leave(`notif:${channelId}`);
  });

  // Caller emits this before joining the WebRTC room so others are alerted.
  socket.on("call-started", ({ channelId, callerId, callerName }) => {
    socket.to(`notif:${channelId}`).emit("incoming-call", { channelId, callerId, callerName });
  });
  // ─────────────────────────────────────────────────────────────────────────────

  socket.on("leave-room", () => handleDisconnect(socket));
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    handleDisconnect(socket);
  });

  function handleDisconnect(socket) {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(user.roomId);
          // Last person left — notify channel viewers that the call ended
          io.to(`notif:${user.roomId}`).emit("call-ended", { channelId: user.roomId });
        } else {
          socket.to(user.roomId).emit("user-left", { socketId: socket.id, userId: user.userId });
        }
      }
    }
    users.delete(socket.id);
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebRTC Signaling Server ready`);
});
