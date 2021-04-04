const Discord = require('discord.js');

module.exports = {
    name: "image",
    description: "",
    execute(message, args, gamedata) {
        var embed = new Discord.MessageEmbed()
            .attachFiles(["images/detective.png"])
            .setImage("attachment://detective.png")
            // .catch(() => {});
        var msg = message.channel.send(embed);
    },
};