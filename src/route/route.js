const roomController = require("../controller/roomController")

module.exports =(app)=> {
    app.post("/create-room",roomController.create)
    app.post("/check-room", roomController.check)
    app.post("/join-room",roomController.join)
    app.get("/get-rooms",roomController.gets)
    app.get("/get-room",roomController.getRoom)
}