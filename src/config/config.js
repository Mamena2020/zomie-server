// const configurationPeerConnection = {
//     sdpSemantics: "unified-plan",
//     iceServers: [{
//             "urls": "stun:stun.stunprotocol.org"
//         },

//     ]
// }
const configurationPeerConnection = ()=>{

    var allowTurnServer = process.env.ALLOW_TURN_SERVER =="true"?true:false   

    var stun = {"urls": "stun:stun.stunprotocol.org"}

    if(allowTurnServer)
    {
        console.log("using turn server")

        var turnServerHost = process.env.TURN_SERVER_HOST
        var turnServerUsername = process.env.TURN_SERVER_USERNAME
        var turnServerPassword = process.env.TURN_SERVER_PASSWORD

        return {
            sdpSemantics: "unified-plan",
            iceServers: [
                stun,
                {
                    'url': turnServerHost,
                    'username': turnServerUsername,
                    'password': turnServerPassword,
                },
        
            ]
        }
    }
    else
    {

        return {
            sdpSemantics: "unified-plan",
            iceServers: [
                stun,
            ]
        }
    }
   
}

const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

module.exports={
    configurationPeerConnection,
    offerSdpConstraints
}