const { v4: uuidv4 } = require('uuid')
const {rooms}  = require('../data')

const timeIntervalMonitoringRoomInSec = process.env.ROOM_MONITOR_INTERVAL

class Room {
    constructor(id = null, password = null, life_time, producers = {}, monitor = function() {}) {
        this.id = id
        this.password = password
        this.life_time = life_time
        this.producers = producers
        this.monitor = monitor
    }
}

/**
 * @return room id
 */
 async function create(
    password, life_time
) {
    var id = uuidv4().substring(0, 8)
    var room = new Room(
        id,
        password,
        life_time, {},
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
        "id":id,
        "message": "room not found",
        "participants": 0,
        "password":false
    }
    var statusCode = 404
    try {
        console.log("get room : "+id)
        if (rooms[id] != null) {
            statusCode = 200
            data = {
                "id":id,
                "message": "room found",
                "participants": Object.keys(rooms[id].producers).length, 
                "password": rooms[id].password!=null? true: false
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