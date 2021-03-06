const Discord = require("discord.js");
module.exports = {
    name: "party",
    description: "List all members of the party.",
    execute(message, args, gamedata, spectatorClient) {
        var playerList = "";
        
        let playerCount = gamedata.players.size;
        
        for (const [tag, obj] of gamedata.players) {
            playerList +=`\n- **${obj.username}**`
            if (obj.isHost) {
                playerList += " (Host)";
            }
        };
        
        let partyEmbed = new Discord.MessageEmbed()
            .setColor("#2196F3")
            .setTitle(`There ${playerCount === 1 ? "is" : "are"} currently ${playerCount} player${playerCount === 1 ? "" : "s"} in the party.`)
            .addField("Players:", playerList, true)
            // .addField("Gamemode:", `**${gamedata.settings.get("gamemode") ? gamedata.settings.get("gamemode"): "unset"}**`, true)
            .setFooter("Use m.setup to assign roles!");

        message.channel.send(partyEmbed);
    
    },
};