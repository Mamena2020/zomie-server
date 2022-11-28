const { v4: uuidv4 } = require('uuid')
const {rooms}  = require('../data')
const utils = require('../utils')

const timeIntervalMonitoringRoomInSec = process.env.ROOM_MONITOR_INTERVAL

class Room {
    constructor(
        id = null, 
        password = null, 
        life_time,  // int => minutes
        life_time_date,  // date => date.now() + life_time 
        video_bitrate=90,
        screen_bitrate=250,
        producers = {}, monitor = function() {}) {
        this.id = id
        this.password = password
        this.life_time = life_time
        this.life_time_date = life_time_date
        this.video_bitrate = video_bitrate
        this.screen_bitrate = screen_bitrate
        this.producers = producers
        this.monitor = monitor
    }
}

/**
 * @return room id
 */
 async function create(
    password, life_time, video_bitrate, screen_bitrate
) {
    var id = uuidv4().substring(0, 8)


    var date = new Date(Date.now())
    var life_time_date = utils.addMinutes(date, life_time)
    

    var room = new Room(
        id,
        password,
        life_time,
        life_time_date,
        video_bitrate,
        screen_bitrate,  
        {},
        roomMonitor(id)
    )
    rooms[id] = room
    return id
}


/**
 * @param  id room id
 * @return void
 */
 async function remove(id) {
    try {
        delete rooms[id]
        console.log("remove room: " + id)
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id room id
 * @return void - monitoring room in interval time, if producer id equal or less than 1 then will remove current room
 *              
 */
 function roomMonitor(id) {
    var monitor = setInterval(async() => {
        try {
            console.log("monitoring room: " + id);
            console.log("total producer in list:" + Object.keys(rooms[id].producers).length)
            if (Object.keys(rooms[id].producers).length <= 0 && Date.now() > rooms[id].life_time) {
                await remove(id)
                clearInterval(monitor)
            } 
        } catch (e) {
            console.log(e)
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
    }, timeIntervalMonitoringRoomInSec);
}

function get(id,res)
{
    var data = {
        "message": "room not found",
        "data": {}
    }
    var statusCode = 404
    try {
        console.log("get room : "+id)
        if (rooms[id] != null) {
            statusCode = 200
            data = {
                "message": "room found",
                "data":{
                    "id":id,
                    "participants": Object.keys(rooms[id].producers).length, 
                    "password_required": rooms[id].password!=null? true: false,
                    "life_time": rooms[id].life_time,
                    "life_time_date": rooms[id].life_time_date,
                    "video_bitrate": rooms[id].video_bitrate,
                    "screen_bitrate": rooms[id].screen_bitrate,
                }
            }
        }
        console.log(data)
    } catch (e) {
        console.log(e)
    }
    res.status(statusCode)
    res.json(data)
}

function check(id,password, res)
{
    var data = {
        "message": "room found"
    }
    var statusCode = 200
    try {
        console.log("check room")
        if (rooms[id] == null) {
            statusCode = 404
            data = {
                "message": "room not found"
            }

        } else {
            if (rooms[id].password != null && rooms[id].password != password) {
                statusCode = 403
                data = {
                    "message": "Wrong password"
                }
            }
        }
        console.log(data)
    } catch (e) {
        statusCode = 404
        console.log(e)
    }
    res.status(statusCode)
    res.json(data)
}



module.exports = {
    create,
    get,
    check
}