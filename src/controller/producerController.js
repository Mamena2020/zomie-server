
const {producers}= require("../data")
const producerService = require("../services/producerService")

/**
 * 
 * @param {*} body{
 * 
 * producer_id
 * 
 * sdp offer
 * 
 * producer_target
 * 
 * type : join | leave
 * 
 * } 
 * @param {*} res 
 */
async function renegotiation({ body }, res) {
    var data =  {
        "message": "failed",
        "data": {}
    }
    var statusCode = 409
    try
    {
            console.log("starting renegotiation");
            var sdp = await producerService.renegotiation(
                body.producer_id,
                body.sdp,
                body.producer_id_target,
                body.type
                )
            if(sdp!=null)
            {
                console.log("sukes renegotiation ")
                var statusCode = 200
                data = {
                    "message": "success nego",
                    "data": {
                        sdp: sdp,
                        producer_id: body.producer_id,
                        producers : producerService.getProducersFromRoomToArray(producers[body.producer_id].room_id) 
                    }
                }
            }

    } catch (e) {
        statusCode = 409
        data = {
            "message": "conflic",
            "data": {}
        }
        console.log(e)
    }
    res.status(statusCode)
    res.json(data)
}

module.exports={
    renegotiation
}