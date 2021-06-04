const Discord = require("discord.js");
module.exports = {
    name: "erase",
    description: "Erase a line from your will.",
    execute(message, args, gamedata) {
        if (gamedata.players.has(message.author.tag)) {
            let player = gamedata.players.get(message.author.tag);
            if (message.guild) {
                message.channel.send("You don't want to work on your will here! Keep your role a secret.");
                message.delete();
            } else if (args.length > 1) {
                throw Error();
            } else if (args[0] > player.will.length) {
                message.channel.send("That line doesn't exist in your will.");
            } else {
                player.will.splice(args[0] - 1, 1);
                console.log(player.will);
                for (let i = 0; i < player.will.length; i++) {
                    player.will[i] = [i + 1, player.will[i][1]];
                }
                let will = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle("You've updated your will.")
                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"))
                    .setFooter("Use m.erase <line #> to remove an entry in your will.");
                message.channel.send(will);
            }
        } else {
            message.channel.send("Your will is already blank if you haven't joined a game yet.");
        }
    },
};