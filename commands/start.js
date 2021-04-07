const Discord = require("discord.js");

module.exports = {
    name: "start",
    description: "",
    async execute(message, args, gamedata) {
        let channel = message.guild.channels.resolve(gamedata.settings.get("textChannel"));

        if (!gamedata.gameActive) {
            message.channel.send("Use `m.setup` to setup the game first.");
            return;
        }

        if (!gamedata.gameReady) {
            message.channel.send("Please wait for the game to finish setting up.");
            return;
        }

        if (!gamedata.players.get(message.author.tag).isHost && message.author.tag !== "PiAreSquared#6784" && message.author.tag !== "8BitRobot#3625") {
            message.channel.send(`**${message.author.tag}** does not have the permissions to start the game.`)
            return;
        }


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

        function daytimeVoting() {
            return new Promise((resolve) => {
                let nominateMsg = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle("Time to discuss! Talk to your fellow villagers about the recent events.")
                    .setDescription("And once you're done, you have the option of nominating any suspicious villagers for a ritual execution.");
                let emojiMap = new Map();
                let i = 0;
                for (let player of gamedata.game.game.playersAlive) {
                    emojiMap.set(gamedata.emojiArray[i], player)
                    nominateMsg.addField(`${gamedata.emojiArray[i]} ${player}`, "\u200B", false);
                    i++;
                }
                nominateMsg.setFooter("Use the emojis below to vote on whom to nominate!");
                channel.send(nominateMsg).then(async (prompt) => {
                    for (let emoji of emojiMap.keys()) {
                        prompt.react(emoji);
                    }
                    let promptFilter = (reaction, tuser) => {
                        return Array.from(emojiMap.keys()).includes(reaction.emoji.name) && tuser.id !== "827754470825787413"
                            && gamedata.players.get(gamedata.userids.get(tuser.id)).isAlive &&
                            !gamedata.players.get(gamedata.userids.get(tuser.id)).wasSilenced;
                    };
                    prompt.awaitReactions(promptFilter, {
                        time: gamedata.settings.get("dayTime") * 1000,
                    }).then(async (emojis) => {
                        emojis = emojis.filter(t => t.count > 1)
                        let reactions = {};
                        let maxCount = 0;
                        let currentReaction = [];
                        for (let [emoji, emojiData] of emojis) {
                            if (emojiData.count > maxCount) {
                                currentReaction = [emojiMap.get(emoji)]
                                maxCount = emojiData.count;
                            } else if (emojiData.count === maxCount) {
                                currentReaction.push(emojiMap.get(emoji));
                            }
                        }
                        if (currentReaction.length !== 1 || (maxCount - 1) <= gamedata.game.game.playersAlive.length * 0.33) {
                            channel.send("vote was inconclusive");
                            resolve();
                        } else {
                            let nominee = currentReaction[0];
                            let votingMsg = new Discord.MessageEmbed()
                                .setColor("#cccccc")
                                .setTitle(`The town has nominated ${nominee.substring(0, nominee.length - 5)}`)
                                .setDescription(`<@${gamedata.players.get(nominee).id}> has ${gamedata.settings.get("votingTime")} seconds to make their case.`)
                                .setFooter("Use the emojis below to vote for or against the execution!");
                            channel.send(votingMsg).then((votingPrompt) => {
                                votingPrompt.react("✅");
                                votingPrompt.react("❌")
                                promptFilter = (reaction, tuser) => {
                                    return ["✅", "❌"].includes(reaction.emoji.name) && tuser.id !== "827754470825787413"
                                        && gamedata.players.get(gamedata.userids.get(tuser.id)).isAlive 
                                        && !gamedata.players.get(gamedata.userids.get(tuser.id)).wasSilenced
                                        && tuser.id !== gamedata.players.get(nominee).id;
                                };
                                votingPrompt.awaitReactions(promptFilter, {
                                    time: gamedata.settings.get("dayTime") * 1000,
                                }).then((votingEmojis) => {
                                    votingEmojis = votingEmojis.filter(t => t.count > 1)
                                    let votingResult = (votingEmojis.get("✅") ?? {count:0}).count > (votingEmojis.get("❌") ?? {count:0}).count ? "✅" : undefined;
                                    let votingResultMsg;
                                    if (!votingResult) {
                                        votingResultMsg = `${nominee} was acquitted.`;
                                    } else {
                                        let user = gamedata.players.get(nominee)
                                        user.isAlive = false;
                                        gamedata.players.set(nominee, user);
                                        gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(player => player !== nominee);
                                        votingResultMsg = `F in the chats for ${nominee}.`;
                                    }
                                    channel.send(votingResultMsg).then(() => {
                                        resolve();
                                    })
                                });
                            });
                        }
                    });
                });
            });
        }

        function dayTime(round) {
            return new Promise(async (resolve) => {
                nonmafia = 0;
                mafia = 0;
                for (let member of users) {
                    let user = gamedata.userids.get(member.id);
                    let temp = gamedata.players.get(user);
                    temp.wasFramed = false;
                    gamedata.players.set(user, temp);
                    if (gamedata.players.get(user).isAlive) {
                        if (gamedata.players.get(user).align === "Mafia") mafia++;
                        else nonmafia++;
                    }
                    if (!gamedata.players.get(user).isAlive || gamedata.players.get(user).wasSilenced) {
                        await message.guild.channels.resolve(gamedata.settings.get("textChannel")).updateOverwrite(member, {
                            SEND_MESSAGES: false,
                            SEND_TTS_MESSAGES: false,
                            ADD_REACTIONS: false,
                        });
                        await message.guild.channels.resolve(gamedata.settings.get("townHall")).updateOverwrite(member, {
                            SPEAK: false,
                        });
                        if (gamedata.players.get(user).align === "Mafia") {
                            await message.guild.channels.resolve(gamedata.settings.get("mafiaHouse")).updateOverwrite(member, {
                                VIEW_CHANNEL: false,
                            });
                        }
                    }
                }

                for (let member of users) {
                    await member.voice.setChannel(gamedata.settings.get("townHall")).catch(() => { // WE ADDED AN AWAIT HERE, IF IT DOESNT WORK REMEMBER THIS
                        channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to the **Town Hall Meeting**, please join manually.`)
                    });
                }
                let roundOverTitle = `Night ${round} is over!`;
                if (gamedata.game.game.deadThisRound.length === 0) {
                    roundOverTitle += "Nothing eventful happened.";
                } else {
                    roundOverTitle += "A few things happened...";
                }
                let roundOverMsg = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle(roundOverTitle);
                channel.send(roundOverMsg);
                for (let death of gamedata.game.game.deadThisRound) {
                    switch (death.by) {
                        case "Mafia":
                            let mafiaAttackMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .attachFiles([`images/death.png`])
                                .setThumbnail("attachment://death.png")
                                .setTitle(`The Mafia attacked ${gamedata.players.get(death.name).username} last night!`);
                            if (gamedata.game.game.deadThisRound.filter(death => death.by === "Doctor").length === 0) {
                                mafiaAttackMsg.setDescription("Unfortunately, the doctor was nowhere to be found.")
                            }
                            await channel.send(mafiaAttackMsg);
                            break;
                        case "Doctor":
                            let doctorSaveMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .attachFiles([`images/health.png`])
                                .setThumbnail("attachment://health.png")
                                .setTitle(`However, the Doctor was able to save them!`);
                            await channel.send(doctorSaveMsg);
                            break;
                        case "Vigilante":
                            let align = gamedata.players.get(death.name).align
                            let vigilanteKillMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .attachFiles([`images/death.png`])
                                .setThumbnail("attachment://death.png")
                                .setTitle(`The vigilante shot ${gamedata.players.get(death.name).username}!`)
                                .setDescription(align === "Village" ?
                                    `Unfortunately, ${gamedata.players.get(death.name).username} was a **villager**. The vigilante, ${death.vigil}, committed suicide out of guilt.` :
                                    `${gamedata.players.get(death.name).username} was a **${align}**! The vigilante lives to shoot another day.`
                                );
                            await channel.send(vigilanteKillMsg);
                            break;
                    }
                }

                if (mafia >= nonmafia || mafia === 0) {
                    resolve(true);
                }

                let dayStartMsg = new Discord.MessageEmbed()
                    .setTitle(`You've arrived at Town Hall on Day ${round}.`)
                    .setDescription("Here's the attendance for today's meeting:")
                let alive = "";
                let dead = "";
                let silenced;
                for (let player of gamedata.game.game.playersAlive) {
                    let temp = gamedata.players.get(player);
                    let id = temp.id;
                    if (!temp.wasSilenced) {
                        alive += `\n<@${id}>`
                    } else {
                        silenced = `<@${id}>`;
                        temp.wasSilenced = false;
                        gamedata.players.set(player, temp);
                    }
                }
                let playersDead = Array.from(gamedata.players.keys()).filter(a => !gamedata.game.game.playersAlive.includes(a)).map(tag => `<@${gamedata.players.get(tag).id}>`);
                if (silenced) {
                    playersDead.splice(Math.floor(Math.random() * playersDead.length), 0, silenced);
                }
                dead = playersDead.join("\n")
                dayStartMsg.addField("Present", alive ? alive : "None", true);
                dayStartMsg.addField("Absent", dead ? dead : "None", true);
                channel.send(dayStartMsg);

                console.log("BEFORE THE SETTIMEOUT");

                setTimeout(() => {
                    let voting = daytimeVoting().then(() => {
                        nonmafia = 0;
                        mafia = 0;
                        for (const [name, player] of gamedata.players) {
                            if (player.isAlive) {
                                if (player.align === "Mafia") mafia++;
                                else nonmafia++;
                            }
                        }
                        if (mafia >= nonmafia || mafia === 0) {
                            resolve(true);
                        } else {
                            resolve();
                        }
                    });
                }, gamedata.settings.get(dayTime) * 1000);
            })
        }

        function nightActions(roundNum) {
            return new Promise((resolve) => {
                gamedata.game.game.deadThisRound = [];
                let intro = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle(`The sun's down, and it's night ${roundNum}! Time to sleep...`);
                let alive = "";
                let silenced;
                for (let player of gamedata.game.game.playersAlive) {
                    let temp = gamedata.players.get(player);
                    let id = temp.id;
                    if (!temp.wasSilenced) {
                        alive += `\n<@${id}>`
                    }
                }
                intro.addField("Leaving the meeting:", alive, true);
                channel.send(intro);
                let round = new Map();
                let i = 0;
                let promises = []
                for (const [tag, player] of gamedata.players) {
                    let user = users[i]
                    if (!player.isAlive) {
                        i++;
                        continue;
                    }
                    promises.push(gamedata[`${player.align.toLowerCase()}Roles`][player.role].night(user).then((result) => {
                        round.set(player.role, [result, tag]);
                    }));
                    i++;
                }
                Promise.all(promises).then(() => {
                    gamedata.game.rounds.push(round);

                    let killed;

                    let orderOfActions = [
                        // ["Distractor", "Village"],
                        // ["Jailer", "Village"],
                        ["Framer", "Mafia"],
                        // ["Silencer", "Mafia"],
                        ["Godfather", "Mafia"],
                        ["Mafioso", "Mafia"],
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
                        let r = round.get(role);
                        let action = r[0];
                        let tag = r[1];
                        if (!action.action) {
                            continue; // TODO: handle this better
                        }
                        let deadPerson;
                        let temp;
                        switch (action.action) {
                            case "kill":
                                deadPerson = action.choice;
                                killed = deadPerson;
                                temp = gamedata.players.get(deadPerson);
                                temp.isAlive = false;
                                gamedata.players.set(deadPerson, temp);
                                gamedata.game.game.deadThisRound.push({
                                    name: deadPerson,
                                    by: "Mafia",
                                });
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== deadPerson);
                                message.guild.members.fetch(temp.id).then((user) => {
                                    let targetDeathMsg = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`Unfortunately, you were attacked by the mafia.`)
                                        .setDescription(`You attempt to ${temp.role === "Doctor" ? "grab your first-aid kit!" : "summon the doctor using the Larkinville Emergency Line!"}`);
                                    user.send(targetDeathMsg);
                                });
                                break;
                            case "frame":
                                temp = gamedata.players.get(action.choice);
                                temp.wasFramed = true;
                                gamedata.players.set(action.choice, temp);
                                break;
                            case "kill-vigil":
                                let vigilante = gamedata.players.get(tag);
                                if (!vigilante.isAlive) break;
                                deadPerson = action.choice;
                                temp = gamedata.players.get(deadPerson);
                                let align = temp.align;
                                temp.isAlive = false;
                                gamedata.players.set(deadPerson, temp);
                                gamedata.game.game.deadThisRound.push({
                                    name: deadPerson,
                                    by: "Vigilante",
                                    vigil: tag,
                                });
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== deadPerson);
                                message.guild.members.fetch(temp.id).then((user) => {
                                    let vigilanteTargetMsg = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`Unfortunately, you were shot by the vigilante.`)
                                    user.send(vigilanteTargetMsg);
                                });
                                message.guild.members.fetch(vigilante.id).then((user) => {
                                    let vigilanteKillMsg;
                                    if (align === "Village") {
                                        vigilanteKillMsg = new Discord.MessageEmbed()
                                            .setColor("#d50000")
                                            .attachFiles([`images/death.png`])
                                            .setThumbnail("attachment://death.png")
                                            .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                            .setDescription(`You discover that you have made a grave error and shot a villager. After giving ${temp.username} a proper burial, you load your gun for one final shot: yourself.`);
                                        vigilante.isAlive = false;
                                        gamedata.players.set(tag, vigilante);
                                        // gamedata.game.game.deadThisRound.push({
                                        //     name: tag,
                                        //     by: "Vigilante-Suicide",
                                        // });
                                        gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== tag);
                                    } else if (align === "Mafia") {
                                        vigilanteKillMsg = new Discord.MessageEmbed()
                                            .setColor("#1e8c00")
                                            .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                            .setDescription(`The paper contains the Larkinville Mafia's plans to kill the rest of the village.`);
                                    } else {
                                        vigilanteKillMsg = new Discord.MessageEmbed()
                                            .setColor("#1984ff")
                                            .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                            .setDescription(`The paper reads that ${temp.username} did not align with the Village but did not agree with the Larkinville Mafia's methods.`);
                                    }
                                    user.send(vigilanteKillMsg);
                                })
                                break;
                            case "check":
                                let detective = gamedata.players.get(tag);
                                if (!detective.isAlive) break;
                                let suspect = gamedata.players.get(action.choice);
                                message.guild.members.fetch(detective.id).then((user) => {
                                    let detectiveResultMsg;
                                    console.log(suspect);
                                    if (suspect.align === "Mafia" || suspect.wasFramed) {
                                        detectiveResultMsg = new Discord.MessageEmbed()
                                            .setColor("#d50000")
                                            .setTitle(`Your investigation has revealed that the suspect is in the mafia!`)
                                            .setDescription("That, or they may have been framed. Keep this in mind when revealing your findings to the town.");
                                    } else {
                                        detectiveResultMsg = new Discord.MessageEmbed()
                                            .setColor("#1e8c00")
                                            .setTitle(`Your investigation has revealed that the suspect is clear.`)
                                            .setDescription("You can tell the town, but keep in mind you may be putting a target on your back.");
                                    }
                                    user.send(detectiveResultMsg);
                                });
                                break;
                            case "heal":
                                let doc = gamedata.players.get(tag);
                                let target = gamedata.players.get(action.choice);
                                if (tag === action.choice && !doc.isAlive) { // if doctor was attacked and saved himself
                                    gamedata.game.game.playersAlive.push(tag);
                                    // gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== tag)
                                    doc.isAlive = true;
                                    gamedata.players.set(tag, doc)
                                    let docSaveSuccessfulSelf = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles([`images/health.png`])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle(`You successfully saved yourself!`)
                                        .setDescription("The mafia tried to attack you, but you thwarted their efforts. The town will certainly hear about this.");
                                    message.guild.members.fetch(doc.id).then((user) => {
                                        user.send(docSaveSuccessfulSelf);
                                    });
                                    gamedata.game.game.deadThisRound.push({
                                        name: action.choice,
                                        by: "Doctor",
                                    });
                                } else if (doc.isAlive && !target.isAlive && action.choice === killed) { // if someone else was attacked and doctor saved them
                                    gamedata.game.game.playersAlive.push(action.choice);
                                    // gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== action.choice)
                                    target.isAlive = true;
                                    gamedata.players.set(action.choice, target)
                                    let docSaveSuccessful = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles([`images/health.png`])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle(`You successfully saved ${gamedata.players.get(action.choice).username}!`)
                                        .setDescription("The mafia tried to attack this person, but you thwarted their efforts. The town will certainly hear about this.");
                                    message.guild.members.fetch(doc.id).then((user) => {
                                        user.send(docSaveSuccessful);
                                    });
                                    let targetSaveSuccessful = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles([`images/health.png`])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle(`You were saved by the Doctor!`)
                                        .setDescription("The mafia attacked you last night, but the doctor was able to heal you just in time! The town will certainly hear about this.")
                                    message.guild.members.fetch(target.id).then((targetuser) => {
                                        targetuser.send(targetSaveSuccessful);
                                    });
                                    gamedata.game.game.deadThisRound.push({
                                        name: action.choice,
                                        by: "Doctor",
                                    });
                                } else if (killed) { // anyone attacked, unsuccesful save
                                    let unsuccesfulSave = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .attachFiles([`images/death.png`])
                                        .setThumbnail("attachment://death.png")
                                        .setTitle(`${killed && gamedata.players.get(killed).role === "Doctor" ? "You failed to get your first-aid kit!" : "The doctor was unreachable!"} Unfortunately, you died.`)
                                        .setDescription("Now that you are dead you can spectate the rest of the game, but you can no longer speak or perform any nightly actions. Please refrain from communicating with living players via video or DMs.")
                                    message.guild.members.fetch(gamedata.players.get(killed).id).then((user) => {
                                        user.send(unsuccesfulSave);
                                    });
                                }
                                killed = null;
                                break;
                            case "baited":

                                break;
                            default:
                                console.log(action.action);
                                console.log(role);
                                break;
                        };
                    }
                    resolve();
                });
            });
        }

        function nightTime(round) {
            return new Promise((resolve) => {
                console.log("night time");
                for (let member of users) {
                    member.voice.setChannel(gamedata.players.get(gamedata.userids.get(member.id)).vc).catch(() => {
                        channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to **their home**, please join manually.`)
                    });
                }

                nightActions(round).then(() => {
                    resolve();
                });
            });
        }

        for (let i = 1; nonmafia > mafia; i++) {
            gamedata.game.game.currentRound = i;
            await nightTime(i);
            if (await dayTime(i)) break;
            console.log(`Round ${i} completed.`);
        }

        channel.send("Game Over!");
        gamedata.gameActive = false;
        gamedata.gameReady = false;
        if (mafia === 0) {
            channel.send("Village Wins!!!");
            return;
        } else if (mafia >= nonmafia) {
            channel.send("Mafia Wins!!!");
            return;
        }
    }
}