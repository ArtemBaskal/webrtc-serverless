const mediaStreamConstraints = {audio: true, video: {width: 640, height: 360}};
const cfg = {'iceServers': [{'url': "stun:stun.l.google.com:19302"}]};

const alicePeerConnection = new RTCPeerConnection(cfg);
const bobPeerConnection = new RTCPeerConnection(cfg);

alicePeerConnection.addEventListener('icecandidate', (e) => {
    if (e.candidate == null) {
        localOffer.value = JSON.stringify(alicePeerConnection.localDescription);
        localOfferDownload.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(localOffer.value);
    }
});

bobPeerConnection.addEventListener('icecandidate', (e) => {
    if (e.candidate == null) {
        localAnswer.value = JSON.stringify(bobPeerConnection.localDescription);
        remoteOfferDownload.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(localAnswer.value);
    }
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

