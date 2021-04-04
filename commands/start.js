module.exports = {
    name: "start",
    description: "",
    async execute(message, args, gamedata) {
        let users = [];
        for (const [name, player] of gamedata.players) {
            await message.guild.members.fetch(player.id).then((member) => {
                users.push(member);
            });
        }

        function dayTime(time) {
            return new Promise((resolve) => {
                for (let member of users) {
                    member.voice.setChannel(gamedata.settings.get("townHall")).catch((e) => {
                        console.log(e);
                        message.channel.send(`**${player.username}** could not be moved to the **Town Hall Meeting**, please join manually.`)
                    })
                }
                setTimeout(() => {
                    resolve();
                }, time * 1000);
                // TODO: add the daytime actions
            });
        }

        function nightTime(time) {
            return new Promise((resolve) => {
                console.log("night time");
                for (let member of users) {
                    member.voice.setChannel(gamedata.players.get(gamedata.userids.get(member.user.id)).vc).catch((e) => {
                        console.log(e);
                        message.channel.send(`**${member.username}** could not be moved to **their home**, please join manually.`)
                    });
                }
                setTimeout(() => {
                    resolve();
                }, time * 1000);
            });
        }

        var villagers = 4;
        var mafia = 2;

        for (let i = 1; villagers > mafia; i++) {
            await nightTime(20);
            villagers--;
            await dayTime(20);
            console.log(`Round ${i} completed.`);
        }
    }
}