module.exports = {
    name: "66",
    description: "",
    execute(message, args, gamedata) {
        message.guild.channels.resolve(gamedata.settings.get("townHall")).delete().catch(() => {});
        message.guild.channels.resolve(gamedata.settings.get("mafiaHouse")).delete().catch(() => {});
        for (let [player, obj] of gamedata.players) {
            message.guild.channels.resolve(obj.vc).delete().catch(() => {});
        }
        gamedata.players.clear();
        message.channel.send("Done.");
    },
};