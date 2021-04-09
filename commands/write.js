const Discord = require("discord.js");
module.exports = {
    name: "write",
    description: "",
    execute(message, args, gamedata) {
        if (gamedata.players.has(message.author.tag)) {
            let player = gamedata.players.get(message.author.tag);
            if (message.guild) {
                message.channel.send("You don't want to write your will here! Keep your role a secret.");
                message.delete();
            } else if (args.length > 300) {
                message.channel.send("You really don't need more than 300 characters in one line of your will. Try to keep it short and simple.");
            } else {
                player.will.push([player.will.length + 1, args]);
                let will = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle("You've updated your will.")
                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"))
                    .setFooter("Use m.erase <line #> to remove an entry in your will.");
                message.channel.send(will);
            }
        } else {
            message.channel.send("You can't write a will unless you're part of a game!");
        }
    },
};