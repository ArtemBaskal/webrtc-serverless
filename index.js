const mediaStreamConstraints = {audio: true, video: {width: 640, height: 360}};
const cfg = {'iceServers': [{'url': "stun:stun.l.google.com:19302"}]};

const alicePeerConnection = new RTCPeerConnection(cfg);
const bobPeerConnection = new RTCPeerConnection(cfg);

alicePeerConnection.addEventListener('icecandidate', (e) => {
    if (e.candidate == null) {
        localOffer.value = JSON.stringify(alicePeerConnection.localDescription);
    }
});

bobPeerConnection.addEventListener('icecandidate', (e) => {
    if (e.candidate == null) {
        localAnswer.value = JSON.stringify(bobPeerConnection.localDescription);
    }
});

const gotRemoteMediaStream = (event) => {
    remoteVideo.srcObject = event.stream;
};

bobPeerConnection.addEventListener('addstream', gotRemoteMediaStream);

createBtn.addEventListener('click', async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    localVideo.srcObject = mediaStream;

    alicePeerConnection.addStream(mediaStream);

    const desc = await alicePeerConnection.createOffer();
    await alicePeerConnection.setLocalDescription(desc)
});

answerRecdBtn.addEventListener('click', () => {
    const answer = remoteAnswer.value;
    const answerDesc = new RTCSessionDescription(JSON.parse(answer))
    alicePeerConnection.setRemoteDescription(answerDesc);
})

offerRecdBtn.addEventListener('click', async () => {
    const offer = remoteOffer.value;
    const offerDesc = new RTCSessionDescription(JSON.parse(offer))
    await bobPeerConnection.setRemoteDescription(offerDesc)
    const answerDesc = await bobPeerConnection.createAnswer();
    await bobPeerConnection.setLocalDescription(answerDesc)
});
