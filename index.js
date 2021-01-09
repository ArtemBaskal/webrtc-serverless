const FILE_DATA_CHANNEL_BINARY_TYPE = 'arraybuffer';
const MESSAGES_CHANNEL_NAME = 'sendDataChannel';
const END_OF_FILE_MESSAGE = 'EOF';
const QUERY_PARAM_ROOM_NAME = 'room';

const REQUEST_TYPE_TO_CALLBACK_MAP = {
    offer: (data) => {
        remoteOffer.value = data;
        remoteSection.style.display = 'block';
        createBtn.style.display = 'none';
        // offerRecdBtn.click();
    },
    answer: (data) => {
        remoteAnswer.value = data;
        // answerRecdBtn.click();
    }
};

const generateQueryParam = (queryParamKey, queryParamValue) => new URLSearchParams({[queryParamKey]: queryParamValue}).toString();

const main = (room) => {
    const mediaStreamConstraints = {audio: true, video: {width: 640, height: 360}};
    const cfg = {
        'iceServers': [
            {url: 'stun:stun.l.google.com:19302'},
            {url: 'stun:stun1.l.google.com:19302'},
            {url: 'stun:stun2.l.google.com:19302'},
            {url: 'stun:stun3.l.google.com:19302'},
            {url: 'stun:stun4.l.google.com:19302'},
            {
                urls: 'turn:numb.viagenie.ca',
                credential: '9u7prU:2}R{Sut~.)d[bP7,;Pgc\'Pa',
                username: 'fkrveacbukypqsqyaq@miucce.com'
            },
        ]
    };

    const encodeMessage = (message) => JSON.stringify(message);
    const decodeMessage = (rawMessage) => JSON.parse(rawMessage);

    const alicePeerConnection = new RTCPeerConnection(cfg);
    const bobPeerConnection = new RTCPeerConnection(cfg);

    const onSendChannelStateChange = (e) => {
        const readyState = e.target.readyState;
        console.log('Send channel state is: ' + readyState);
    };

    const dataConstraint = null;
    const sendChannel = alicePeerConnection.createDataChannel(MESSAGES_CHANNEL_NAME, dataConstraint);
    sendChannel.addEventListener('open', onSendChannelStateChange);
    sendChannel.addEventListener('close', onSendChannelStateChange);
    dataChannelSenderBtn.addEventListener('click', () => {
        sendChannel.send(dataChannelSender.value);
    });

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
        const sendFileChannel = alicePeerConnection.createDataChannel(name, dataConstraint);
        sendFileChannel.binaryType = FILE_DATA_CHANNEL_BINARY_TYPE;
        /*
         Firefox cannot send a message larger than 16 Kbytes to Chrome
         https://viblast.com/blog/2015/2/5/webrtc-data-channel-message-size/#blog-body:~:text=Firefox%20cannot%20send%20a%20message%20larger%20than%2016%20Kbytes%20to%20Chrome
         Messages smaller than 16kiB can be sent without concern, as all major user agents handle them the same way. Beyond that, things get more complicated.
         https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#understanding_message_size_limits:~:text=Messages%20smaller%20than%2016kiB%20can%20be,Beyond%20that%2C%20things%20get%20more%20complicated.
        */
        const CHUNK_SIZE = 2 ** 14;
        const FIRST_SLICE_BYTE = 0;

        const fileReader = new FileReader();
        let offset = 0;

        fileReader.addEventListener('error', (error) => {
            console.error('Error reading file: ', error)
        });

        fileReader.addEventListener('abort', (event) => {
            console.log('File reading aborted: ', event);
        });

        const readSlice = (byteOffset) => {
            console.log('readSlice', byteOffset);
            const slice = file.slice(offset, byteOffset + CHUNK_SIZE);
            fileReader.readAsArrayBuffer(slice);
        };

        fileReader.addEventListener('load', (e) => {
            console.log('FileReader.onload', e);
            sendFileChannel.send(e.target.result);

            offset += e.target.result.byteLength;
            sendProgress.value = offset;

            if (offset < file.size) {
                readSlice(offset);
            } else {
                sendFileChannel.send(END_OF_FILE_MESSAGE);
            }
        });

        readSlice(FIRST_SLICE_BYTE);
    });

    bobPeerConnection.addEventListener('datachannel', ({channel}) => {
            console.log('Receive Channel Callback');

            if (channel.label === MESSAGES_CHANNEL_NAME) {
                channel.addEventListener('message', (event) => {
                    console.log('Received Message', event.data);
                    sendDataChannelReceiver.value = event.data;
                });
            } else {
                const fileName = channel.label;
                let receivedFileBuffer = [];
                let receivedFileSize = 0;

                channel.binaryType = FILE_DATA_CHANNEL_BINARY_TYPE;

                channel.addEventListener('message', (event) => {
                    if (event.data === END_OF_FILE_MESSAGE) {
                        const receivedFile = new Blob(receivedFileBuffer);
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

    const roomQueryParam = generateQueryParam(QUERY_PARAM_ROOM_NAME, room);
    const ws = new WebSocket(`wss://wss-signaling.herokuapp.com/${roomQueryParam && `?${roomQueryParam}`}`);

    ws.addEventListener('message', (event) => {
        const {data} = event;
        console.log(`Received: ${data}`);

        const {type} = decodeMessage(data);
        REQUEST_TYPE_TO_CALLBACK_MAP[type](data);
    });

    alicePeerConnection.addEventListener('icecandidate', (e) => {
        /* FIXME test this, addIceCandidate?, fix negotiation? https://github.com/Dornhoth/video-chat-webrtc/blob/master/client/index.js */
        const offer = e.candidate == null ? alicePeerConnection.localDescription : e.currentTarget.localDescription;

        localOffer.value = encodeMessage(offer);
        ws.send(localOffer.value);
    });

    bobPeerConnection.addEventListener('icecandidate', (e) => {
        /* FIXME test this */
        const answer = e.candidate == null ? bobPeerConnection.localDescription : e.currentTarget.localDescription;

        localAnswer.value = encodeMessage(answer);
        ws.send(localAnswer.value);
    });

    const gotLocalMediaStream = (event) => {
        if (event.track.kind === 'video') {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    const gotRemoteMediaStream = (event) => {
        if (event.track.kind === 'video') {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    alicePeerConnection.addEventListener('track', gotLocalMediaStream);
    bobPeerConnection.addEventListener('track', gotRemoteMediaStream);

    createBtn.addEventListener('click', async () => {
        localSection.style.display = 'block';

        const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);

        mediaStream.getTracks().forEach((track) => {
            alicePeerConnection.addTrack(track, mediaStream);
        })

        localVideo.srcObject = mediaStream;

        const desc = await alicePeerConnection.createOffer();
        await alicePeerConnection.setLocalDescription(desc)
    });

    answerRecdBtn.addEventListener('click', async () => {
        try {
            const answerDesc = decodeMessage(remoteAnswer.value)
            await alicePeerConnection.setRemoteDescription(answerDesc);
        } catch (e) {
            console.error(e);
        }
    })

    offerRecdBtn.addEventListener('click', async () => {
        const offerDesc = decodeMessage(remoteOffer.value)
        await bobPeerConnection.setRemoteDescription(offerDesc)

        const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
        mediaStream.getTracks().forEach((track) => {
            bobPeerConnection.addTrack(track, mediaStream);
        })

        localVideo.srcObject = mediaStream;

        const answerDesc = await bobPeerConnection.createAnswer();
        await bobPeerConnection.setLocalDescription(answerDesc)
    });
};

try {
    /* TODO get rooms amount from server? */
    Array.from(({length: 3}),
        (_, idx) => idx + 1)
        .map((idx) => {
            const room = idx.toString();

            const option = new Option(room, room);
            roomSelect.append(option);
        });

    roomSelect.addEventListener('change', (e) => {
        const room = e.target.value;
        createBtn.style.visibility = 'visible';
        roomSelect.style.display = 'none';

        main(room);
    });
} catch (err) {
    console.log(err);
}
