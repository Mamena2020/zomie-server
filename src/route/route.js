const roomController = require("../controller/roomController")

module.exports =(app)=> {
    app.post("/api/create-room",roomController.create)
    app.post("/api/check-room", roomController.check)
    app.post("/api/join-room",roomController.join)
    app.get("/api/get-rooms",roomController.gets)
    app.get("/api/get-room",roomController.get)
}