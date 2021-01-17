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
const FILE_DATA_CHANNEL_BINARY_TYPE = 'arraybuffer';
const MESSAGES_CHANNEL_NAME = 'sendDataChannel';
const END_OF_FILE_MESSAGE = 'EOF';
const generateQueryParam = (queryParamKey, queryParamValue) => new URLSearchParams({[queryParamKey]: queryParamValue}).toString();

const main = (ws) => {
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

    const onSendChannelStateChange = (e) => {
        const readyState = e.target.readyState;
        console.log('Send channel state is: %s', readyState);
    };

    let chatChannel;
    const createChatChannel = () => {
        if (chatChannel) {
            return;
        }

        const dataConstraint = null;
        chatChannel = pc.createDataChannel(MESSAGES_CHANNEL_NAME, dataConstraint);
        chatChannel.addEventListener('open', onSendChannelStateChange);
        chatChannel.addEventListener('close', onSendChannelStateChange);
        dataChannelSenderBtn.addEventListener('click', () => {
            chatChannel.send(dataChannelSender.value);
        });
    };

    dataChannelSender.addEventListener('focus', createChatChannel);

    dataChannelFileSenderBtn.addEventListener('click', () => {
        dataChannelFileSender.click();
    });

    dataChannelFileSender.addEventListener('change', (e) => {
        const [file] = e.target.files;
        const {name, size} = file;
        sendProgress.max = size;

        /*
        Label may not be longer than 65,535 bytes.
        https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel#parameters:~:text=channel.%20This%20string-,may%20not%20be%20longer%20than%2065%2C535%20bytes.
        Filename sizes may not exceed 255 bytes.
        https://www.ibm.com/support/knowledgecenter/SSEQVQ_8.1.10/client/c_cmd_filespecsyntax.html
        */
        const dataConstraint = null;
        const sendFileChannel = pc.createDataChannel(name, dataConstraint);
        sendFileChannel.binaryType = FILE_DATA_CHANNEL_BINARY_TYPE;
        /*
         Firefox cannot send a message larger than 16 Kbytes to Chrome
         https://viblast.com/blog/2015/2/5/webrtc-data-channel-message-size/#blog-body:~:text=Firefox%20cannot%20send%20a%20message%20larger%20than%2016%20Kbytes%20to%20Chrome
         Messages smaller than 16kiB can be sent without concern, as all major user agents handle them the same way. Beyond that, things get more complicated.
         https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#understanding_message_size_limits:~:text=Messages%20smaller%20than%2016kiB%20can%20be,Beyond%20that%2C%20things%20get%20more%20complicated.
        */

        const fileReader = new FileReader();
        let offset = 0;

        fileReader.addEventListener('error', (error) => {
            console.error('Error reading file: ', error)
        });

        fileReader.addEventListener('abort', (event) => {
            console.log('File reading aborted: ', event);
        });

        /* TODO find out optimal buffer size */
        // 2 ** 16 === 65535;
        const CHUNK_SIZE = pc.sctp?.maxMessageSize || 65535;
        console.log('CHUNK_SIZE=', CHUNK_SIZE);

        const readSlice = (byteOffset) => {
            console.log('readSlice', byteOffset);
            const slice = file.slice(offset, byteOffset + CHUNK_SIZE);
            fileReader.readAsArrayBuffer(slice);
        };

        fileReader.addEventListener('load', (e) => {
            console.log('FileReader.onload', e);
            const buffer = e.target.result;
            sendFileChannel.send(buffer);

            offset += buffer.byteLength;
            sendProgress.value = offset;

            if (offset >= file.size) {
                sendFileChannel.send(END_OF_FILE_MESSAGE);
                sendFileChannel.close();
            } else if (sendFileChannel.bufferedAmount < CHUNK_SIZE / 2) {
                readSlice(offset);
            }
        });

        sendFileChannel.bufferedAmountLowThreshold = CHUNK_SIZE / 2;
        sendFileChannel.addEventListener('bufferedamountlow', () => readSlice(offset));

        sendFileChannel.onopen = () => {
            const FIRST_BYTE_SLICE_NUMBER = 0;
            readSlice(FIRST_BYTE_SLICE_NUMBER);
        };
    });

    pc.addEventListener('datachannel', ({channel}) => {
            console.log('Receive Channel Callback');

            if (channel.label === MESSAGES_CHANNEL_NAME) {
                channel.addEventListener('message', (event) => {
                    console.log('Received Message: %s', event.data);
                    sendDataChannelReceiver.value = event.data;
                });
            } else {
                const fileName = channel.label;
                let receivedFileBuffer = [];
                let receivedFileSize = 0;

                channel.binaryType = FILE_DATA_CHANNEL_BINARY_TYPE;

                channel.addEventListener('message', (event) => {
                    if (event.data === END_OF_FILE_MESSAGE) {
                        /* FIXME does this understand type application/sdp? */
                        const receivedFile = new Blob(receivedFileBuffer,/* {type: 'application/sdp'}*/);
                        receivedFileBuffer = [];
                        receivedFileSize = 0;

                        const a = dataChannelFileDownloadLink;
                        const url = URL.createObjectURL(receivedFile);
                        a.href = url;
                        a.download = fileName;
                        a.textContent = `Click to download ${fileName} (${receivedFile.size} bytes)`;
                        // a.click();
                        // URL.revokeObjectURL(url);
                        // a.remove()
                        channel.close();
                    } else {
                        receivedFileBuffer.push(event.data);
                        receivedFileSize += event.data.byteLength;
                    }
                });
            }
            channel.addEventListener('open', onSendChannelStateChange);
            channel.addEventListener('close', onSendChannelStateChange);
        }
    );

// call start() anytime on either end to add camera and microphone to connection
    /* TODO add picture-in-picture for video https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API */
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

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
            pc.restartIce();
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

    try {
        const roomQueryParam = generateQueryParam(QUERY_PARAM_ROOM_NAME, room);
        const ws = new WebSocket(`wss://wss-signaling.herokuapp.com/${roomQueryParam && `?${roomQueryParam}`}`);
        ws.onopen = () => {
            main(ws);
            startBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
    }
});
