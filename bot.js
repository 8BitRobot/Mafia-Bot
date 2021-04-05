const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const fs = require("fs");

const prefix = "m.";

class GameData {
    constructor() {
        this.players = new Map();
        this.userids = new Map();
        this.settings = new Map();
        this.gameActive = false;
        this.game = {
            game: {
                playersAlive: [],
                currentRound: 0,
                deadThisRound: []
            },
            rounds: []
        };
        this.emojiArray = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲",
            "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"
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

        this.mafiaRoles = {
            "Godfather": {
                description: "You're the leader of the Larkinville Mafia and order a murder each night. Your goal is to have all the townspeople killed.",
                tier: 1,
                align: "Mafia",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Godfather"];
                        that.emojiMap.clear()
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Whom do you want to kill?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player)
                            message.addField(`${this.emojiArray[i]} ${player}`, `React ${this.emojiArray[i]}!`, false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                await prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1)
                                let reaction;
                                if (emoji.size === 0) {
                                    user.send("You didn't select anyone?");
                                    resolve("");
                                }
                                reaction = emoji.first().emoji.name;
                                emoji = emoji.filter(t => t !== emoji.first())
                                emoji.first()
                                selection = that.emojiMap.get(reaction);
                                let selectionMessage = new Discord.MessageEmbed()
                                    .setTitle(`You chose to kill ${selection} tonight.`)
                                    .setColor("#d50000");
                                user.send(selectionMessage);
                                resolve(selection);
                            })
                        })
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
                                    choices: [this.userids.get(user.id)]
                                } : {
                                    action: "kill",
                                    choice: selection,
                                });
                            }
                        });
                    });
                }
            },
            "Framer": {
                align: "Mafia",
                tier: 2,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    })
                },
            },
            "Silencer": {
                align: "Mafia",
                tier: 3,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
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
                        resolve({})
                    })
                }
            }
        }

        this.villageRoles = {
            "Doctor": {
                align: "Village",
                tier: 1,
                description: "",
                emojiMap: new Map(),
                lastChoice: "",
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Doctor"];
                        that.emojiMap.clear()
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Whom do you want to save?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => (t !== this.userids.get(user.id) && t !== that.lastChoice))) {
                            that.emojiMap.set(this.emojiArray[i], player)
                            message.addField(`${this.emojiArray[i]} ${player}`, `React ${this.emojiArray[i]}!`, false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                await prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1)
                                let reaction;
                                if (emoji.size === 0) {
                                    user.send("You didn't select anyone?");
                                    resolve("");
                                }
                                reaction = emoji.first().emoji.name;
                                emoji = emoji.filter(t => t !== emoji.first())
                                emoji.first()
                                selection = that.emojiMap.get(reaction);
                                let selectionMessage = new Discord.MessageEmbed()
                                    .setTitle(`You chose to save ${selection} tonight.`)
                                    .setColor("#1e8c00");
                                user.send(selectionMessage);
                                that.lastChoice = selection;
                                resolve(selection);
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
                                    choices: [this.userids.get(user.id)]
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
                description: "",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Detective"];
                        that.emojiMap.clear()
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Whom do you want to investigate?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player)
                            message.addField(`${this.emojiArray[i]} ${player}`, `React ${this.emojiArray[i]}!`, false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                await prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1)
                                let reaction;
                                if (emoji.size === 0) {
                                    user.send("You didn't select anyone?");
                                    resolve("");
                                }
                                reaction = emoji.first().emoji.name;
                                emoji = emoji.filter(t => t !== emoji.first())
                                emoji.first()
                                selection = that.emojiMap.get(reaction);
                                let selectionMessage = new Discord.MessageEmbed()
                                    .setTitle(`You chose to investigate ${selection} tonight.`)
                                    .setColor("#1e8c00");
                                user.send(selectionMessage);
                                resolve(selection);
                            })
                        })
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
                                    choices: [this.userids.get(user.id)]
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
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
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
                        resolve({})
                    })
                },
            },
            "PI": {
                align: "Village",
                tier: 4,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
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
                        resolve({})
                    })
                },
            },
            "Distractor": {
                align: "Village",
                tier: 4,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
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
                        resolve({})
                    })
                },
            },
        };

        this.neutralRoles = {
            "Executioner": {
                align: "Neutral",
                tier: 1,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
                }
            },
            "Jester": {
                align: "Neutral",
                tier: 1,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
                }
            },
            "Eternal": {
                align: "Neutral",
                tier: 2,
                description: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({})
                    })
                }
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
                        resolve({})
                    })
                }
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
                    })
                }
            }
        }
    };
}

let gamedata = new GameData();

client.once("ready", () => {
    console.log("Ready!");
});

client.login(config.token);

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
            client.commands.get(command).execute(message, args, gamedata);
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    }
});