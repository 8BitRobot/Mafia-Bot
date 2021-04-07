module.exports = {
    name: "66",
    description: "",
    async execute(message, args, gamedata, spectatorClient) {
        let category;
        let arrayOfCategories = [];
        let categories = message.guild.channels.cache.filter(channel => channel.name === "Town of Larkinville");
        for (category of categories) {
            arrayOfCategories.push(category[0]);
        }
        for (let [_, channel] of message.guild.channels.cache) {
            if (arrayOfCategories.includes(channel.parentID)) {
                await channel.delete();
            }
        }
        for (category of categories) {
            message.guild.channels.resolve(category[0]).delete();
        }
        gamedata.players.clear();
        message.channel.send("Done.");
    },
};