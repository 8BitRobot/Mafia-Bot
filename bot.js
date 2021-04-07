const Discord = require("discord.js");
const client = new Discord.Client();
const spectatorClient = new Discord.Client();
const config = require("./config.json");
const spectatorConfig = require("./spectatorConfig.json");
const fs = require("fs");
const { StreamInput, StreamOutput } = require('fluent-ffmpeg-multistream');
const prism = require("prism-media");

const prefix = "m.";

class GameData {
    constructor() {
        this.players = new Map();
        this.userids = new Map();
        this.settings = new Map();
        this.gameActive = false;
        this.gameReady = false;
        this.game = {
            game: {
                playersAlive: [],
                currentRound: 0,
                deadThisRound: [],
            },
            rounds: [],
        };
        this.emojiArray = [
            "🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲",
            "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿",
        ];
        /*

            {
                game: {
                    playersAlive: [],
                    currentRound: 1
                },
                rounds: [
                    Map() {
                        framer: {
                            action: "frame",
                            choices: [tag]
                        }
                    }
                ]

            }

        */

        this.settings.set("nightTime", 20);
        this.settings.set("dayTime", 20);
        this.settings.set("votingTime", 10);

        this.mafiaRoles = {
            "Godfather": {
                description: "You're the leader of the Larkinville Mafia and order a murder each night. Your goal is to have all the townspeople killed.",
                tier: 3, // TODO change to 1
                align: "Mafia",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Godfather"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to kill?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to kill anyone tonight.")
                                        .setColor("#d50000");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to kill ${selection} tonight.`)
                                        .setColor("#d50000");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Godfather"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "kill",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Framer": {
                align: "Mafia",
                tier: 2,
                emojiMap: new Map(),
                description: "You've moved up the ranks in the Larkinville Mafia due to your uncanny ability to alter the evidence. Your goal is to help the Mafia destroy the town by framing innocent villagers each night.",
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Framer"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to frame?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id) && this.players.get(t).align !== "Mafia")) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to frame anyone tonight.")
                                        .setColor("#d50000");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to frame ${selection} tonight.`)
                                        .setColor("#d50000");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Framer"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "frame",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Silencer": {
                align: "Mafia",
                tier: 1, // TODO change to 3
                description: "",
                emojiMap: new Map(),
                workedLastNight: false,
                silencedSoFar: [],
                silence: (guild, userid) => {
                    return new Promise(async (resolve) => {
                        let townHall = await guild.channels.resolve(this.settings.get("townHall"));
                        let textChannel = await guild.channels.resolve(this.settings.get("textChannel"));
                        let user = await guild.members.fetch(userid);
                        await townHall.updateOverwrite(user, {
                            VIEW_CHANNEL: false,
                            SPEAK: false,
                        });
                        await textChannel.updateOverwrite(user, {
                            SEND_MESSAGES: false,
                            SEND_TTS_MESSAGES: false,
                            ADD_REACTIONS: false,
                        });
                        resolve();
                    });
                },
                unsilence: (guild, userid) => {
                    return new Promise(async (resolve) => {
                        let townHall = await guild.channels.resolve(this.settings.get("townHall"));
                        let textChannel = await guild.channels.resolve(this.settings.get("textChannel"));
                        let user = await guild.members.fetch(userid);
                        await townHall.updateOverwrite(user, {
                            VIEW_CHANNEL: true,
                            SPEAK: true,
                        });
                        await textChannel.updateOverwrite(user, {
                            SEND_MESSAGES: true,
                            SEND_TTS_MESSAGES: true,
                            ADD_REACTIONS: true,
                        });
                        resolve();
                    });
                },
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Silencer"];
                        that.emojiMap.clear();
                        if (that.workedLastNight) {
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("You're too tired to silence anyone tonight. Try to get some sleep.");
                            user.send(message);
                            that.workedLastNight = false;
                            resolve("");
                        } else {
                            let i = 0;
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle(`Night ${this.game.game.currentRound}: Who do you want to silence?`)
                                .setDescription("Select a player using the reactions below:");
                            for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id) && !that.silencedSoFar.includes(t))) {
                                that.emojiMap.set(this.emojiArray[i], player);
                                message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                                i++;
                            }
                            let selection;
                            user.send(message).then(async (prompt) => {
                                for (let emoji of that.emojiMap.keys()) {
                                    prompt.react(emoji);
                                }
                                let promptFilter = (reaction, tuser) => {
                                    return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You chose not to silence anyone tonight.")
                                            .setColor("#d50000");
                                        user.send(noActionMessage);
                                        resolve("");
                                    } else {
                                        reaction = emoji.first().emoji.name;
                                        selection = that.emojiMap.get(reaction);
                                        let selectionMessage = new Discord.MessageEmbed()
                                            .setTitle(`You chose to silence ${selection} tonight.`)
                                            .setColor("#d50000");
                                        user.send(selectionMessage);
                                        that.workedLastNight = true;
                                        resolve(selection);
                                    }
                                });
                            });
                        }
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Silencer"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "silence",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Mafioso": {
                align: "Mafia",
                tier: 3,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
        };

        this.villageRoles = {
            "Doctor": {
                align: "Village",
                tier: 1,
                description: "You're the resident medical expert in Larkinville. Your job is to save those attacked by the Mafia.",
                emojiMap: new Map(),
                lastChoice: "",
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Doctor"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to save?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => (t !== that.lastChoice))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to save anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to save ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    that.lastChoice = selection;
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Doctor"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "heal",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Detective": {
                align: "Village",
                tier: 2,
                description: "As the criminology expert in the Larkinville Police Department, you've been hard at work investigating recent murders each night. Your goal is to deduce the identities of the Mafia.",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Detective"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to investigate?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to investigate anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to investigate ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Detective"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "check",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Vigilante": {
                align: "Village",
                tier: 3,
                description: "",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Vigilante"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to shoot?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to shoot anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to shoot ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Vigilante"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "kill-vigil",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Mayor": {
                align: "Village",
                tier: 3,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
            "PI": {
                align: "Village",
                tier: 4,
                description: "",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["PI"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to investigate?`)
                            .setDescription("Select TWO players using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to investigate anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else if (emoji.size === 1) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You didn't select enough people to investigate.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    console.log(emoji);
                                    console.log(typeof emoji);
                                    console.log(emoji.first(2));
                                    let selections = [];
                                    for (let e of emoji.first(2)) {
                                        // console.log(e);
                                        let reaction = e.emoji.name;
                                        let selection = that.emojiMap.get(reaction);
                                        selections.push(selection);
                                    }
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to investigate ${selections[0]} and ${selections[1]} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selections);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["PI"];
                        that.prompt(user).then((selections) => {
                            if (selections === "") {
                                resolve({});
                            } else {
                                resolve([this.players.get(selections[0]).role, this.players.get(selections[1]).role].includes("Baiter") ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "pi-check",
                                    choice: selections,
                                });
                            }
                        });
                    });
                },
            },
            "Jailer": {
                align: "Village",
                tier: 4,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
            "Distractor": {
                align: "Village",
                tier: 4,
                description: "",
                workedLastNight: false,
                emojiMap: new Map(),
                prompt: (user) => {
                    let that = this.villageRoles["Distractor"];
                    return new Promise((resolve) => {
                        if (that.workedLastNight) {
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("You're too tired to distract anyone tonight. Try to get some sleep.");
                            user.send(message);
                            that.workedLastNight = false;
                            resolve("");
                        } else {
                            that.emojiMap.clear();
                            let i = 0;
                            let message = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .setTitle(`Night ${this.game.game.currentRound}: Who do you want to distract?`)
                                .setDescription("Select a player using the reactions below:");
                            for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                                that.emojiMap.set(this.emojiArray[i], player);
                                message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                                i++;
                            }
                            let selection;
                            user.send(message).then(async (prompt) => {
                                for (let emoji of that.emojiMap.keys()) {
                                    prompt.react(emoji);
                                }
                                let promptFilter = (reaction, tuser) => {
                                    return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You chose not to distract anyone tonight.")
                                            .setColor("#1e8c00");
                                        user.send(noActionMessage);
                                        resolve("");
                                    } else {
                                        reaction = emoji.first().emoji.name;
                                        selection = that.emojiMap.get(reaction);
                                        let selectionMessage = new Discord.MessageEmbed()
                                            .setTitle(`You chose to distract ${selection} tonight.`)
                                            .setColor("#1e8c00");
                                        user.send(selectionMessage);
                                        that.workedLastNight = true;
                                        resolve(selection);
                                    }
                                });
                            });
                        }
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Distractor"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "distract",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Spy": {
                align: "Village",
                tier: 5,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
        };

        this.neutralRoles = {
            "Executioner": {
                align: "Neutral",
                tier: 1,
                description: "",
                target: "",
                wasLynched: false,
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
                win: (lynched) => {},
            },
            "Jester": {
                align: "Neutral",
                tier: 1,
                description: "",
                wasLynched: false,
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
                win: (lynched) => {

                },
            },
            "Eternal": {
                align: "Neutral",
                tier: 2,
                description: "",
                newAlign: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
            "Baiter": {
                align: "Neutral",
                tier: 2,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
            "Bomber": {
                align: "Neutral",
                tier: 2,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    });
                },
            },
        };
    }

    addSpectatorBot(channel) {
        channel.join()
    }
}

let gamedata = new GameData();

client.login(config.token);
spectatorClient.login(spectatorConfig.token);

client.once("ready", () => {
    console.log("Ready!");
});

const EventEmitter = require("events");
class MyEmitter extends EventEmitter {}
const emit = new MyEmitter();
gamedata.settings.set("emit", emit);

spectatorClient.once("ready", () => {
    console.log("Spectator ready!");
    let connection;
    emit.on("ghost town", async (channel) => {
        let vchannel;
        console.log("Ghost town created!");
        console.log(channel);
        vchannel = spectatorClient.channels.resolve(channel.id);
        console.log(channel);
        try {
            vchannel.join().then((con) => {
                connection = con;
            });
        } catch (e) {
            console.log("Error, trying again.");
            setTimeout(() => {
                vchannel = spectatorClient.channels.resolve(channel.id);
                vchannel.join().then((con) => {
                    connection = con;
                });
            }, 2000);
        }
    });
    emit.on("stream", (stream) => {
        // let streams = {
        //     opus: stream,
        //     input: stream,
        //     volume: new prism.VolumeTransformer({
        //         type: 's16le',
        //         volume: .1
        //     })
        // }
        // streams.opus = stream
        //     .pipe(streams.volume)
        //     .pipe(new prism.opus.Encoder({
        //         channels: 2,
        //         rate: 48000,
        //         frameSize: 480
        //     }));
        // let dispatcher = connection.player.createDispatcher({}, {});
        // streams.opus.pipe(dispatcher);
        connection.play(stream, {type: "converted"});
    });
});

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}


client.on("message", (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        return;
    }
    if (message.content.startsWith(prefix)) {
        let args = message.content.substring(prefix.length).trim().split(/ +/);
        let command = args.shift().toLowerCase();
        try {
            client.commands.get(command).execute(message, args, gamedata, spectatorClient);
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    }
});