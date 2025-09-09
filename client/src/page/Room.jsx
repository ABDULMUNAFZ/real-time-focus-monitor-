import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import Peer from "simple-peer";

// 🔊 Sound effects
import joinSound from "../assets/join.mp3";
import leaveSFX from "../assets/leave.mp3";
import msgSFX from "../assets/msg.mp3";

const Room = ({ user }) => {
  const { roomID } = useParams();

  const [loading, setLoading] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [msgs, setMsgs] = useState([]);

  const socket = useRef();
  const peersRef = useRef([]);
  const localVideo = useRef();

  // Connect to backend
  useEffect(() => {
    socket.current = io("https://sonic-meet-backend.onrender.com", {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    // 📩 Chat messages
    socket.current.on("message", (data) => {
      const audio = new Audio(msgSFX);
      if (user?.uid !== data.user.id) {
        audio.play();
      }
      const msg = {
        send: user?.uid === data.user.id,
        ...data,
      };
      setMsgs((msgs) => [...msgs, msg]);
    });

    if (user) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLoading(false);
          setLocalStream(stream);
          localVideo.current.srcObject = stream;

          // Join the room
          socket.current.emit("join room", {
            roomID,
            user: {
              uid: user?.uid,
              email: user?.email,
              name: user?.displayName,
              photoURL: user?.photoURL,
            },
          });

          // Existing users in the room
          socket.current.on("all users", (users) => {
            const peers = [];
            users.forEach((u) => {
              const peer = createPeer(u.userId, socket.current.id, stream);
              peersRef.current.push({
                peerID: u.userId,
                peer,
                user: u.user,
              });
              peers.push({
                peerID: u.userId,
                peer,
                user: u.user,
              });
            });
            setPeers(peers);
          });

          // New user joined
          socket.current.on("user joined", (payload) => {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current.push({
              peerID: payload.callerID,
              peer,
              user: payload.user,
            });

            setPeers((users) => [
              ...users,
              { peerID: payload.callerID, peer, user: payload.user },
            ]);
          });

          // Receiving offer
          socket.current.on("receiving signal", (payload) => {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current.push({
              peerID: payload.callerID,
              peer,
              user: payload.user,
            });

            setPeers((users) => [
              ...users,
              { peerID: payload.callerID, peer, user: payload.user },
            ]);
          });

          // Receiving answer
          socket.current.on("receiving returned signal", (payload) => {
            const item = peersRef.current.find((p) => p.peerID === payload.id);
            if (item && item.peer) {
              try {
                item.peer.signal(payload.signal);
              } catch (err) {
                console.error("⚠️ Failed to apply signal:", err);
              }
            } else {
              console.warn("⚠️ No peer found for returned signal", payload.id);
            }
          });

          // User left
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
      if (socket.current) socket.current.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [user, roomID]);

  // --- Peer Helpers ---
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

    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.error("⚠️ Failed to process incoming signal:", err);
    }

    return peer;
  };

  return (
    <div>
      {loading ? (
        <p>Loading room...</p>
      ) : (
        <div>
          <video ref={localVideo} autoPlay playsInline muted />
          {peers.map((peerObj) => (
            <Video key={peerObj.peerID} peer={peerObj.peer} />
          ))}
        </div>
      )}

      {/* Chat messages */}
      <div>
        {msgs.map((msg, i) => (
          <p key={i}>
            <b>{msg.user?.name || "Anon"}:</b> {msg.text}
          </p>
        ))}
      </div>
    </div>
  );
};

// Component to render remote video
const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return <video ref={ref} autoPlay playsInline />;
};

export default Room;
