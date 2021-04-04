module.exports = {
    name: "start",
    description: "",
    async execute(message, args, gamedata) {
        function dayTime(time) {
            return new Promise((resolve) => {
                for (const [name, player] of gamedata.players) {
                    message.guild.members.fetch(player.id).then((member) => {
                        member.voice.setChannel(gamedata.settings.get("townHall")).catch(() => {
                            message.channel.send(`**${player.username}** could not be moved to the Town Hall Meeting, please join manually.`)
                        });
                    })
                }
                // TODO: add the daytime actions
                setTimeout(() => {
                    resolve();
                }, time * 1000);
            });
        }
        
        function nightTime(time) {
            return new Promise((resolve) => {
                for (const [name, player] of gamedata.players) {
                    message.guild.members.fetch(player.id).then((member) => {
                        // console.log(player);
                        member.voice.setChannel(player.vc).catch(() => {
                            message.channel.send(`**${player.username}** could not be moved to their home, please join manually.`)
                        });
                    });
                }
                // TODO: add the nighttime actions
                setTimeout(() => {
                    resolve();
                }, time * 1000);
            });
        }

        var villagers = 6;
        var mafia = 2;

        for (let i = 1; villagers > mafia ; i++) {
            await nightTime(5);
            // TODO: Remove this
            villagers--;
            await dayTime(5);
            console.log(`Round ${i} completed.`);
        }
    }
}