module.exports = {
    name: "66",
    description: "_Execute Order 66_ by automatically deleting every channel the bot created.",
    async execute(message, args, gamedata, spectatorClient) {
        try {
            if (message.channel.type === "dm") {
                message.channel.send("This command is not allowed to be used here!")
                return;
            }
            let category;
            let arrayOfCategories = [];
            let categories = message.guild.channels.cache.filter(channel => channel.name === "Town of Mafiaville");
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
            // gamedata.players.clear();
            gamedata.gameActive = false;
            gamedata.gameReady = false;
            message.channel.send("Done.");
        } catch (e) {
            console.log("An error occurred.");
        }
    },
};