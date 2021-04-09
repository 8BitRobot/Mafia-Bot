const Discord = require("discord.js");
module.exports = {
    name: "join",
    description: "",
    execute(message, args, gamedata) {
        if (gamedata.players.has(message.author.tag)) {
            message.channel.send(`**${message.author.username}** is already in the party.`);
        } else if (gamedata.gameActive) {
            message.channel.send("Game is in progress, please join after the current game as ended.");
        } else {
            gamedata.players.set(message.author.tag, {
                id: message.author.id,
                username: message.author.username,
                role: undefined,
                wasFramed: false,
                silencedLastRound: false,
                silencedThisRound: false,
                align: undefined,
                isAlive: true,
                isHost: gamedata.players.size === 0,
                vc: -1,
                will: [],
            });
            gamedata.userids.set(message.author.id, message.author.tag);
            let joinEmbed = new Discord.MessageEmbed()
                .setColor("#2196F3")
                .setTitle(`${message.author.username} has joined the game.`)
                .setThumbnail(message.author.displayAvatarURL())
                .setDescription(`Party count: \`${gamedata.players.size}\``)
                .setFooter("Use m.party to see who joined!");
            message.channel.send(joinEmbed);
        }
    },
};