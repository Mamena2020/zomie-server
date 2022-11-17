const sdpTransform = require('sdp-transform');
// ================================================================================================ sdp process

/**
 * 
 * @param {String} sdp json string of sdp with structure {sdp:sdp, type:offer|answer }
 * @return map 
 */
 async function sdpFromJsonString(sdpJson) {
    var session = JSON.parse(sdpJson);
    var _sdp = sdpTransform.write(session.sdp)
    var newsdp = {
        type: session.type,
        sdp: _sdp
    }
    return newsdp
}

/**
 * @param {object} sdp component {sdp:sdp, type: offer|answer}
 * @return {String} json string 
 */
async function sdpToJsonString(sdp) {
    console.log("sdp to json string")
        // console.log(sdp)


    var session = sdpTransform.parse(String(sdp.sdp))
    var data = {
        type: sdp.type,
        sdp: session
    }


    return JSON.stringify(data)
}


function addMinutes(date, minutes) {
    return new Date(date.getTime() + (minutes * 60 * 1000));
}


module.exports={
    sdpFromJsonString,
    sdpToJsonString,
    addMinutes
}