const Discord = require("discord.js");

module.exports = {
    name: "start",
    description: "",
    async execute(message, args, gamedata) {
        let users = [];
        var nonmafia = 0;
        var mafia = 0;
        for (const [name, player] of gamedata.players) {
            if (player.align === "Mafia") mafia++;
            else nonmafia++;
            await message.guild.members.fetch(player.id).then((member) => {
                users.push(member);
            });
        }


        function dayTime(time, round) {
            return new Promise(async (resolve) => {
                var nonmafia = 0;
                var mafia = 0;
                for (let member of users) {
                    let temp = gamedata.players.get(gamedata.userids.get(member.id))
                    temp.isFramed = false
                    gamedata.players.set(gamedata.userids.get(member.id), temp);
                    if (gamedata.players.get(gamedata.userids.get(member.id)).align === "Mafia") mafia++;
                    else nonmafia++;
                    if (!gamedata.players.get(gamedata.userids.get(member.id)).isAlive) {
                        await message.guild.channels.resolve(gamedata.settings.get("townHall")).updateOverwrite(member, {
                            SPEAK: false,
                        });
                        if (gamedata.players.get(gamedata.userids.get(member.id)).align === "Mafia") {
                            await message.guild.channels.resolve(gamedata.settings.get("mafiaHouse")).updateOverwrite(member, {
                                VIEW_CHANNEL: false,
                            });
                        }
                    }
                }
                for (let member of users) {
                    member.voice.setChannel(gamedata.settings.get("townHall")).catch(() => {
                        message.channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to the **Town Hall Meeting**, please join manually.`)
                    })
                }
                setTimeout(() => {
                    resolve();
                }, time * 1000);
                // TODO: add the daytime actions
            });
        }

        // function nightPrompting(roundNum) {
        //     let i = 0;
        //     return new Promise((resolve) => {
        //         for (const [tag, player] of gamedata.players) {
        //             let user = users[i]
        //             gamedata[`${player.align.toLowerCase()}Roles`][player.role].prompt(user);
        //             i++;
        //         }
        //         resolve();
        //     });
        // }

        function nightActions(roundNum) {
            return new Promise((resolve) => {
                let round = new Map();
                let i = 0;
                let promises = []
                for (const [tag, player] of gamedata.players) {
                    let user = users[i]
                    console.log(player.role);
                    console.log(player.align.toLowerCase());
                    if (!player.isAlive) {
                        continue;
                    }
                    promises.push(gamedata[`${player.align.toLowerCase()}Roles`][player.role].night(user).then((result) => {
                        round.set(player.role, [result, tag]);
                    }));
                    i++;
                }
                Promise.all(promises).then(() => {
                    console.log(round);
                    gamedata.game.rounds.push(round);

                    let orderOfActions = [
                        // ["Distractor", "Village"],
                        // ["Jailer", "Village"],
                        ["Godfather", "Mafia"],
                        ["Mafioso", "Mafia"],
                        // ["Framer", "Mafia"],
                        ["Silencer", "Mafia"],
                        // ["Bomber", "Neutral"],
                        ["Doctor", "Village"],
                        ["Vigilante", "Village"],
                        ["Detective", "Village"],
                        ["PI", "Village"],
                        ["Spy", "Village"],
                    ];

                    for (let [role, align] of orderOfActions) {
                        if (!round.has(role)) {
                            continue;
                        }
                        console.log(`role: ${role}`);
                        console.log(`align: ${align}`);
                        let r = round.get(role);
                        let action = r[0];
                        let tag = r[1];
                        if (!action.action) {
                            continue; // TODO: handle this better
                        }
                        switch (action.action) {
                            case "kill":
                                let deadPerson = action.choice;
                                let temp = gamedata.players.get(deadPerson);
                                temp.isAlive = false;
                                gamedata.players.set(deadPerson, temp);
                                gamedata.game.game.deadThisRound.push({
                                    name: deadPerson,
                                    by: "mafia",
                                });
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== deadPerson);
                                message.guild.members.fetch(temp.id).then((user) => {
                                    let msg = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`Unfortunately, you were killed by the mafia.`)
                                        .setDescription("You can still spectate, but you can no longer speak or perform any nightly actions. Please refrain from communicating with other players who are alive via video or DMs.");
                                    user.send(msg);
                                });
                                break;
                            case "frame":

                                break;
                            case "kill-vigil":

                                break;
                            case "check":
                                let detective = gamedata.players.get(tag);
                                if (detective.isAlive) {
                                    let suspect = gamedata.players.get(action.choice);
                                    message.guild.members.fetch(detective.id).then((user) => {
                                        let msg;
                                        if (suspect.align === "Mafia" || suspect.wasFramed) {
                                            msg = new Discord.MessageEmbed()
                                                .setColor("#d50000")
                                                .setTitle(`Your investigation has revealed that the suspect is in the mafia!`)
                                                .setDescription("That, or they may have been framed. Keep this in mind when revealing your findings to the town.");
                                        } else {
                                            msg = new Discord.MessageEmbed()
                                                .setColor("#1e8c00")
                                                .setTitle(`Your investigation has revealed that the suspect is clear.`)
                                                .setDescription("You can tell the town, but keep in mind you may be putting a target on your back.");
                                        }
                                        user.send(msg);
                                    });
                                }
                                break;
                            case "heal":
                                let doc = gamedata.players.get(tag);
                                let target = gamedata.players.get(action.choice);
                                if (tag === action.choice && !doc.isAlive) {
                                    gamedata.game.game.playersAlive.push(tag);
                                    gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== tag)
                                    doc.isAlive = true;
                                    gamedata.players.set(tag, doc)
                                    let msg = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .setTitle(`You successfully saved yourself!`)
                                        .setDescription("The mafia tried to attack you, but you thwarted their efforts. The town will certainly hear about this.");
                                } else if (doc.isAlive && !target.isAlive) {
                                    gamedata.game.game.playersAlive.push(action.choice);
                                    gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== action.choice)
                                    target.isAlive = true;
                                    gamedata.players.set(action.choice, target)
                                    let msg = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .setTitle(`You successfully saved ${gamedata.players.get(action.choice).username}!`)
                                        .setDescription("The mafia tried to attack this member of the town, but you thwarted their efforts. The town will certainly hear about this.");
                                }
                                break;
                            case "baited":

                                break;
                            default:
                                console.log(action.action);
                                console.log(role);
                                break;
                        };
                    }
                    // let me = gamedata.players.get("8BitRobot#3625");
                    // me.isAlive = false;
                    // gamedata.players.set("8BitRobot#3625", me);
                    resolve();
                });
            });
        }

        function nightTime(time, round) {
            return new Promise((resolve) => {
                console.log("night time");
                for (let member of users) {
                    member.voice.setChannel(gamedata.players.get(gamedata.userids.get(member.user.id)).vc).catch(() => {
                        message.channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to **their home**, please join manually.`)
                    });
                }

                nightActions(round).then(() => {
                    resolve();
                });
            });
        }

        for (let i = 1; nonmafia > mafia; i++) {
            gamedata.game.game.currentRound = i;
            await nightTime(20, i);
            if (mafia >= nonmafia) break;
            await dayTime(20, i);
            console.log(`Round ${i} completed.`);
            break; // TODO remove this and uncomment the stuff below
        }
        // message.channel.send("Game Over!")
        // if (mafia === 0) {
        //     message.channel.send("Village Wins!!!")
        // } else if (mafia >= nonmafia) {
        //     message.channel.send("Mafia Wins!!!")
        // }
    }
}