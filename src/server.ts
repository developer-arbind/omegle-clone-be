import express,{ Request, Response} from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
import { Server, Socket } from "socket.io";
const PORT = process.env.PORT;
const server = http.createServer(app);
app.use(express.json());

interface corsType {
  origin: string | undefined,
  methods: Array<"POST" | "GET" | "PUT" | "DELETE">
}

const xrss: corsType = {
  origin: process.env.OMEGLE_HOST,
  methods: ["POST", "GET", "PUT", "DELETE"],
};
app.use(cors(xrss));
const io = new Server(server, {
  cors: xrss,
});

server.listen(PORT, () => console.log("omegle backend running on " + PORT));

type roomBucket = {
  id: string,
  secondPersonId: string
}
let roomBucket: Array<roomBucket> = [];

type socketUser = string;

class RoomManagment {
  private socketId: socketUser;
  private socket: Socket;
  constructor(socketId:socketUser, socket:Socket) {
    this.socketId = socketId;
    this.socket = socket;
  }
  removeUser(user2:socketUser ) {
    this.joinRoom(user2);
  }
  findUser(interest: Array<String> | string) {
    console.log("finding user...");
    this.socket.broadcast.emit("who:is:on:queue", this.socketId, interest);
  }
  joinRoom(user2: socketUser) {
    if (roomBucket.length > 1)
      this.socket.leave(roomBucket[roomBucket.length - 1].secondPersonId);

    io.to(user2).emit("user:joined", this.socketId);
    this.socket.emit("you:joined", user2);
    roomBucket.push({
      id: this.socketId,
      secondPersonId: user2,
    });
  }

  sendMessage(text: string, user2: socketUser) {
    console.log(
      `your id: ${this.socketId} and this is the socket where you sending the message ${user2}`
    );
    io.to(user2).emit("get:text", text);
  }
  leaveTheRoom(user2: socketUser) {
    io.to(user2).emit("user:disconnect");
  }
  makeTyping(user2: socketUser) {
    io.to(user2).emit("user:tpying");
  }
  userStoppedTyping(user2: socketUser) {
    io.to(user2).emit("stoped:typing");
  }
  sendOffer(user2: socketUser, offer: RTCSessionDescription | undefined) {
    io.to(user2).emit("get:remote:offer", offer);
  }
  sendBackAnswer(user2: socketUser, ans: RTCSessionDescription | undefined) {
    console.log("it is answer: ", ans);
    io.to(user2).emit("get:remote:ans", ans);
  }
  sendNegotiationOffer(user2: socketUser, offer: RTCSessionDescription | undefined) {
    io.to(user2).emit("get:negotiation", offer);
  }
  sendBackNegotiationAns(user2: socketUser, ans: RTCSessionDescription | undefined) {
    io.to(user2).emit("get:negotiation:ans", ans);
  }
}

interface textPayload {
  text: string,
  roomId: socketUser
}
interface SDPsType {
  offer?: RTCSessionDescription
  ans?: RTCSessionDescription,
  user2: socketUser
}
io.on("connection", async (socket: Socket) : Promise<void> => {
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
  socket.on("is:already:talked", (user2 : socketUser) => handlers.removeUser(user2));
  socket.on("send:text", ({ text, roomId }: textPayload) =>
    handlers.sendMessage(text, roomId)
  );
  socket.on("user:disconnect", (user2: socketUser) => handlers.leaveTheRoom(user2));
  socket.on("wait:on:queue", (interest: Array<String> | string) => handlers.findUser(interest));

  socket.on("typing", (user2: socketUser) => handlers.makeTyping(user2));

  socket.on("user:stopped:typing", (user2: socketUser) =>
    handlers.userStoppedTyping(user2)
  );

  socket.on("send:answer", ({ ans, user2 }: SDPsType) =>
    handlers.sendBackAnswer(user2, ans)
  );

  socket.on("send:offer", ({ user2, offer }: SDPsType) =>
    handlers.sendOffer(user2, offer)
  );

  socket.on("send:negotiation", ({ user2, offer }: SDPsType) =>
    handlers.sendNegotiationOffer(user2, offer)
  );

  socket.on("send:active:stream", ({ user2 }: {user2: socketUser}) =>
    io.to(user2).emit("activate:remote:stream")
  );

  socket.on("track:ready", (user2: socketUser) => io.to(user2).emit("send:track:to:user2"));

  socket.on("negotiation:done", ({ user2, ans }: SDPsType) =>
    handlers.sendBackNegotiationAns(user2, ans)
  );
});

app.get("/api/start", (Req: Request, Res: Response ) => {
  return Res.send("server-started");
});
app.get("/", (Req: Request, Res: Response ) => {
  return Res.send("hello-world");
});