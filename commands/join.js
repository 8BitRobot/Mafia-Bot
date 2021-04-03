module.exports = {
    name: "join",
    description: "",
    execute(message, args, gamedata) {
        if (gamedata.players.has(message.author.tag)) {
            message.channel.send(`**${message.author.username}** is already in the party.`);
        }
        gamedata.players.set(message.author.tag, {
            username: message.author.username,
            role: "",
            isAlive: true,
            isHost: gamedata.players.size == 0,
        });
        message.channel.send(`**${message.author.username}** has joined the game.`);
    },
};