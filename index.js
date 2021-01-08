const main = () => {
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
                credential: 'muazkh',
                username: 'webrtc@live.com'
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
    const sendChannel = alicePeerConnection.createDataChannel('sendDataChannel', dataConstraint);
    sendChannel.addEventListener('open', onSendChannelStateChange);
    sendChannel.addEventListener('close', onSendChannelStateChange);
    dataChannelSenderBtn.addEventListener('click', () => {
        sendChannel.send(dataChannelSender.value);
    })

    bobPeerConnection.addEventListener('datachannel',({channel}) => {
        console.log('Receive Channel Callback');

        channel.addEventListener('message', (event) => {
            console.log('Received Message', event.data);
            sendDataChannelReceiver.value = event.data;
        });

        channel.addEventListener('open', onSendChannelStateChange);
        channel.addEventListener('close', onSendChannelStateChange);
    });

    const ws = new WebSocket("wss://wss-signaling.herokuapp.com/");

    const REQUEST_TYPE_TO_CALLBACK_MAP = {
        offer: (data) => {
            remoteOffer.value = data;
            remoteSection.style.display = 'block';
            // offerRecdBtn.click();
        },
        answer: (data) => {
            remoteAnswer.value = data;
            // answerRecdBtn.click();
        }
    }

    ws.addEventListener('message', (event) => {
        const {data} = event;
        console.log(`Received: ${data}`);

        const {type} = decodeMessage(data);
        REQUEST_TYPE_TO_CALLBACK_MAP[type](data);
    });

    alicePeerConnection.addEventListener('icecandidate', (e) => {
        /* FIXME test this, addIceCandidate? */
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
        const answer = remoteAnswer.value;
        try {
            const answerDesc = new RTCSessionDescription(decodeMessage(answer))
            await alicePeerConnection.setRemoteDescription(answerDesc);
        } catch (e) {
            console.error(e);
        }
    })

    offerRecdBtn.addEventListener('click', async () => {
        const offer = remoteOffer.value;
        const offerDesc = new RTCSessionDescription(decodeMessage(offer))
        await bobPeerConnection.setRemoteDescription(offerDesc)

        const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
        mediaStream.getTracks().forEach((track) => {
            bobPeerConnection.addTrack(track, mediaStream);
        })

        localVideo.srcObject = mediaStream;

        const answerDesc = await bobPeerConnection.createAnswer();
        await bobPeerConnection.setLocalDescription(answerDesc)
    });
}

try {
    main();
} catch (err) {
    console.log(err);
}
