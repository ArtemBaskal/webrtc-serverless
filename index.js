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

const ws = new WebSocket("wss://wss-signaling.herokuapp.com/");

const REQUEST_TYPE_TO_CALLBACK_MAP = {
    offer: (data) => {
        remoteOffer.value = data;
        remoteSection.style.display = 'block';
        offerRecdBtn.click();
    },
    answer: (data) => {
        remoteAnswer.value = data;
        answerRecdBtn.click();
    }
}

ws.onmessage = (event) => {
    const {data} = event;
    console.log(`Received: ${data}`);

    const {type} = decodeMessage(data);
    REQUEST_TYPE_TO_CALLBACK_MAP[type](data);
};

alicePeerConnection.addEventListener('icecandidate', (e) => {
    /* FIXME test this */
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
    remoteVideo.srcObject = event.stream;
};

const gotRemoteMediaStream = (event) => {
    remoteVideo.srcObject = event.stream;
};

alicePeerConnection.addEventListener('addstream', gotLocalMediaStream);
bobPeerConnection.addEventListener('addstream', gotRemoteMediaStream);

createBtn.addEventListener('click', async () => {
    localSection.style.display = 'block';

    const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    alicePeerConnection.addStream(mediaStream);
    localVideo.srcObject = mediaStream;

    const desc = await alicePeerConnection.createOffer();
    await alicePeerConnection.setLocalDescription(desc)
});

answerRecdBtn.addEventListener('click', () => {
    const answer = remoteAnswer.value;
    try {
        const answerDesc = new RTCSessionDescription(decodeMessage(answer))
        alicePeerConnection.setRemoteDescription(answerDesc);
    } catch (e) {
        console.error(e);
    }
})

offerRecdBtn.addEventListener('click', async () => {
    const offer = remoteOffer.value;
    const offerDesc = new RTCSessionDescription(decodeMessage(offer))
    await bobPeerConnection.setRemoteDescription(offerDesc)

    const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    bobPeerConnection.addStream(mediaStream);
    localVideo.srcObject = mediaStream;

    const answerDesc = await bobPeerConnection.createAnswer();
    await bobPeerConnection.setLocalDescription(answerDesc)
});
