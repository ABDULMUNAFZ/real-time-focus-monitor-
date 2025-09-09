useEffect(() => {
  const unsub = () => {
    socket.current = io.connect(
      "https://real-time-focus-monitor.onrender.com"
      // process.env.SOCKET_BACKEND_URL || "http://localhost:5000"
    );

    // 📩 Handle chat messages
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

    if (user)
      navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: true,
        })
        .then((stream) => {
          setLoading(false);
          setLocalStream(stream);
          localVideo.current.srcObject = stream;

          // 🔗 Join room
          socket.current.emit("join room", {
            roomID,
            user: {
              uid: user?.uid,
              email: user?.email,
              name: user?.displayName,
              photoURL: user?.photoURL,
            },
          });

          // 🟢 Existing users in the room
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

          // 🟢 A new user joined
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

          // 🟢 Receiving WebRTC offer
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

          // 🟢 Receiving WebRTC answer
          socket.current.on("receiving returned signal", (payload) => {
            const item = peersRef.current.find(
              (p) => p.peerID === payload.id
            );
            if (item) item.peer.signal(payload.signal);
          });

          // ❌ Someone left
          socket.current.on("user left", (id) => {
            const audio = new Audio(leaveSFX);
            audio.play();
            const peerObj = peersRef.current.find((p) => p.peerID === id);
            if (peerObj) peerObj.peer.destroy();
            peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
            setPeers((users) => users.filter((p) => p.peerID !== id));
          });
        });
  };
  return unsub();
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
  peer.signal(incomingSignal);
  return peer;
};
