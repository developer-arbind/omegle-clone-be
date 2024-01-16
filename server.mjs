import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
import { Server } from "socket.io";
const PORT = process.env.PORT;
const server = http.createServer(app);
app.use(express.json());
const xrss = {
  origin: process.env.CLIENT_HOST,
  methods: ["POST", "GET", "PUT", "DELETE"],
};
app.use(cors(xrss));
const io = new Server(server, {
  cors: xrss,
});
server.listen(PORT, () => console.log("omegle backend running on " + PORT));
let roomBucket = [];

class RoomManagment {
  constructor(socketId, socket) {
    this.socketId = socketId;
    this.socket = socket;
  }
  removeUser(user2) {
    this.joinRoom(user2);
  }
  findUser(interest) {
    console.log("finding user...");
    this.socket.broadcast.emit("who:is:on:queue", this.socketId, interest);
  }
  joinRoom(user2) {
    if (roomBucket.length > 1)
      this.socket.leave(roomBucket[roomBucket.length - 1].secondPerson);

    io.to(user2).emit("user:joined", this.socketId);
    this.socket.emit("you:joined", user2);
    roomBucket.push({
      id: this.socketId,
      secondPersonId: user2,
    });
  }

  sendMessage(text, user2) {
    console.log(
      `your id: ${this.socketId} and this is the socket where you sending the message ${user2}`
    );
    io.to(user2).emit("get:text", text);
  }
  leaveTheRoom(user2) {
    io.to(user2).emit("user:disconnect");
  }
  makeTyping(user2) {
    io.to(user2).emit("user:tpying");
  }
  userStoppedTyping(user2) {
    io.to(user2).emit("stoped:typing");
  }
  sendOffer(user2, offer) {
    io.to(user2).emit("get:remote:offer", offer);
  }
  sendBackAnswer(user2, ans) {
    console.log("it is answer: ", ans);
    io.to(user2).emit("get:remote:ans", ans);
  }
  sendNegotiationOffer(user2, offer) {
    io.to(user2).emit("get:negotiation", offer);
  }
  sendBackNegotiationAns(user2, ans) {
    io.to(user2).emit("get:negotiation:ans", ans);
  }
}
io.on("connection", async (socket) => {
  console.log("connected");

  const allSockets = await io.fetchSockets();
  socket.on("updateNumber", () => {
    socket.broadcast.emit("online:peoples", allSockets.length);
    socket.emit("online:peoples", allSockets.length);
  });
  socket.on("disconnect", () => {
    socket.broadcast.emit("user:disconnect:from:server", allSockets.length);
  });
  const handlers = new RoomManagment(socket.id, socket);
  socket.join(socket.id);
  socket.emit("connected", socket.id);
  socket.on("is:already:talked", (user2) => handlers.removeUser(user2));
  socket.on("send:text", ({ text, roomId }) =>
    handlers.sendMessage(text, roomId)
  );
  socket.on("user:disconnect", (user2) => handlers.leaveTheRoom(user2));
  socket.on("wait:on:queue", (interest) => handlers.findUser(interest));

  socket.on("typing", (user2) => handlers.makeTyping(user2));

  socket.on("user:stopped:typing", (user2) =>
    handlers.userStoppedTyping(user2)
  );

  socket.on("send:answer", ({ ans, user2 }) =>
    handlers.sendBackAnswer(user2, ans)
  );

  socket.on("send:offer", ({ user2, offer }) =>
    handlers.sendOffer(user2, offer)
  );

  socket.on("send:negotiation", ({ user2, offer }) =>
    handlers.sendNegotiationOffer(user2, offer)
  );

  socket.on("send:active:stream", ({ user2 }) =>
    io.to(user2).emit("activate:remote:stream")
  );

  socket.on("track:ready", (user2) => io.to(user2).emit("send:track:to:user2"));

  socket.on("negotiation:done", ({ user2, ans }) =>
    handlers.sendBackNegotiationAns(user2, ans)
  );
});
app.get("/", (Req, Res) =>
  Res.status(200).json({
    message: "no rest api here! 404",
  })
);
