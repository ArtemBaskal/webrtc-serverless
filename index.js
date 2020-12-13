const mediaStreamConstraints = {audio: true, video: {width: 640, height: 360}};
const cfg = {
    'iceServers': [
        {url: 'stun:stun.l.google.com:19302'},
        {url: 'stun:stun1.l.google.com:19302'},
        {url: 'stun:stun2.l.google.com:19302'},
        {url: 'stun:stun3.l.google.com:19302'},
        {url: 'stun:stun4.l.google.com:19302'},
    ]
};

const alicePeerConnection = new RTCPeerConnection(cfg);
const bobPeerConnection = new RTCPeerConnection(cfg);

alicePeerConnection.addEventListener('icecandidate', (e) => {
    /* FIXME test this */
    const offer = e.candidate == null ? alicePeerConnection.localDescription : e.currentTarget.localDescription;

    localOffer.value = JSON.stringify(offer);
    localOfferDownload.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(localOffer.value);
});

bobPeerConnection.addEventListener('icecandidate', (e) => {
    /* FIXME test this */
    const answer = e.candidate == null ? bobPeerConnection.localDescription : e.currentTarget.localDescription;

    localAnswer.value = JSON.stringify(answer);
    remoteOfferDownload.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(localAnswer.value);
});

const gotLocalMediaStream = (event) => {
    localVideo.srcObject = event.stream;
};

const gotRemoteMediaStream = (event) => {
    remoteVideo.srcObject = event.stream;
};

alicePeerConnection.addEventListener('addstream', gotLocalMediaStream);
bobPeerConnection.addEventListener('addstream', gotRemoteMediaStream);

createBtn.addEventListener('click', async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    alicePeerConnection.addStream(mediaStream);
    localVideo.srcObject = mediaStream;

    const desc = await alicePeerConnection.createOffer();
    await alicePeerConnection.setLocalDescription(desc)
});

answerRecdBtn.addEventListener('click', () => {
    const answer = remoteAnswer.value;
    try {
        const answerDesc = new RTCSessionDescription(JSON.parse(answer))
        alicePeerConnection.setRemoteDescription(answerDesc);
    } catch (e) {
        console.error(e);
    }
})

offerRecdBtn.addEventListener('click', async () => {
    const offer = remoteOffer.value;
    const offerDesc = new RTCSessionDescription(JSON.parse(offer))
    await bobPeerConnection.setRemoteDescription(offerDesc)

    const mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    /* FIXME camera display for Alice */
    bobPeerConnection.addStream(mediaStream);

    const answerDesc = await bobPeerConnection.createAnswer();
    await bobPeerConnection.setLocalDescription(answerDesc)
});

remoteOfferInput.addEventListener('change', () => {
    const [file] = remoteOfferInput.files;

    if (file) {
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = (evt) => {
            remoteOffer.value = evt.target.result;
            offerRecdBtn.click();
        }
    }
})

remoteAnswerInput.addEventListener('change', () => {
    const [file] = remoteAnswerInput.files;

    if (file) {
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = (evt) => {
            remoteAnswer.value = evt.target.result;
            answerRecdBtn.click();
        }
    }
})

