module.exports = {
    name: "leave",
    description: "",
    execute(message, args, gamedata, spectatorClient) {
        let dev = ["PiAreSquared#6784", "8BitRobot#3625"]
        let isHost = gamedata.players.get(message.author.tag).isHost;
        if (gamedata.gameActive) {
            message.channel.send("Leaving in-game is not allowed, please run this command after the current game has finished.")
        }
        if (!gamedata.players.delete(message.author.tag)) {
            message.channel.send(`**${message.author.username}** is not in the party.`);
        } else {
            gamedata.userids.delete(message.author.id);
            message.channel.send(`**${message.author.username}** has left the party.`);
            if (isHost) {
                if (gamedata.players.has(dev[0]) && gamedata.players.has(dev[1])) {
                    if (Math.random() > 0.5) {
                        gamedata.players.get(dev[0]).isHost = true;
                        message.channel.send(`**${dev[0]}** is now the host.`)
                    } else {
                        gamedata.players.get(dev[1]).isHost = true;
                        message.channel.send(`**${dev[1]}** is now the host.`)
                    }
                } else if (gamedata.players.has(dev[0])) {
                    gamedata.players.get(dev[0]).isHost = true;
                    message.channel.send(`**${dev[0]}** is now the host.`)
                } else if (gamedata.players.has(dev[1])) {
                    gamedata.players.get(dev[1]).isHost = true;
                    message.channel.send(`**${dev[1]}** is now the host.`)
                } else if (gamedata.players.size === 0) {
                    message.channel.send("There are now 0 players in the lobby")
                } else {
                    let newHost = Array.from(gamedata.players.keys())[Math.floor(Math.random() * keys.length)];
                    gamedata.players.get(newHost).isHost = true;
                    message.channel.send(`**${newHost}** is now the host.`)
                }
            }
        }
    },
};