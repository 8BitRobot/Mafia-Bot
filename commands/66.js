module.exports = {
    name: "66",
    description: "",
    execute(message, args, gamedata) {
        gamedata.players.clear();
        message.channel.send("Done.");
    },
};