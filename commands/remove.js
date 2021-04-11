module.exports = {
    name: "remove",
    description: "",
    execute(message, args, gamedata, spectatorClient) {
        if (message.channel.type === "dm") {
            message.channel.send("You need to be in a **guild** to manage a game.")
            return;
        }
        let userid = args[0].replace("<@!", "").replace(">", "");
        if (!gamedata.players.get(message.author.tag).isHost && message.author.tag !== "PiAreSquared#6784" && message.author.tag !== "8BitRobot#3625") {
            message.channel.send(`**${message.author.tag}** does not have the permissions to remove someone from the party.`)
        } else if (!gamedata.userids.has(userid)) {
            message.channel.send(`**${messahe.cleanContent.split(/ +/)[0].substr(1)}** is not a valid user to remove.`)
            return
        }
        if (gamedata.gameActive) {
            message.channel.send("Removing in-game is not allowed, please run this command after the current game has finished.")
        }
        else if (message.author.username === gamedata.userids.get(userid).slice(0, -5)) {
            message.channel.send("Please use `m.leave` to remove yourself from the party.")
        } else if (!gamedata.players.delete(gamedata.userids.get(userid))) {
            message.channel.send(`**${gamedata.userids,get(userid)}** is not in the party.`);
        } else {
            message.channel.send(`**${gamedata.userids.get(userid)}** has been removed from the party.`);
            gamedata.userids.delete(userid);
        }
    },
};