class SignalingChannel {
    constructor(signaling) {
        this.signaling = signaling;
    }

    send(message) {
        this.signaling.send(JSON.stringify({data: message}));
    }

    set onmessage(handler) {
        this.signaling.onmessage = ({data}) => {
            handler(JSON.parse(data));
        };
    }
}

const QUERY_PARAM_ROOM_NAME = 'room';
const generateQueryParam = (queryParamKey, queryParamValue) => new URLSearchParams({[queryParamKey]: queryParamValue}).toString();

const main = (room) => {
    const roomQueryParam = generateQueryParam(QUERY_PARAM_ROOM_NAME, room);
    const ws = new WebSocket(`wss://wss-signaling.herokuapp.com/${roomQueryParam && `?${roomQueryParam}`}`);

    let polite = true;
    const signaling = new SignalingChannel(ws);

    const constraints = {audio: true, video: true};
    const configuration = {
        iceServers: [
            {url: 'stun:stun.l.google.com:19302'},
            {url: 'stun:stun1.l.google.com:19302'},
            {url: 'stun:stun2.l.google.com:19302'},
            {url: 'stun:stun3.l.google.com:19302'},
            {
                urls: 'turn:numb.viagenie.ca',
                credential: '9u7prU:2}R{Sut~.)d[bP7,;Pgc\'Pa',
                username: 'fkrveacbukypqsqyaq@miucce.com'
            },
        ],
    };

    const pc = new RTCPeerConnection(configuration);

// call start() anytime on either end to add camera and microphone to connection
    const start = async () => {
        startBtn.disabled = true;
        polite = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            localVideo.srcObject = stream;
        } catch (err) {
            console.error(err);
        }
    }

    startBtn.onclick = start;

    pc.ontrack = ({track, streams}) => {
        // once media for a remote track arrives, show it in the remote video element
        track.onunmute = () => {
            // don't set srcObject again if it is already set.
            if (remoteVideo.srcObject) {
                return;
            }
            remoteVideo.srcObject = streams[0];
        };
    };

// - The perfect negotiation logic, separated from the rest of the application ---

// keep track of some negotiation state to prevent races and errors
    let makingOffer = false;
    let ignoreOffer = false;
    let isSettingRemoteAnswerPending = false;

// send any ice candidates to the other peer
    pc.onicecandidate = ({candidate}) => {
        signaling.send({candidate});
    }

// let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = async () => {
        try {
            makingOffer = true;
            await pc.setLocalDescription();
            signaling.send({description: pc.localDescription});
        } catch (err) {
            console.error(err);
        } finally {
            makingOffer = false;
        }
    };

    signaling.onmessage = async ({data, data: {description, candidate}}) => {
        console.log(data);

        try {
            if (description) {
                // An offer may come in while we are busy processing SRD(answer).
                // In this case, we will be in "stable" by the time the offer is processed
                // so it is safe to chain it on our Operations Chain now.
                const readyForOffer =
                    !makingOffer &&
                    (pc.signalingState === "stable" || isSettingRemoteAnswerPending);
                const offerCollision = description.type === "offer" && !readyForOffer;

                ignoreOffer = !polite && offerCollision;
                if (ignoreOffer) {
                    return;
                }
                isSettingRemoteAnswerPending = description.type === "answer";
                await pc.setRemoteDescription(description); // SRD rolls back as needed
                isSettingRemoteAnswerPending = false;
                if (description.type === "offer") {
                    await pc.setLocalDescription();
                    signaling.send({description: pc.localDescription});
                }
            } else if (candidate) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (err) {
                    if (!ignoreOffer) {
                        throw err;
                    } // Suppress ignored offer's candidates
                }
            }
        } catch (err) {
            console.error(err);
        }
    };
};

/* TODO get rooms amount from server? */
Array.from(({length: 3}),
    (_, idx) => idx + 1)
    .map((idx) => {
        const room = idx.toString();

        const option = new Option(room, room);
        roomSelect.append(option);
    });

startBtn.disabled = true;

roomSelect.addEventListener('change', (e) => {
    const room = e.target.value;
    roomSelect.disabled = true;
    startBtn.disabled = false;

    main(room);
});
