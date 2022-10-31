const host = "http://192.168.1.8"
const port = 5000

const configurationPeerConnection = {
    iceServers: [{
        urls: "stun:stun.stunprotocol.org"
            // urls: "stun:stun.l.google.com:19302?transport=tcp"
    }]
}


const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

const mediaConstraints = {
    video: true,
    audio: false
}

var broadcast_id

window.onload = () => {
    document.getElementById('my-button').onclick = () => {
        init();
    }
}

var peer
var producer_id
var room_id
async function init() {

    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    document.getElementById("video").srcObject = stream;


    peer = await createPeer();


    stream.getTracks().forEach(track => peer.addTrack(track, stream));
}


async function createPeer() {


    peer = new RTCPeerConnection(configurationPeerConnection, offerSdpConstraints);
    peer.onnegotiationneeded = async() => await handleNegotiationNeededEvent(peer);

    return peer;
}

async function handleNegotiationNeededEvent(peer) {
    const offer = await peer.createOffer({ 'offerToReceiveVideo': 1 });
    await peer.setLocalDescription(offer);



    const payload = {
        sdp: peer.localDescription,
        socket_id: socket_id,
        use_sdp_transform: false
    };


    console.log("Send socket id: " + socket_id)

    const { data } = await axios.post('/create-room', payload);

    console.log("respnse ")
    console.log(data)

    producer_id = data.producer_id
    const desc = new RTCSessionDescription(data.sdp);
    await peer.setRemoteDescription(desc).catch(e => console.log(e));

    document.getElementById("text-container").innerHTML = "Producer id: " + producer_id;


    // peer.onconnectionstatechange = (e) => {
    //     console.log("status")
    //     console.log(e)
    // }
    // peer.onicecandidateerror = (e) => {

    //     console.log("error1")
    //     console.log(e)
    // }
    peer.oniceconnectionstatechange = (e) => {
        try {
            const connectionStatus = peer.connectionState;
            if (["disconnected", "failed", "closed"].includes(connectionStatus)) {
                console.log("disconnected")
            } else {
                console.log("still connected")
            }
        } catch (e) {
            console.log(e)
        }
    }

    // peer.onicecandidate = (e) => {
    //     if (!e || !e.candidate) return;
    //     // console.log(e)
    //     var newCandidate = {
    //         'candidate': String(e.candidate.candidate),
    //         'sdpMid': String(e.candidate.sdpMid),
    //         'sdpMLineIndex': e.candidate.sdpMLineIndex,
    //     }
    //     console.log("ice candidate")
    //     console.log(newCandidate)
    //     addCandidate(newCandidate)
    //     console.log("ice candidate2")
    //     peer.addIceCandidate(new RTCIceCandidate(newCandidate))
    // }
}

// -----------------------------------------------------------------------------


var socket = io(host + ":" + port);
var socket_id

socket.on('user-connected', function(_socket_id) {
    console.log("me connected: " + _socket_id)
    socket_id = _socket_id
});

socket.on("producer-candidate-from-server", (event) => {
    if (event.producer_id == producer_id) {
        console.log("******add candidate from server")
        console.log(event)
        peer.addIceCandidate(new RTCIceCandidate(event.candidate))
        console.log("@@@@@@add candidate from server")

    }
})

// function addCandidate(candidate) {
//     socket.emit('add-candidate-broadcaster', {
//         candidate: candidate,
//         broadcast_id: broadcast_id
//     });
// }