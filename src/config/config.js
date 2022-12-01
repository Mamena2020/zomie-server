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

        var turn =  {
                        'urls': turnServerHost,
                        'username': turnServerUsername,
                        'password': turnServerPassword,
                    }

        // return {
        //     sdpSemantics: "unified-plan",
        //     iceServers: [
        //         stun,
        //         {
        //             'urls': turnServerHost,
        //             'username': turnServerUsername,
        //             'password': turnServerPassword,
        //         },
        
        //     ]
        // }
        return {
            sdpSemantics: "unified-plan",
            iceServers: [
                stun,
                  {
                    "urls": "stun:openrelay.metered.ca:80",
                  },
                  turn,
                  {
                    "urls": "turn:openrelay.metered.ca:80",
                    "username": "openrelayproject",
                    "credential": "openrelayproject",
                  },
                  {
                    "urls": "turn:openrelay.metered.ca:443",
                    "username": "openrelayproject",
                    "credential": "openrelayproject",
                  },
                  {
                    "urls": "turn:openrelay.metered.ca:443?transport=tcp",
                    "username": "openrelayproject",
                    "credential": "openrelayproject",
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