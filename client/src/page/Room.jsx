import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

// icons
import { IoChatboxOutline as ChatIcon, IoVideocamSharp as VideoOnIcon, IoVideocamOff as VideoOffIcon, IoMic as MicOnIcon, IoMicOff as MicOffIcon } from "react-icons/io5";
import { VscTriangleDown as DownIcon } from "react-icons/vsc";
import { FaUsers as UsersIcon } from "react-icons/fa";
import { FiSend as SendIcon } from "react-icons/fi";
import { FcGoogle as GoogleIcon } from "react-icons/fc";
import { MdCallEnd as CallEndIcon, MdClear as ClearIcon } from "react-icons/md";
import { AiOutlineLink as LinkIcon, AiOutlineShareAlt as ShareIcon } from "react-icons/ai";
import { MdOutlineContentCopy as CopyToClipboardIcon } from "react-icons/md";
import { BsPin as PinIcon, BsPinFill as PinActiveIcon } from "react-icons/bs";

// QR
import { QRCode } from "react-qrcode-logo";

// framer motion
import { motion, AnimatePresence } from "framer-motion";

// importing audios
import joinSFX from "../sounds/join.mp3";
import msgSFX from "../sounds/message.mp3";
import leaveSFX from "../sounds/leave.mp3";

// simple peer + socket.io
import Peer from "simple-peer";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";
import MeetGridCard from "../components/MeetGridCard";

const Room = () => {
  const [loading, setLoading] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [share, setShare] = useState(false);
  const [pin, setPin] = useState(false);

  const [msgs, setMsgs] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [peers, setPeers] = useState([]);

  const socket = useRef();
  const peersRef = useRef([]);
  const localVideo = useRef();
  const chatScroll = useRef();
  const navigate = useNavigate();
  const { roomID } = useParams();

  const { user, login } = useAuth();
  const [participantsOpen, setParticipantsOpen] = useState(true);

  // Sounds
  const [joinSound] = useState(new Audio(joinSFX));

  const sendMessage = (e) => {
    e.preventDefault();
    if (msgText) {
      socket.current.emit("send message", {
        roomID,
        from: socket.current.id,
        user: {
          id: user?.uid,
          name: user?.displayName,
          profilePic: user?.photoURL,
        },
        message: msgText.trim(),
      });
    }
    setMsgText("");
  };

  useEffect(() => {
    socket.current = io("https://real-time-focus-monitor.onrender.com");

    socket.current.on("message", (data) => {
      const audio = new Audio(msgSFX);
      if (user?.uid !== data?.user?.id) {
        audio.play();
      }
      const msg = {
        send: user?.uid === data?.user?.id,
        ...data,
      };
      setMsgs((prev) => [...prev, msg]);
    });

    if (user) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLoading(false);
          setLocalStream(stream);
          localVideo.current.srcObject = stream;

          socket.current.emit("join room", {
            roomID,
            user: {
              uid: user?.uid,
              email: user?.email,
              name: user?.displayName,
              photoURL: user?.photoURL,
            },
          });

          socket.current.on("all users", (users) => {
            const peersList = [];
            users.forEach((u) => {
              const peer = createPeer(u.userId, socket.current.id, stream);
              peersRef.current.push({
                peerID: u.userId,
                peer,
                user: u.user || {},
              });
              peersList.push({
                peerID: u.userId,
                peer,
                user: u.user || {},
              });
            });
            setPeers(peersList);
          });

          socket.current.on("user joined", (payload) => {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current.push({
              peerID: payload.callerID,
              peer,
              user: payload.user || {},
            });
            setPeers((users) => [
              ...users,
              { peerID: payload.callerID, peer, user: payload.user || {} },
            ]);
          });

          socket.current.on("receiving returned signal", (payload) => {
            const item = peersRef.current.find((p) => p.peerID === payload.id);
            if (item?.peer) item.peer.signal(payload.signal);
          });

          socket.current.on("user left", (id) => {
            const audio = new Audio(leaveSFX);
            audio.play();
            const peerObj = peersRef.current.find((p) => p.peerID === id);
            if (peerObj) peerObj.peer.destroy();
            peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
            setPeers((users) => users.filter((p) => p.peerID !== id));
          });
        });
    }

    return () => {
      socket.current.disconnect();
    };
  }, [user, roomID]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });
    peer.on("signal", (signal) => {
      socket.current.emit("sending signal", {
        userToSignal,
        callerID,
        signal,
        user: {
          uid: user?.uid,
          email: user?.email,
          name: user?.displayName,
          photoURL: user?.photoURL,
        },
      });
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });
    peer.on("signal", (signal) => {
      socket.current.emit("returning signal", { signal, callerID });
    });
    joinSound.play();
    if (incomingSignal) peer.signal(incomingSignal);
    return peer;
  };

  return (
    <>
      {user ? (
        <AnimatePresence>
          {loading ? (
            <div className="bg-lightGray">
              <Loading />
            </div>
          ) : (
            <motion.div layout className="flex flex-row bg-darkBlue2 text-white w-full">
              <motion.div layout className="flex flex-col bg-darkBlue2 justify-between w-full">
                {/* Video Grid */}
                <div
                  className="flex-shrink-0 overflow-y-scroll p-3"
                  style={{ height: "calc(100vh - 128px)" }}
                >
                  <motion.div
                    layout
                    className={`grid grid-cols-1 gap-4 ${
                      showChat ? "md:grid-cols-2" : "lg:grid-cols-3 sm:grid-cols-2"
                    }`}
                  >
                    {/* Local Video */}
                    <motion.div
                      layout
                      className={`relative bg-lightGray rounded-lg aspect-video overflow-hidden ${
                        pin && "md:col-span-2 md:row-span-2 md:col-start-1 md:row-start-1"
                      }`}
                    >
                      <div className="absolute top-4 right-4 z-20">
                        <button
                          onClick={() => setPin(!pin)}
                          className={`${
                            pin ? "bg-blue border-transparent" : "bg-slate-800/70 border-gray"
                          } md:border-2 border-[1px] aspect-square p-2 rounded-lg text-white`}
                        >
                          {pin ? <PinActiveIcon /> : <PinIcon />}
                        </button>
                      </div>

                      <video
                        ref={localVideo}
                        muted
                        autoPlay
                        playsInline
                        className="h-full w-full object-cover rounded-lg"
                      />
                      {!videoActive && (
                        <div className="absolute top-0 left-0 bg-lightGray h-full w-full flex items-center justify-center">
                          <img
                            className="h-[35%] max-h-[150px] w-auto rounded-full object-cover"
                            src={user?.photoURL}
                            alt={user?.displayName || "You"}
                          />
                        </div>
                      )}
                    </motion.div>

                    {/* Remote Peers */}
                    {peers.map((peerObj) => (
                      <MeetGridCard
                        key={peerObj?.peerID}
                        user={peerObj?.user || {}}
                        peer={peerObj?.peer}
                      />
                    ))}
                  </motion.div>
                </div>

                {/* Bottom Controls */}
                <div className="w-full h-16 bg-darkBlue1 border-t-2 border-lightGray p-3 flex justify-between">
                  <div className="flex gap-2">
                    {/* Mic */}
                    <button
                      className={`${
                        micOn ? "bg-blue" : "bg-slate-800/70 border-gray"
                      } border-2 p-2 rounded-lg text-white`}
                      onClick={() => {
                        const audioTrack = localStream?.getAudioTracks()[0];
                        if (audioTrack) audioTrack.enabled = !micOn;
                        setMicOn(!micOn);
                      }}
                    >
                      {micOn ? <MicOnIcon /> : <MicOffIcon />}
                    </button>
                    {/* Video */}
                    <button
                      className={`${
                        videoActive ? "bg-blue" : "bg-slate-800/70 border-gray"
                      } border-2 p-2 rounded-lg text-white`}
                      onClick={() => {
                        const videoTrack = localStream
                          ?.getTracks()
                          .find((track) => track.kind === "video");
                        if (videoTrack) videoTrack.enabled = !videoActive;
                        setVideoActive(!videoActive);
                      }}
                    >
                      {videoActive ? <VideoOnIcon /> : <VideoOffIcon />}
                    </button>
                  </div>

                  {/* End Call */}
                  <button
                    className="py-2 px-4 flex items-center gap-2 rounded-lg bg-red"
                    onClick={() => {
                      navigate("/");
                      window.location.reload();
                    }}
                  >
                    <CallEndIcon size={20} />
                    <span className="hidden sm:block text-xs">End Call</span>
                  </button>

                  <div className="flex gap-2">
                    {/* Share */}
                    <button
                      className="bg-slate-800/70 border-gray border-2 p-2 rounded-lg text-white"
                      onClick={() => setShare(true)}
                    >
                      <ShareIcon size={22} />
                    </button>
                    {/* Chat */}
                    <button
                      className={`${
                        showChat ? "bg-blue" : "bg-slate-800/70 border-gray"
                      } border-2 p-2 rounded-lg text-white`}
                      onClick={() => setShowChat(!showChat)}
                    >
                      <ChatIcon />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Chat + Participants */}
              {showChat && (
                <motion.div
                  layout
                  className="flex flex-col w-[30%] border-l-2 border-lightGray"
                >
                  {/* Participants */}
                  <div
                    className="flex items-center p-3 cursor-pointer bg-darkBlue1 border-b-2 border-gray"
                    onClick={() => setParticipantsOpen(!participantsOpen)}
                  >
                    <UsersIcon />
                    <span className="ml-2 text-sm">Participants</span>
                    <DownIcon
                      className={`ml-auto transition-all ${
                        participantsOpen && "rotate-180"
                      }`}
                    />
                  </div>
                  {participantsOpen && (
                    <div className="p-2 bg-blue-600 max-h-[50vh] overflow-y-scroll">
                      <div className="flex items-center gap-2 p-2 bg-gray rounded-lg">
                        <img
                          src={
                            user?.photoURL ||
                            "https://parkridgevet.com.au/wp-content/uploads/2020/11/Profile-300x300.png"
                          }
                          alt={user?.displayName || "You"}
                          className="w-8 h-8 rounded-full"
                        />
                        <span>{user?.displayName || "You"}</span>
                      </div>
                      {peers.map((p) => (
                        <div
                          key={p.peerID}
                          className="flex items-center gap-2 p-2 bg-gray rounded-lg mt-2"
                        >
                          <img
                            src={
                              p?.user?.photoURL ||
                              "https://parkridgevet.com.au/wp-content/uploads/2020/11/Profile-300x300.png"
                            }
                            alt={p?.user?.name || "Anonymous"}
                            className="w-8 h-8 rounded-full"
                          />
                          <span>{p?.user?.name || "Anonymous"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chat */}
                  <div className="flex-grow overflow-y-scroll p-3">
                    {msgs.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 mb-2 ${
                          msg?.user?.id === user?.uid ? "flex-row-reverse" : ""
                        }`}
                      >
                        <img
                          src={
                            msg?.user?.profilePic ||
                            "https://parkridgevet.com.au/wp-content/uploads/2020/11/Profile-300x300.png"
                          }
                          alt={msg?.user?.name || "Anonymous"}
                          className="w-8 h-8 rounded-full"
                        />
                        <p className="bg-darkBlue1 py-2 px-3 text-xs rounded-lg border-2 border-lightGray">
                          {msg?.message}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={sendMessage} className="p-3 bg-darkBlue1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        placeholder="Enter message..."
                        className="flex-grow p-2 rounded-lg text-darkBlue1"
                      />
                      <button className="bg-blue p-2 rounded-lg">
                        <SendIcon />
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Share Link Modal */}
          {share && (
            <div className="fixed inset-0 bg-slate-800/60 flex justify-center items-center z-30">
              <div className="bg-white p-3 rounded shadow max-w-[500px] w-full">
                <div className="flex justify-between items-center">
                  <span>Share this link</span>
                  <ClearIcon className="cursor-pointer" onClick={() => setShare(false)} />
                </div>
                <div className="flex items-center gap-2 bg-slate-200 p-2 my-3 rounded">
                  <LinkIcon />
                  <span className="flex-grow text-xs truncate">{window.location.href}</span>
                  <CopyToClipboardIcon
                    className="cursor-pointer"
                    onClick={() =>
                      navigator.clipboard.writeText(window.location.href)
                    }
                  />
                </div>
                <QRCode value={window.location.href} size={200} />
              </div>
            </div>
          )}
        </AnimatePresence>
      ) : (
        <div className="h-full bg-darkBlue2 flex items-center justify-center">
          <button
            className="flex items-center gap-2 p-2 pr-3 rounded text-white bg-blue"
            onClick={login}
          >
            <div className="p-2 bg-white rounded">
              <GoogleIcon size={24} />
            </div>
            Login with Google
          </button>
        </div>
      )}
    </>
  );
};

export default Room;
