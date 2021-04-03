module.exports = {
    name: "party",
    description: "",
    execute(message, args, gamedata) {
        var newMessage = "";
        
        let playerCount = gamedata.players.size;
        newMessage += `There ${playerCount == 1 ? "is" : "are"} currently ${playerCount} player${playerCount == 1 ? "" : "s"} in the party.`
        
        for (const [tag, obj] of gamedata.players) {

            console.log(tag);
            console.log(obj);
            newMessage +=`\n- **${obj.username}**`
            if (obj.isHost) {
                newMessage += " (Host)";
            }
        };
        
        message.channel.send(newMessage);
    
    },
};