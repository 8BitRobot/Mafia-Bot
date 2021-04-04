const Discord = require("discord.js");
module.exports = {
    name: "setmode",
    description: "",
    execute(message, args, gamedata) {
        console.log(args);
        gamedata.settings.set("gamemode", args[0]);
        let joinEmbed = new Discord.MessageEmbed()
            .setColor("#2196F3")
            .setTitle(`The gamemode has been set to \`${gamedata.settings.get("gamemode")}\`.`)
            .setFooter("Use m.party to see who's playing!");
        message.channel.send(joinEmbed);
    },
};